-- Add profile visibility setting to profiles table
-- Controls whether user profiles are viewable in communities and discussions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_visible_in_communities boolean DEFAULT true NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.profile_visible_in_communities IS 'If true, profile is viewable and clickable in communities and discussions. If false, names are not clickable. Always visible in friends tab.';


