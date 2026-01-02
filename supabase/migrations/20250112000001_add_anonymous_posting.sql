-- Add is_anonymous column to community_discussions
ALTER TABLE public.community_discussions 
ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;

-- Add is_anonymous column to community_discussion_replies
ALTER TABLE public.community_discussion_replies 
ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;

-- Add comments
COMMENT ON COLUMN public.community_discussions.is_anonymous IS 'Whether the discussion was posted anonymously';
COMMENT ON COLUMN public.community_discussion_replies.is_anonymous IS 'Whether the reply was posted anonymously';

    

