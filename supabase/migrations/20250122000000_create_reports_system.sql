-- Create reports table for posts and replies
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text CHECK (content_type IN ('post', 'reply')) NOT NULL,
  content_id uuid NOT NULL, -- References community_discussions.id or community_discussion_replies.id
  reporter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL, -- Selected reason from questionnaire
  details text, -- Optional additional details
  created_at timestamptz DEFAULT now(),
  UNIQUE(content_type, content_id, reporter_id) -- Prevent duplicate reports from same user
);

-- Add status columns to community_discussions
ALTER TABLE public.community_discussions 
ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS removed_at timestamptz,
ADD COLUMN IF NOT EXISTS report_count integer DEFAULT 0;

-- Add status columns to community_discussion_replies
ALTER TABLE public.community_discussion_replies 
ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS removed_at timestamptz,
ADD COLUMN IF NOT EXISTS report_count integer DEFAULT 0;

-- Add review status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_under_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS review_started_at timestamptz;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_content_reports_content_type_id ON public.content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_id ON public.content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_discussions_is_removed ON public.community_discussions(is_removed);
CREATE INDEX IF NOT EXISTS idx_replies_is_removed ON public.community_discussion_replies(is_removed);
CREATE INDEX IF NOT EXISTS idx_profiles_is_under_review ON public.profiles(is_under_review);

-- Enable RLS on content_reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view reports for content they can see" ON public.content_reports;
DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;

-- Policy: Users can view reports (for transparency, but they can only see their own reports or aggregate counts)
CREATE POLICY "Users can view their own reports"
ON public.content_reports
FOR SELECT
USING (auth.uid() = reporter_id);

-- Policy: Users can create reports
CREATE POLICY "Users can create reports"
ON public.content_reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_id AND
  -- Ensure reporter is not reporting their own content
  (
    (content_type = 'post' AND NOT EXISTS (
      SELECT 1 FROM public.community_discussions 
      WHERE id = content_id AND user_id = auth.uid()
    )) OR
    (content_type = 'reply' AND NOT EXISTS (
      SELECT 1 FROM public.community_discussion_replies 
      WHERE id = content_id AND user_id = auth.uid()
    ))
  )
);

-- Function to handle report count and auto-removal
CREATE OR REPLACE FUNCTION public.handle_content_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_report_count integer;
  content_user_id uuid;
  threshold_count integer := 5;
BEGIN
  -- Increment report count and check if threshold is reached
  IF NEW.content_type = 'post' THEN
    -- Update report count
    UPDATE public.community_discussions
    SET report_count = report_count + 1
    WHERE id = NEW.content_id
    RETURNING user_id, report_count INTO content_user_id, current_report_count;
    
    -- If threshold reached, remove the post and block the user
    IF current_report_count >= threshold_count THEN
      UPDATE public.community_discussions
      SET is_removed = true, removed_at = now()
      WHERE id = NEW.content_id;
      
      -- Block the user from posting
      UPDATE public.profiles
      SET is_under_review = true, review_started_at = now()
      WHERE id = content_user_id AND is_under_review = false;
    END IF;
    
  ELSIF NEW.content_type = 'reply' THEN
    -- Update report count
    UPDATE public.community_discussion_replies
    SET report_count = report_count + 1
    WHERE id = NEW.content_id
    RETURNING user_id, report_count INTO content_user_id, current_report_count;
    
    -- If threshold reached, remove the reply and block the user
    IF current_report_count >= threshold_count THEN
      UPDATE public.community_discussion_replies
      SET is_removed = true, removed_at = now()
      WHERE id = NEW.content_id;
      
      -- Block the user from posting
      UPDATE public.profiles
      SET is_under_review = true, review_started_at = now()
      WHERE id = content_user_id AND is_under_review = false;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to handle report processing
CREATE TRIGGER trigger_handle_content_report
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_content_report();

-- Add comments
COMMENT ON TABLE public.content_reports IS 'Reports submitted by users for inappropriate content';
COMMENT ON COLUMN public.content_reports.content_type IS 'Type of content: post or reply';
COMMENT ON COLUMN public.content_reports.content_id IS 'ID of the post or reply being reported';
COMMENT ON COLUMN public.content_reports.reason IS 'Selected reason for the report';
COMMENT ON COLUMN public.content_reports.details IS 'Optional additional details provided by reporter';
COMMENT ON COLUMN public.community_discussions.is_removed IS 'Whether the discussion has been removed due to reports';
COMMENT ON COLUMN public.community_discussions.removed_at IS 'When the discussion was removed';
COMMENT ON COLUMN public.community_discussions.report_count IS 'Number of reports received for this discussion';
COMMENT ON COLUMN public.community_discussion_replies.is_removed IS 'Whether the reply has been removed due to reports';
COMMENT ON COLUMN public.community_discussion_replies.removed_at IS 'When the reply was removed';
COMMENT ON COLUMN public.community_discussion_replies.report_count IS 'Number of reports received for this reply';
COMMENT ON COLUMN public.profiles.is_under_review IS 'Whether the user is currently under review and blocked from posting';
COMMENT ON COLUMN public.profiles.review_started_at IS 'When the review period started';


