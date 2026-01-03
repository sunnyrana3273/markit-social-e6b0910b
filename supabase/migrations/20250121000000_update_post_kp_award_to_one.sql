-- Update knowledge points awarded for posts from 3 to 1
-- Update the comment
COMMENT ON COLUMN public.profiles.knowledge_points IS 'Points earned by posting (+1), replying (+2), and getting upvotes (+1)';

-- Update function to award 1 knowledge point for posts (instead of 3)
CREATE OR REPLACE FUNCTION public.award_points_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET knowledge_points = knowledge_points + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

