-- Create discussion interactions table to track unique user interactions
CREATE TABLE IF NOT EXISTS public.community_discussion_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid REFERENCES public.community_discussions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(discussion_id, user_id)
);

-- Enable RLS
ALTER TABLE public.community_discussion_interactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view interaction counts" ON public.community_discussion_interactions;
DROP POLICY IF EXISTS "Users can create their own interactions" ON public.community_discussion_interactions;

-- Create policies
CREATE POLICY "Anyone can view interaction counts"
ON public.community_discussion_interactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_discussions cd
    JOIN public.community_memberships cm ON cm.community_id = cd.community_id
    WHERE cd.id = community_discussion_interactions.discussion_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own interactions"
ON public.community_discussion_interactions
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_discussion_interactions_discussion_id ON public.community_discussion_interactions(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_interactions_user_id ON public.community_discussion_interactions(user_id);


