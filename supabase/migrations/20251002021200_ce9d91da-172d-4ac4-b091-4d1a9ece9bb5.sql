-- Add username column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE;

-- Add index for faster lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Add comment
COMMENT ON COLUMN public.profiles.username IS 'Unique username for friend system and identification';