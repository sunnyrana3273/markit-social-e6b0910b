-- Create discussion votes table
CREATE TABLE IF NOT EXISTS public.community_discussion_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid REFERENCES public.community_discussions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type text CHECK (vote_type IN ('upvote', 'downvote')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(discussion_id, user_id)
);

-- Create reply votes table
CREATE TABLE IF NOT EXISTS public.community_reply_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid REFERENCES public.community_discussion_replies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type text CHECK (vote_type IN ('upvote', 'downvote')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(reply_id, user_id)
);

-- Enable RLS
ALTER TABLE public.community_discussion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reply_votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view discussion votes" ON public.community_discussion_votes;
DROP POLICY IF EXISTS "Users can vote on discussions" ON public.community_discussion_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON public.community_discussion_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON public.community_discussion_votes;
DROP POLICY IF EXISTS "Anyone can view reply votes" ON public.community_reply_votes;
DROP POLICY IF EXISTS "Users can vote on replies" ON public.community_reply_votes;
DROP POLICY IF EXISTS "Users can update their own reply votes" ON public.community_reply_votes;
DROP POLICY IF EXISTS "Users can delete their own reply votes" ON public.community_reply_votes;

-- Create policies for discussion votes
CREATE POLICY "Anyone can view discussion votes"
ON public.community_discussion_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_discussions cd
    JOIN public.community_memberships cm ON cm.community_id = cd.community_id
    WHERE cd.id = community_discussion_votes.discussion_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Members can vote on discussions"
ON public.community_discussion_votes
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

CREATE POLICY "Users can update their own votes"
ON public.community_discussion_votes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
ON public.community_discussion_votes
FOR DELETE
USING (auth.uid() = user_id);

-- Create policies for reply votes
CREATE POLICY "Anyone can view reply votes"
ON public.community_reply_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_discussion_replies cdr
    JOIN public.community_discussions cd ON cd.id = cdr.discussion_id
    JOIN public.community_memberships cm ON cm.community_id = cd.community_id
    WHERE cdr.id = community_reply_votes.reply_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Members can vote on replies"
ON public.community_reply_votes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.community_discussion_replies cdr
    JOIN public.community_discussions cd ON cd.id = cdr.discussion_id
    JOIN public.community_memberships cm ON cm.community_id = cd.community_id
    WHERE cdr.id = reply_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own reply votes"
ON public.community_reply_votes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reply votes"
ON public.community_reply_votes
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_discussion_votes_discussion_id ON public.community_discussion_votes(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_votes_user_id ON public.community_discussion_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_reply_votes_reply_id ON public.community_reply_votes(reply_id);
CREATE INDEX IF NOT EXISTS idx_reply_votes_user_id ON public.community_reply_votes(user_id);

-- Enable realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_discussion_votes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reply_votes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


