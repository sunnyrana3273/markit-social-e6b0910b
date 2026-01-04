-- Update redeem_subscription function to also update profiles.plan and plan_expires_at
-- This ensures KP redemptions actually change the user's plan, not just create a record

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
  v_current_plan text;
  v_current_expires_at timestamptz;
  v_new_plan text;
  v_new_expires_at timestamptz;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Validate subscription type
  IF p_subscription_type NOT IN ('plus', 'pro') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription type. Must be "plus" or "pro"');
  END IF;

  -- Get current knowledge points and plan
  SELECT knowledge_points, plan, plan_expires_at
  INTO v_current_points, v_current_plan, v_current_expires_at
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

  -- Determine the new plan and expiration
  -- Priority: pro > plus > free
  -- If user already has a higher plan that expires later, keep it
  -- Otherwise, upgrade to the redeemed plan
  IF v_current_plan = 'pro' AND v_current_expires_at IS NOT NULL AND v_current_expires_at > v_expires_at THEN
    -- User already has pro plan that expires later, keep it
    v_new_plan := 'pro';
    v_new_expires_at := v_current_expires_at;
  ELSIF p_subscription_type = 'pro' THEN
    -- Redeeming pro - always upgrade to pro
    v_new_plan := 'pro';
    v_new_expires_at := v_expires_at;
  ELSIF p_subscription_type = 'plus' AND (v_current_plan = 'free' OR v_current_expires_at IS NULL OR v_current_expires_at < now()) THEN
    -- Redeeming plus and user is on free or expired plan - upgrade to plus
    v_new_plan := 'plus';
    v_new_expires_at := v_expires_at;
  ELSIF p_subscription_type = 'plus' AND v_current_plan = 'plus' AND v_current_expires_at IS NOT NULL AND v_current_expires_at > now() THEN
    -- User already has plus, extend expiration
    v_new_plan := 'plus';
    v_new_expires_at := GREATEST(v_current_expires_at, v_expires_at);
  ELSE
    -- Default: use the redeemed plan
    v_new_plan := p_subscription_type;
    v_new_expires_at := v_expires_at;
  END IF;

  -- Deduct knowledge points
  UPDATE public.profiles
  SET knowledge_points = knowledge_points - p_knowledge_points_cost
  WHERE id = v_user_id;

  -- Update user's plan and expiration in profiles table
  UPDATE public.profiles
  SET 
    plan = v_new_plan,
    plan_expires_at = v_new_expires_at
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

  -- Return success with updated plan info
  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'expires_at', v_new_expires_at,
    'plan', v_new_plan,
    'remaining_points', v_current_points - p_knowledge_points_cost
  );
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.redeem_subscription(text, integer) IS 'Redeems a subscription using knowledge points. Updates both subscription_redemptions and profiles.plan/plan_expires_at. Handles plan upgrades and extensions.';


