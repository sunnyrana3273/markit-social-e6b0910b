-- Create friend_messages table for direct messaging between friends
CREATE TABLE public.friend_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- Enable Row Level Security
ALTER TABLE public.friend_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they sent or received
CREATE POLICY "Users can view their own messages"
ON public.friend_messages
FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Users can send messages to their friends
CREATE POLICY "Users can send messages to friends"
ON public.friend_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.friends
    WHERE (
      (user_id = auth.uid() AND friend_id = receiver_id) OR
      (user_id = receiver_id AND friend_id = auth.uid())
    )
    AND status = 'accepted'
  )
);

-- Users can update (mark as read) messages sent to them
CREATE POLICY "Users can mark received messages as read"
ON public.friend_messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Create index for faster queries
CREATE INDEX idx_friend_messages_sender ON public.friend_messages(sender_id);
CREATE INDEX idx_friend_messages_receiver ON public.friend_messages(receiver_id);
CREATE INDEX idx_friend_messages_created_at ON public.friend_messages(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;