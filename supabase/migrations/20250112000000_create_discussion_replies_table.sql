-- Create discussion replies table
CREATE TABLE IF NOT EXISTS public.community_discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid REFERENCES public.community_discussions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_discussion_replies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view replies to discussions" ON public.community_discussion_replies;
DROP POLICY IF EXISTS "Members can create replies" ON public.community_discussion_replies;
DROP POLICY IF EXISTS "Users can update their own replies" ON public.community_discussion_replies;
DROP POLICY IF EXISTS "Users can delete their own replies" ON public.community_discussion_replies;

-- Create policies for replies
CREATE POLICY "Anyone can view replies to discussions"
ON public.community_discussion_replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_discussions cd
    JOIN public.community_memberships cm ON cm.community_id = cd.community_id
    WHERE cd.id = community_discussion_replies.discussion_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Members can create replies"
ON public.community_discussion_replies
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.community_discussions cd
    JOIN public.community_memberships cm ON cm.community_id = cd.community_id
    WHERE cd.id = discussion_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own replies"
ON public.community_discussion_replies
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies"
ON public.community_discussion_replies
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for faster queries (drop first if they exist)
DROP INDEX IF EXISTS idx_discussion_replies_discussion_id;
DROP INDEX IF EXISTS idx_discussion_replies_created_at;
CREATE INDEX idx_discussion_replies_discussion_id ON public.community_discussion_replies(discussion_id);
CREATE INDEX idx_discussion_replies_created_at ON public.community_discussion_replies(created_at DESC);

-- Enable realtime (ignore error if table already in publication)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_discussion_replies;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

