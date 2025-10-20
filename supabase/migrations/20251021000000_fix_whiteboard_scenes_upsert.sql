-- Add unique constraint to whiteboard_scenes session_id
-- This allows upsert to work properly (one scene per session)
ALTER TABLE whiteboard_scenes 
  DROP CONSTRAINT IF EXISTS whiteboard_scenes_session_id_key;

ALTER TABLE whiteboard_scenes 
  ADD CONSTRAINT whiteboard_scenes_session_id_key UNIQUE (session_id);

-- Update the RLS policy for UPDATE to include WITH CHECK clause
DROP POLICY IF EXISTS "Collaborators can update scenes" ON whiteboard_scenes;

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
  )
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

-- Add a policy for DELETE as well (in case we need it later)
CREATE POLICY "Hosts can delete scenes"
  ON whiteboard_scenes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whiteboard_sessions ws
      WHERE ws.id = whiteboard_scenes.session_id AND ws.host_user_id = auth.uid()
    )
  );

