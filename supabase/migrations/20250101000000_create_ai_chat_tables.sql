-- Create AI chat sessions table
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id UUID, -- Optional: link to document/file
  title TEXT, -- Optional: user-provided title
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create AI chat messages table
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_order INTEGER NOT NULL DEFAULT 0 -- Order within session
);

-- Enable Row Level Security
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_sessions
CREATE POLICY "Users can view their own chat sessions"
ON public.ai_chat_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions"
ON public.ai_chat_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
ON public.ai_chat_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
ON public.ai_chat_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for ai_chat_messages
CREATE POLICY "Users can view messages from their sessions"
ON public.ai_chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ai_chat_sessions
    WHERE ai_chat_sessions.id = ai_chat_messages.session_id
    AND ai_chat_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages to their sessions"
ON public.ai_chat_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_chat_sessions
    WHERE ai_chat_sessions.id = ai_chat_messages.session_id
    AND ai_chat_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update messages in their sessions"
ON public.ai_chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.ai_chat_sessions
    WHERE ai_chat_sessions.id = ai_chat_messages.session_id
    AND ai_chat_sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete messages from their sessions"
ON public.ai_chat_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.ai_chat_sessions
    WHERE ai_chat_sessions.id = ai_chat_messages.session_id
    AND ai_chat_sessions.user_id = auth.uid()
  )
);

-- Create indexes for better query performance
CREATE INDEX idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_file_id ON public.ai_chat_sessions(file_id);
CREATE INDEX idx_ai_chat_sessions_created_at ON public.ai_chat_sessions(created_at DESC);
CREATE INDEX idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX idx_ai_chat_messages_message_order ON public.ai_chat_messages(session_id, message_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ai_chat_sessions
  SET updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at when messages are added
CREATE TRIGGER update_ai_chat_sessions_on_message
AFTER INSERT ON public.ai_chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_ai_chat_sessions_updated_at();

