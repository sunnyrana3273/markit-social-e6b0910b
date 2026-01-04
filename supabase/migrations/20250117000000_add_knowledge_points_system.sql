-- Add knowledge_points column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS knowledge_points integer NOT NULL DEFAULT 0;

-- Add comment
COMMENT ON COLUMN public.profiles.knowledge_points IS 'Points earned by posting (+3), replying (+2), and getting upvotes (+1)';

-- Create function to award knowledge points for posts
CREATE OR REPLACE FUNCTION public.award_points_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET knowledge_points = knowledge_points + 3
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Create function to award knowledge points for replies
CREATE OR REPLACE FUNCTION public.award_points_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET knowledge_points = knowledge_points + 2
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Create function to award knowledge points for upvotes on posts
CREATE OR REPLACE FUNCTION public.award_points_on_post_upvote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  post_author_id uuid;
BEGIN
  -- Get the post author
  SELECT user_id INTO post_author_id
  FROM public.community_discussions
  WHERE id = COALESCE(NEW.discussion_id, OLD.discussion_id);
  
  IF post_author_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Award points when an upvote is added
  IF TG_OP = 'INSERT' AND NEW.vote_type = 'upvote' THEN
    UPDATE public.profiles
    SET knowledge_points = knowledge_points + 1
    WHERE id = post_author_id;
  END IF;
  
  -- Remove points when an upvote is removed
  IF TG_OP = 'DELETE' AND OLD.vote_type = 'upvote' THEN
    UPDATE public.profiles
    SET knowledge_points = GREATEST(0, knowledge_points - 1)
    WHERE id = post_author_id;
  END IF;
  
  -- Handle vote changes
  IF TG_OP = 'UPDATE' THEN
    -- If changing from downvote to upvote, add 1 point
    IF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
      UPDATE public.profiles
      SET knowledge_points = knowledge_points + 1
      WHERE id = post_author_id;
    -- If changing from upvote to downvote, remove 1 point
    ELSIF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
      UPDATE public.profiles
      SET knowledge_points = GREATEST(0, knowledge_points - 1)
      WHERE id = post_author_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create function to award knowledge points for upvotes on replies
CREATE OR REPLACE FUNCTION public.award_points_on_reply_upvote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  reply_author_id uuid;
BEGIN
  -- Get the reply author
  SELECT user_id INTO reply_author_id
  FROM public.community_discussion_replies
  WHERE id = COALESCE(NEW.reply_id, OLD.reply_id);
  
  IF reply_author_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Award points when an upvote is added
  IF TG_OP = 'INSERT' AND NEW.vote_type = 'upvote' THEN
    UPDATE public.profiles
    SET knowledge_points = knowledge_points + 1
    WHERE id = reply_author_id;
  END IF;
  
  -- Remove points when an upvote is removed
  IF TG_OP = 'DELETE' AND OLD.vote_type = 'upvote' THEN
    UPDATE public.profiles
    SET knowledge_points = GREATEST(0, knowledge_points - 1)
    WHERE id = reply_author_id;
  END IF;
  
  -- Handle vote changes
  IF TG_OP = 'UPDATE' THEN
    -- If changing from downvote to upvote, add 1 point
    IF OLD.vote_type = 'downvote' AND NEW.vote_type = 'upvote' THEN
      UPDATE public.profiles
      SET knowledge_points = knowledge_points + 1
      WHERE id = reply_author_id;
    -- If changing from upvote to downvote, remove 1 point
    ELSIF OLD.vote_type = 'upvote' AND NEW.vote_type = 'downvote' THEN
      UPDATE public.profiles
      SET knowledge_points = GREATEST(0, knowledge_points - 1)
      WHERE id = reply_author_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for posts
DROP TRIGGER IF EXISTS trigger_award_points_on_post ON public.community_discussions;
CREATE TRIGGER trigger_award_points_on_post
  AFTER INSERT ON public.community_discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_post();

-- Create triggers for replies
DROP TRIGGER IF EXISTS trigger_award_points_on_reply ON public.community_discussion_replies;
CREATE TRIGGER trigger_award_points_on_reply
  AFTER INSERT ON public.community_discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_reply();

-- Create triggers for post upvotes
DROP TRIGGER IF EXISTS trigger_award_points_on_post_upvote ON public.community_discussion_votes;
CREATE TRIGGER trigger_award_points_on_post_upvote
  AFTER INSERT OR UPDATE OR DELETE ON public.community_discussion_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_post_upvote();

-- Create triggers for reply upvotes
DROP TRIGGER IF EXISTS trigger_award_points_on_reply_upvote ON public.community_reply_votes;
CREATE TRIGGER trigger_award_points_on_reply_upvote
  AFTER INSERT OR UPDATE OR DELETE ON public.community_reply_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_reply_upvote();






