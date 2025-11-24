-- Add attachment fields to community_discussions
ALTER TABLE public.community_discussions 
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_type text,
ADD COLUMN IF NOT EXISTS attachment_name text;

-- Add attachment fields to community_discussion_replies
ALTER TABLE public.community_discussion_replies 
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_type text,
ADD COLUMN IF NOT EXISTS attachment_name text;

-- Add comments
COMMENT ON COLUMN public.community_discussions.attachment_url IS 'URL to the attached file in storage';
COMMENT ON COLUMN public.community_discussions.attachment_type IS 'MIME type of the attachment (e.g., image/png, application/pdf)';
COMMENT ON COLUMN public.community_discussions.attachment_name IS 'Original filename of the attachment';
COMMENT ON COLUMN public.community_discussion_replies.attachment_url IS 'URL to the attached file in storage';
COMMENT ON COLUMN public.community_discussion_replies.attachment_type IS 'MIME type of the attachment (e.g., image/png, application/pdf)';
COMMENT ON COLUMN public.community_discussion_replies.attachment_name IS 'Original filename of the attachment';

