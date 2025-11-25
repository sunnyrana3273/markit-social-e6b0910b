-- Create study_groups table
CREATE TABLE IF NOT EXISTS public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create study_group_members table
CREATE TABLE IF NOT EXISTS public.study_group_members (
  study_group_id uuid REFERENCES public.study_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (study_group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for study_groups
DROP POLICY IF EXISTS "Users can view all study groups" ON public.study_groups;
CREATE POLICY "Users can view all study groups"
  ON public.study_groups
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create study groups" ON public.study_groups;
CREATE POLICY "Users can create study groups"
  ON public.study_groups
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group creators can update their groups" ON public.study_groups;
CREATE POLICY "Group creators can update their groups"
  ON public.study_groups
  FOR UPDATE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group creators can delete their groups" ON public.study_groups;
CREATE POLICY "Group creators can delete their groups"
  ON public.study_groups
  FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for study_group_members
DROP POLICY IF EXISTS "Users can view all study group members" ON public.study_group_members;
CREATE POLICY "Users can view all study group members"
  ON public.study_group_members
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can join study groups" ON public.study_group_members;
CREATE POLICY "Users can join study groups"
  ON public.study_group_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave study groups" ON public.study_group_members;
CREATE POLICY "Users can leave study groups"
  ON public.study_group_members
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to check minimum members requirement
CREATE OR REPLACE FUNCTION public.check_min_study_group_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  member_count integer;
BEGIN
  -- Count members after this insert
  SELECT COUNT(*) INTO member_count
  FROM public.study_group_members
  WHERE study_group_id = NEW.study_group_id;
  
  -- If this is the first member being added and it's less than 3, allow it
  -- But we'll enforce the minimum in the application layer
  RETURN NEW;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_study_group_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_study_groups_updated_at ON public.study_groups;
CREATE TRIGGER update_study_groups_updated_at
  BEFORE UPDATE ON public.study_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_study_group_updated_at();

