-- Create subscription redemptions table
CREATE TABLE IF NOT EXISTS public.subscription_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_type text CHECK (subscription_type IN ('plus', 'pro')) NOT NULL,
  knowledge_points_spent integer NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_redemptions_user_id ON public.subscription_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_redemptions_expires_at ON public.subscription_redemptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_redemptions_active ON public.subscription_redemptions(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.subscription_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own redemptions"
  ON public.subscription_redemptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own redemptions"
  ON public.subscription_redemptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to redeem subscription with knowledge points
CREATE OR REPLACE FUNCTION public.redeem_subscription(
  p_subscription_type text,
  p_knowledge_points_cost integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_current_points integer;
  v_expires_at timestamptz;
  v_redemption_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get current knowledge points
  SELECT knowledge_points INTO v_current_points
  FROM public.profiles
  WHERE id = v_user_id;

  -- Check if user has enough points
  IF v_current_points < p_knowledge_points_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient knowledge points',
      'current_points', v_current_points,
      'required_points', p_knowledge_points_cost
    );
  END IF;

  -- Calculate expiration date (1 month from now)
  v_expires_at := now() + interval '1 month';

  -- Deduct knowledge points
  UPDATE public.profiles
  SET knowledge_points = knowledge_points - p_knowledge_points_cost
  WHERE id = v_user_id;

  -- Create redemption record
  INSERT INTO public.subscription_redemptions (
    user_id,
    subscription_type,
    knowledge_points_spent,
    expires_at
  )
  VALUES (
    v_user_id,
    p_subscription_type,
    p_knowledge_points_cost,
    v_expires_at
  )
  RETURNING id INTO v_redemption_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'expires_at', v_expires_at,
    'remaining_points', v_current_points - p_knowledge_points_cost
  );
END;
$$;

-- Function to get user's active subscription
CREATE OR REPLACE FUNCTION public.get_active_subscription(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_subscription jsonb;
BEGIN
  SELECT jsonb_build_object(
    'subscription_type', subscription_type,
    'expires_at', expires_at,
    'created_at', created_at
  ) INTO v_subscription
  FROM public.subscription_redemptions
  WHERE user_id = p_user_id
    AND is_active = true
    AND expires_at > now()
  ORDER BY expires_at DESC
  LIMIT 1;

  RETURN COALESCE(v_subscription, 'null'::jsonb);
END;
$$;

-- Add comment
COMMENT ON TABLE public.subscription_redemptions IS 'Tracks subscription redemptions purchased with knowledge points';
COMMENT ON COLUMN public.subscription_redemptions.subscription_type IS 'Type of subscription: plus (300 KP) or pro (900 KP)';
COMMENT ON COLUMN public.subscription_redemptions.expires_at IS 'When the subscription expires (1 month from purchase)';





