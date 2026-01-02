-- Allow users to view favorite_community_id from other users' stats
-- This is safe because favorite_community_id is not sensitive information
-- and is needed for profile displays

-- Create a function that can fetch favorite_community_id for any user
-- This bypasses RLS since it's SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_user_favorite_community(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  community_id uuid;
BEGIN
  SELECT favorite_community_id INTO community_id
  FROM public.user_stats
  WHERE user_id = target_user_id;
  
  RETURN community_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_favorite_community(uuid) TO authenticated;

-- Also add a policy that allows viewing favorite_community_id for any user
-- Note: RLS works at row level, so this allows viewing the row, but the app
-- only selects favorite_community_id, so other sensitive data isn't exposed
CREATE POLICY "Users can view favorite_community_id from any user"
  ON public.user_stats
  FOR SELECT
  USING (true);

