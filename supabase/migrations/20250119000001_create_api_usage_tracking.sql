-- Create API usage tracking table for daily query limits
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  query_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON public.api_usage(date);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON public.api_usage(user_id, date);

-- Enable RLS
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own usage"
  ON public.api_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.api_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.api_usage
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_api_usage_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_api_usage_updated_at
  BEFORE UPDATE ON public.api_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_api_usage_updated_at();

-- Add comments
COMMENT ON TABLE public.api_usage IS 'Tracks daily API query usage per user for subscription plan limits';
COMMENT ON COLUMN public.api_usage.user_id IS 'The user who made the queries';
COMMENT ON COLUMN public.api_usage.date IS 'The date (YYYY-MM-DD) for which usage is tracked';
COMMENT ON COLUMN public.api_usage.query_count IS 'Number of queries made on this date';




