-- Table to track active chat sessions (when a user is viewing a chat)
CREATE TABLE IF NOT EXISTS public.active_chat_sessions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_active_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);

-- Enable RLS
ALTER TABLE public.active_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own active chat sessions
CREATE POLICY "Users can view their own active chat sessions"
ON public.active_chat_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert/update their own active chat sessions
CREATE POLICY "Users can manage their own active chat sessions"
ON public.active_chat_sessions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_active_chat_sessions_user_friend 
ON public.active_chat_sessions(user_id, friend_id);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_active_chat_sessions_last_active 
ON public.active_chat_sessions(last_active_at);

-- Function to update or create active chat session
CREATE OR REPLACE FUNCTION public.set_active_chat_session(
  p_user_id uuid,
  p_friend_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.active_chat_sessions (user_id, friend_id, last_active_at)
  VALUES (p_user_id, p_friend_id, now())
  ON CONFLICT (user_id, friend_id)
  DO UPDATE SET last_active_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove active chat session
CREATE OR REPLACE FUNCTION public.remove_active_chat_session(
  p_user_id uuid,
  p_friend_id uuid
)
RETURNS void AS $$
BEGIN
  DELETE FROM public.active_chat_sessions
  WHERE user_id = p_user_id AND friend_id = p_friend_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the notification function to check if receiver is viewing the chat
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name text;
  sender_profile record;
  is_receiver_viewing_chat boolean;
BEGIN
  -- Check if receiver is currently viewing this chat (active within last 30 seconds)
  SELECT EXISTS (
    SELECT 1 
    FROM public.active_chat_sessions 
    WHERE user_id = NEW.receiver_id 
      AND friend_id = NEW.sender_id
      AND last_active_at > now() - interval '30 seconds'
  ) INTO is_receiver_viewing_chat;
  
  -- Skip notification if receiver is viewing the chat
  IF is_receiver_viewing_chat THEN
    RETURN NEW;
  END IF;
  
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





