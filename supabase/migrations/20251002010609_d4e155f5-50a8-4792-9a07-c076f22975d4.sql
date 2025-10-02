-- Create course communities table
CREATE TABLE public.course_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name text NOT NULL,
  course_category text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create community memberships table
CREATE TABLE public.community_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES public.course_communities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Create community discussions table
CREATE TABLE public.community_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES public.course_communities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create community resources table
CREATE TABLE public.community_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES public.course_communities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  resource_url text,
  resource_type text DEFAULT 'link',
  created_at timestamptz DEFAULT now()
);

-- Create community presence table (who's studying now)
CREATE TABLE public.community_presence (
  community_id uuid REFERENCES public.course_communities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_seen timestamptz DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

-- Enable RLS
ALTER TABLE public.course_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_communities
CREATE POLICY "Anyone can view communities"
  ON public.course_communities FOR SELECT
  USING (true);

-- RLS Policies for community_memberships
CREATE POLICY "Users can join communities"
  ON public.community_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view memberships"
  ON public.community_memberships FOR SELECT
  USING (true);

CREATE POLICY "Users can leave communities"
  ON public.community_memberships FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for community_discussions
CREATE POLICY "Members can create discussions"
  ON public.community_discussions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.community_memberships
      WHERE community_id = community_discussions.community_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view discussions"
  ON public.community_discussions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_memberships
      WHERE community_id = community_discussions.community_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own discussions"
  ON public.community_discussions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own discussions"
  ON public.community_discussions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for community_resources
CREATE POLICY "Members can add resources"
  ON public.community_resources FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.community_memberships
      WHERE community_id = community_resources.community_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view resources"
  ON public.community_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_memberships
      WHERE community_id = community_resources.community_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own resources"
  ON public.community_resources FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for community_presence
CREATE POLICY "Users can update own presence"
  ON public.community_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update presence"
  ON public.community_presence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Members can view presence"
  ON public.community_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_memberships
      WHERE community_id = community_presence.community_id
      AND user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_community_discussions_updated_at
  BEFORE UPDATE ON public.community_discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial communities based on existing courses
INSERT INTO public.course_communities (course_name, course_category, description)
VALUES
  ('AP Calculus AB', 'Math and Computer Science', 'Community for AP Calculus AB students'),
  ('AP Calculus BC', 'Math and Computer Science', 'Community for AP Calculus BC students'),
  ('AP Computer Science A', 'Math and Computer Science', 'Community for AP Computer Science A students'),
  ('AP Computer Science Principles', 'Math and Computer Science', 'Community for AP Computer Science Principles students'),
  ('AP Precalculus', 'Math and Computer Science', 'Community for AP Precalculus students'),
  ('AP Statistics', 'Math and Computer Science', 'Community for AP Statistics students'),
  ('AP Biology', 'Sciences', 'Community for AP Biology students'),
  ('AP Chemistry', 'Sciences', 'Community for AP Chemistry students'),
  ('AP Environmental Science', 'Sciences', 'Community for AP Environmental Science students'),
  ('AP Physics 1: Algebra-Based', 'Sciences', 'Community for AP Physics 1 students'),
  ('AP Physics 2: Algebra-Based', 'Sciences', 'Community for AP Physics 2 students'),
  ('AP Physics C: Electricity and Magnetism', 'Sciences', 'Community for AP Physics C E&M students'),
  ('AP Physics C: Mechanics', 'Sciences', 'Community for AP Physics C Mechanics students'),
  ('SAT Math', 'SAT Prep', 'Community for SAT Math preparation'),
  ('SAT Reading and Writing', 'SAT Prep', 'Community for SAT Reading and Writing preparation');