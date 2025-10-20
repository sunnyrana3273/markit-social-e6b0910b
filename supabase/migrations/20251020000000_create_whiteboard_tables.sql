-- Create whiteboard_sessions table
CREATE TABLE IF NOT EXISTS whiteboard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  course_id UUID,
  host_user_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create whiteboard_scenes table to store Excalidraw scene data
CREATE TABLE IF NOT EXISTS whiteboard_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES whiteboard_sessions(id) ON DELETE CASCADE,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  app_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create whiteboard_collaborators table for presence tracking
CREATE TABLE IF NOT EXISTS whiteboard_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES whiteboard_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  cursor_position JSONB,
  color VARCHAR(7) NOT NULL,
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE whiteboard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies for whiteboard_sessions
CREATE POLICY "Users can view sessions they're part of"
  ON whiteboard_sessions FOR SELECT
  TO authenticated
  USING (
    host_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM whiteboard_collaborators
      WHERE session_id = whiteboard_sessions.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sessions"
  ON whiteboard_sessions FOR INSERT
  TO authenticated
  WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "Hosts can update their sessions"
  ON whiteboard_sessions FOR UPDATE
  TO authenticated
  USING (host_user_id = auth.uid());

-- Policies for whiteboard_scenes
CREATE POLICY "Collaborators can view scenes"
  ON whiteboard_scenes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whiteboard_sessions ws
      WHERE ws.id = whiteboard_scenes.session_id AND (
        ws.host_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM whiteboard_collaborators
          WHERE session_id = ws.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Collaborators can insert scenes"
  ON whiteboard_scenes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whiteboard_sessions ws
      WHERE ws.id = whiteboard_scenes.session_id AND (
        ws.host_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM whiteboard_collaborators
          WHERE session_id = ws.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Collaborators can update scenes"
  ON whiteboard_scenes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whiteboard_sessions ws
      WHERE ws.id = whiteboard_scenes.session_id AND (
        ws.host_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM whiteboard_collaborators
          WHERE session_id = ws.id AND user_id = auth.uid()
        )
      )
    )
  );

-- Policies for whiteboard_collaborators
CREATE POLICY "Collaborators can view other collaborators"
  ON whiteboard_collaborators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whiteboard_sessions ws
      WHERE ws.id = whiteboard_collaborators.session_id AND (
        ws.host_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM whiteboard_collaborators wc2
          WHERE wc2.session_id = ws.id AND wc2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert their own collaborator record"
  ON whiteboard_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own collaborator record"
  ON whiteboard_collaborators FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE whiteboard_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE whiteboard_scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE whiteboard_collaborators;

-- Create indexes for better query performance
CREATE INDEX idx_whiteboard_sessions_host ON whiteboard_sessions(host_user_id);
CREATE INDEX idx_whiteboard_scenes_session ON whiteboard_scenes(session_id);
CREATE INDEX idx_whiteboard_collaborators_session ON whiteboard_collaborators(session_id);
CREATE INDEX idx_whiteboard_collaborators_user ON whiteboard_collaborators(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_whiteboard_sessions_updated_at BEFORE UPDATE ON whiteboard_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whiteboard_scenes_updated_at BEFORE UPDATE ON whiteboard_scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

