-- Set favorite_community_id when user joins their first community
-- This works for both onboarding and regular community joins

-- Function to set favorite community when user joins first community
CREATE OR REPLACE FUNCTION public.set_favorite_community_on_first_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_stats_count integer;
  first_community_id uuid;
BEGIN
  -- Check if user_stats already exists for this user
  SELECT COUNT(*) INTO existing_stats_count
  FROM public.user_stats
  WHERE user_id = NEW.user_id;

  -- If user_stats doesn't exist, create it
  IF existing_stats_count = 0 THEN
    INSERT INTO public.user_stats (
      user_id,
      favorite_community_id
    )
    VALUES (
      NEW.user_id,
      NEW.community_id
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    -- If user_stats exists but favorite_community_id is NULL, set it to the first community
    UPDATE public.user_stats
    SET favorite_community_id = NEW.community_id
    WHERE user_id = NEW.user_id
      AND favorite_community_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on community_memberships to set favorite community
DROP TRIGGER IF EXISTS on_community_join_set_favorite ON public.community_memberships;
CREATE TRIGGER on_community_join_set_favorite
  AFTER INSERT ON public.community_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_favorite_community_on_first_join();

-- Also update existing users who don't have a favorite community set
-- but have joined communities
UPDATE public.user_stats us
SET favorite_community_id = (
  SELECT cm.community_id
  FROM public.community_memberships cm
  WHERE cm.user_id = us.user_id
  ORDER BY cm.joined_at ASC
  LIMIT 1
)
WHERE us.favorite_community_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.community_memberships cm
    WHERE cm.user_id = us.user_id
  );


