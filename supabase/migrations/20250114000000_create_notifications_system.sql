-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('message', 'discussion_reply', 'call', 'post_engagement')),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Enable realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Function to create notification for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name text;
  sender_profile record;
BEGIN
  -- Get sender's profile information
  SELECT first_name, last_name, email INTO sender_profile
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Build sender name
  IF sender_profile.first_name IS NOT NULL AND sender_profile.last_name IS NOT NULL THEN
    sender_name := sender_profile.first_name || ' ' || sender_profile.last_name;
  ELSIF sender_profile.first_name IS NOT NULL THEN
    sender_name := sender_profile.first_name;
  ELSE
    sender_name := split_part(sender_profile.email, '@', 1);
  END IF;
  
  -- Create notification for receiver
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.receiver_id,
    'message',
    'New Message',
    sender_name || ' sent you a message',
    jsonb_build_object(
      'sender_id', NEW.sender_id,
      'message_id', NEW.id,
      'sender_name', sender_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new messages
DROP TRIGGER IF EXISTS trigger_notify_new_message ON public.friend_messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON public.friend_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- Function to create notification for discussion replies
CREATE OR REPLACE FUNCTION public.notify_discussion_reply()
RETURNS TRIGGER AS $$
DECLARE
  discussion_owner_id uuid;
  discussion_community_id uuid;
  replier_name text;
  replier_profile record;
  discussion_title text;
BEGIN
  -- Get discussion owner and community
  SELECT user_id, title, community_id INTO discussion_owner_id, discussion_title, discussion_community_id
  FROM public.community_discussions
  WHERE id = NEW.discussion_id;
  
  -- Don't notify if user is replying to their own discussion
  IF discussion_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get replier's profile information
  SELECT first_name, last_name, email INTO replier_profile
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Build replier name
  IF replier_profile.first_name IS NOT NULL AND replier_profile.last_name IS NOT NULL THEN
    replier_name := replier_profile.first_name || ' ' || replier_profile.last_name;
  ELSIF replier_profile.first_name IS NOT NULL THEN
    replier_name := replier_profile.first_name;
  ELSE
    replier_name := split_part(replier_profile.email, '@', 1);
  END IF;
  
  -- Create notification for discussion owner
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    discussion_owner_id,
    'discussion_reply',
    'New Reply',
    replier_name || ' replied to your discussion: ' || COALESCE(discussion_title, 'Untitled'),
    jsonb_build_object(
      'replier_id', NEW.user_id,
      'replier_name', replier_name,
      'discussion_id', NEW.discussion_id,
      'community_id', discussion_community_id,
      'reply_id', NEW.id,
      'discussion_title', discussion_title
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for discussion replies
DROP TRIGGER IF EXISTS trigger_notify_discussion_reply ON public.community_discussion_replies;
CREATE TRIGGER trigger_notify_discussion_reply
  AFTER INSERT ON public.community_discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_discussion_reply();

-- Function to create notification for calls (called from application code)
CREATE OR REPLACE FUNCTION public.create_call_notification(
  p_user_id uuid,
  p_caller_id uuid,
  p_caller_name text
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id,
    'call',
    'Incoming Call',
    p_caller_name || ' is calling you',
    jsonb_build_object(
      'caller_id', p_caller_id,
      'caller_name', p_caller_name
    )
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table to track last engagement check time per user
CREATE TABLE IF NOT EXISTS public.user_engagement_checks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_check_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_engagement_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own engagement checks"
ON public.user_engagement_checks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own engagement checks"
ON public.user_engagement_checks
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own engagement checks"
ON public.user_engagement_checks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to check and create post engagement notifications for a specific user
CREATE OR REPLACE FUNCTION public.check_post_engagement(p_user_id uuid DEFAULT auth.uid())
RETURNS void AS $$
DECLARE
  discussion_record record;
  new_likes_count integer;
  new_interactions_count integer;
  last_check_time timestamptz;
  engagement_message text;
  discussion_community_id uuid;
BEGIN
  -- Get last check time for this user
  SELECT last_check_at INTO last_check_time
  FROM public.user_engagement_checks
  WHERE user_id = p_user_id;
  
  -- Default to 30 minutes ago if no previous check
  IF last_check_time IS NULL THEN
    last_check_time := now() - interval '30 minutes';
  END IF;
  
  -- Check each discussion created by this user (check all discussions, not just recent ones)
  FOR discussion_record IN 
    SELECT id, title, created_at, community_id
    FROM public.community_discussions
    WHERE user_id = p_user_id
  LOOP
    discussion_community_id := discussion_record.community_id;
    
    -- Count new upvotes since last check
    SELECT COUNT(*) INTO new_likes_count
    FROM public.community_discussion_votes
    WHERE discussion_id = discussion_record.id
    AND vote_type = 'upvote'
    AND created_at > last_check_time;
    
    -- Count new interactions since last check
    SELECT COUNT(*) INTO new_interactions_count
    FROM public.community_discussion_interactions
    WHERE discussion_id = discussion_record.id
    AND created_at > last_check_time;
    
    -- Only create notification if there are new likes or interactions
    IF new_likes_count > 0 OR new_interactions_count > 0 THEN
      -- Build engagement message
      engagement_message := 'Your discussion "' || COALESCE(discussion_record.title, 'Untitled') || '"';
      
      IF new_likes_count > 0 AND new_interactions_count > 0 THEN
        engagement_message := engagement_message || ' got ' || new_likes_count || ' new like' || 
          CASE WHEN new_likes_count > 1 THEN 's' ELSE '' END || 
          ' and ' || new_interactions_count || ' new interaction' ||
          CASE WHEN new_interactions_count > 1 THEN 's' ELSE '' END;
      ELSIF new_likes_count > 0 THEN
        engagement_message := engagement_message || ' got ' || new_likes_count || ' new like' ||
          CASE WHEN new_likes_count > 1 THEN 's' ELSE '' END;
      ELSE
        engagement_message := engagement_message || ' got ' || new_interactions_count || ' new interaction' ||
          CASE WHEN new_interactions_count > 1 THEN 's' ELSE '' END;
      END IF;
      
      -- Create notification
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        p_user_id,
        'post_engagement',
        'Post Update',
        engagement_message,
        jsonb_build_object(
          'discussion_id', discussion_record.id,
          'community_id', discussion_community_id,
          'discussion_title', discussion_record.title,
          'new_likes', new_likes_count,
          'new_interactions', new_interactions_count
        )
      );
    END IF;
  END LOOP;
  
  -- Update last check time
  INSERT INTO public.user_engagement_checks (user_id, last_check_at, updated_at)
  VALUES (p_user_id, now(), now())
  ON CONFLICT (user_id) 
  DO UPDATE SET last_check_at = now(), updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

