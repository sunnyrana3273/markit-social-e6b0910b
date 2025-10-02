-- Create user_stats table
CREATE TABLE public.user_stats (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  lifetime_minutes_studied integer NOT NULL DEFAULT 0,
  lifetime_questions_answered integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  last_study_date date,
  favorite_community_id uuid REFERENCES public.course_communities(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own stats"
  ON public.user_stats
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
  ON public.user_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON public.user_stats
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize user stats with first community as favorite
CREATE OR REPLACE FUNCTION public.initialize_user_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  first_community uuid;
BEGIN
  -- Get the first community the user joined
  SELECT community_id INTO first_community
  FROM public.community_memberships
  WHERE user_id = NEW.id
  ORDER BY joined_at ASC
  LIMIT 1;

  -- Create user stats entry
  INSERT INTO public.user_stats (
    user_id,
    favorite_community_id
  )
  VALUES (
    NEW.id,
    first_community
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to create user stats when profile is created
CREATE TRIGGER on_profile_created_init_stats
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_stats();