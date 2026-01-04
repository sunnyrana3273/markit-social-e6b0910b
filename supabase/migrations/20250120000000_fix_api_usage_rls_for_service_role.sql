-- Revert RLS policies to be more restrictive (users can only access their own records)
-- The track_api_usage() function now handles backend operations securely
-- This migration restores the original restrictive policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own usage" ON public.api_usage;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.api_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.api_usage;

-- Recreate restrictive policies - users can only access their own records
-- Backend operations now go through the track_api_usage() function which has SECURITY DEFINER
CREATE POLICY "Users can view their own usage"
  ON public.api_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.api_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.api_usage
  FOR UPDATE
  USING (auth.uid() = user_id);



