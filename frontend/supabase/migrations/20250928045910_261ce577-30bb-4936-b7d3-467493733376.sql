-- MarkIt Database Schema - Add missing tables only
-- Skip profiles table as it already exists

-- Check if friends table exists, create if not
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friends') THEN
    CREATE TABLE public.friends (
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      friend_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      status text CHECK (status IN ('pending','accepted','blocked')) DEFAULT 'pending',
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (user_id, friend_id)
    );
    ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Study sessions (rooms for collaboration) 
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  ap_course text, -- e.g., 'AP Calculus AB', 'AP Physics 1'
  max_participants integer DEFAULT 10,
  voice_room_url text, -- Daily.co or similar
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Session participants
CREATE TABLE IF NOT EXISTS public.session_participants (
  session_id uuid REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  is_moderator boolean DEFAULT false,
  PRIMARY KEY (session_id, user_id)
);

-- Whiteboards (Excalidraw scenes)
CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  document_id uuid,
  title text NOT NULL DEFAULT 'Untitled Board',
  scene_data jsonb DEFAULT '{}',
  scene_version bigint DEFAULT 1,
  storage_path text, -- For snapshots
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI threads (Q&A anchored to board elements)
CREATE TABLE IF NOT EXISTS public.ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  element_id text, -- Excalidraw element ID
  question text NOT NULL,
  answer text,
  image_data text, -- Base64 cropped image
  model_used text DEFAULT 'gpt-4o-mini',
  tokens_input integer,
  tokens_output integer,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Activity feed for social features
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action_type text NOT NULL, -- session_created, ai_question, streak_updated, etc.
  target_type text, -- session, board, user
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Daily metrics for gamification
CREATE TABLE IF NOT EXISTS public.daily_metrics (
  user_id uuid REFERENCES auth.users(id),
  date date,
  minutes_studied integer DEFAULT 0,
  problems_completed integer DEFAULT 0,
  ai_questions_asked integer DEFAULT 0,
  sessions_joined integer DEFAULT 0,
  streak_day integer DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- User quotas for AI usage
CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  plan_type text DEFAULT 'free', -- free, plus, pro
  ai_queries_used integer DEFAULT 0,
  ai_queries_limit integer DEFAULT 20,
  storage_used bigint DEFAULT 0,
  storage_limit bigint DEFAULT 104857600, -- 100MB
  reset_date date DEFAULT CURRENT_DATE + interval '1 month',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friends (only if table was created)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friends') THEN
    DROP POLICY IF EXISTS "Users can view their friendships" ON public.friends;
    CREATE POLICY "Users can view their friendships" ON public.friends FOR SELECT 
      USING (auth.uid() = user_id OR auth.uid() = friend_id);
    
    DROP POLICY IF EXISTS "Users can manage their friendships" ON public.friends;
    CREATE POLICY "Users can manage their friendships" ON public.friends FOR ALL 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS Policies for study sessions
CREATE POLICY "Users can view public sessions or joined sessions" ON public.study_sessions FOR SELECT 
  USING (is_public = true OR auth.uid() = host_id OR 
         EXISTS(SELECT 1 FROM session_participants WHERE session_id = id AND user_id = auth.uid()));
CREATE POLICY "Users can update own sessions" ON public.study_sessions FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Users can create sessions" ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);

-- RLS Policies for session participants
CREATE POLICY "Participants can view session members" ON public.session_participants FOR SELECT 
  USING (EXISTS(SELECT 1 FROM session_participants sp WHERE sp.session_id = session_id AND sp.user_id = auth.uid()));
CREATE POLICY "Users can join sessions" ON public.session_participants FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave sessions" ON public.session_participants FOR DELETE 
  USING (auth.uid() = user_id OR 
         EXISTS(SELECT 1 FROM study_sessions WHERE id = session_id AND host_id = auth.uid()));

-- RLS Policies for boards
CREATE POLICY "Session members can view boards" ON public.boards FOR SELECT 
  USING (EXISTS(SELECT 1 FROM session_participants WHERE session_id = boards.session_id AND user_id = auth.uid()));
CREATE POLICY "Session members can edit boards" ON public.boards FOR ALL 
  USING (EXISTS(SELECT 1 FROM session_participants WHERE session_id = boards.session_id AND user_id = auth.uid()));

-- RLS Policies for AI threads
CREATE POLICY "Board viewers can see AI threads" ON public.ai_threads FOR SELECT 
  USING (EXISTS(SELECT 1 FROM boards b 
                JOIN session_participants sp ON b.session_id = sp.session_id 
                WHERE b.id = board_id AND sp.user_id = auth.uid()));
CREATE POLICY "Session members can create AI threads" ON public.ai_threads FOR INSERT 
  WITH CHECK (auth.uid() = created_by AND 
              EXISTS(SELECT 1 FROM boards b 
                     JOIN session_participants sp ON b.session_id = sp.session_id 
                     WHERE b.id = board_id AND sp.user_id = auth.uid()));

-- RLS Policies for activity feed
CREATE POLICY "Users can view friend activity" ON public.activity_feed FOR SELECT 
  USING (auth.uid() = actor_id OR true); -- Simplified for now
CREATE POLICY "Users can create their activity" ON public.activity_feed FOR INSERT 
  WITH CHECK (auth.uid() = actor_id);

-- RLS Policies for daily metrics
CREATE POLICY "Users can view own metrics" ON public.daily_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own metrics" ON public.daily_metrics FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for user quotas
CREATE POLICY "Users can view own quotas" ON public.user_quotas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own quotas" ON public.user_quotas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can create own quotas" ON public.user_quotas FOR INSERT WITH CHECK (auth.uid() = user_id);