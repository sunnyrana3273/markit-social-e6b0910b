-- Enable realtime for community_discussions table
-- This allows Supabase Realtime subscriptions to listen for INSERT, UPDATE, and DELETE events
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_discussions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

