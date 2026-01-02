-- Create a function to sync user's plan from both KP redemptions and Stripe subscriptions
-- This ensures the user always has the highest plan with the latest expiration
-- Note: This function checks if subscription_redemptions table exists before using it

CREATE OR REPLACE FUNCTION public.sync_user_plan(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_best_plan text := 'free';
  v_best_expires_at timestamptz := NULL;
  v_kp_subscription RECORD;
  v_stripe_plan text;
  v_stripe_expires_at timestamptz;
  v_table_exists boolean;
BEGIN
  -- Check if subscription_redemptions table exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'subscription_redemptions'
  ) INTO v_table_exists;
  
  -- Get the best subscription from KP redemptions (if table exists)
  IF v_table_exists THEN
    SELECT subscription_type, expires_at
    INTO v_kp_subscription
    FROM public.subscription_redemptions
    WHERE user_id = p_user_id
      AND is_active = true
      AND expires_at > now()
    ORDER BY 
      CASE subscription_type
        WHEN 'pro' THEN 3
        WHEN 'plus' THEN 2
        ELSE 1
      END DESC,
      expires_at DESC
    LIMIT 1;
  END IF;

  -- Get plan from profiles (which may be set by Stripe webhooks)
  SELECT plan, plan_expires_at
  INTO v_stripe_plan, v_stripe_expires_at
  FROM public.profiles
  WHERE id = p_user_id;

  -- Determine the best plan
  -- Priority: pro > plus > free
  -- Use the plan with the latest expiration date
  
  IF v_kp_subscription IS NOT NULL THEN
    -- We have a KP redemption
    IF v_stripe_plan IS NOT NULL AND v_stripe_expires_at IS NOT NULL AND v_stripe_expires_at > now() THEN
      -- Compare KP redemption with Stripe subscription
      IF (v_stripe_plan = 'pro' AND v_kp_subscription.subscription_type != 'pro') OR
         (v_stripe_plan = 'pro' AND v_stripe_expires_at > v_kp_subscription.expires_at) OR
         (v_stripe_plan = 'plus' AND v_kp_subscription.subscription_type = 'plus' AND v_stripe_expires_at > v_kp_subscription.expires_at) THEN
        -- Stripe subscription is better
        v_best_plan := v_stripe_plan;
        v_best_expires_at := v_stripe_expires_at;
      ELSE
        -- KP redemption is better
        v_best_plan := v_kp_subscription.subscription_type;
        v_best_expires_at := v_kp_subscription.expires_at;
      END IF;
    ELSE
      -- No valid Stripe subscription, use KP redemption
      v_best_plan := v_kp_subscription.subscription_type;
      v_best_expires_at := v_kp_subscription.expires_at;
    END IF;
  ELSIF v_stripe_plan IS NOT NULL AND v_stripe_expires_at IS NOT NULL AND v_stripe_expires_at > now() THEN
    -- Only Stripe subscription available
    v_best_plan := v_stripe_plan;
    v_best_expires_at := v_stripe_expires_at;
  ELSE
    -- No active subscriptions, default to free
    v_best_plan := 'free';
    v_best_expires_at := NULL;
  END IF;

  -- Update the profile with the best plan
  UPDATE public.profiles
  SET 
    plan = v_best_plan,
    plan_expires_at = v_best_expires_at
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_best_plan,
    'expires_at', v_best_expires_at
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.sync_user_plan(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.sync_user_plan(uuid) IS 'Syncs user plan from both KP redemptions and Stripe subscriptions, using the highest plan with latest expiration';

-- Create trigger function (always create it, even if table doesn't exist yet)
CREATE OR REPLACE FUNCTION public.trigger_sync_plan_on_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only sync if the redemption is active and not expired
  IF NEW.is_active = true AND NEW.expires_at > now() THEN
    -- Sync plan after redemption is created or updated
    PERFORM public.sync_user_plan(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger only if the table exists
-- Note: If the subscription_redemptions table doesn't exist yet, 
-- you'll need to manually create this trigger after the table is created
DO $$
BEGIN
  -- Check if subscription_redemptions table exists before creating trigger
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'subscription_redemptions'
  ) THEN
    -- Drop trigger if it exists (using EXECUTE for DDL)
    EXECUTE 'DROP TRIGGER IF EXISTS sync_plan_on_redemption ON public.subscription_redemptions';
    
    -- Create trigger using EXECUTE (DDL statements need to be in EXECUTE within DO blocks)
    -- Note: The WHEN clause is handled inside the trigger function, so we don't need it here
    EXECUTE 'CREATE TRIGGER sync_plan_on_redemption AFTER INSERT OR UPDATE ON public.subscription_redemptions FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_plan_on_redemption()';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist, skip trigger creation
    NULL;
END;
$$;

