-- Add role, plan, and plan_expires_at columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin'));

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free' NOT NULL CHECK (plan IN ('free', 'plus', 'pro'));

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz NULL;

-- Add comments
COMMENT ON COLUMN public.profiles.role IS 'User role: user (regular user) or admin (administrator with all features)';
COMMENT ON COLUMN public.profiles.plan IS 'Subscription plan: free, plus, or pro';
COMMENT ON COLUMN public.profiles.plan_expires_at IS 'When the subscription plan expires. NULL for free plans or lifetime subscriptions.';

-- Update handle_new_user function to set default role and plan
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    image_url,
    role,
    plan
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'given_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    'user',
    'free'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    image_url = COALESCE(EXCLUDED.image_url, profiles.image_url),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Migrate data from subscription_redemptions to profiles (if table exists)
-- This will set plan and plan_expires_at for users with active subscriptions
-- If the table doesn't exist, this block will be skipped gracefully
DO $$
DECLARE
  v_user_record RECORD;
  v_active_subscription RECORD;
  v_table_exists boolean;
BEGIN
  -- Check if subscription_redemptions table exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'subscription_redemptions'
  ) INTO v_table_exists;
  
  -- Only migrate if the table exists
  IF v_table_exists THEN
    -- Loop through all users
    FOR v_user_record IN SELECT id FROM public.profiles LOOP
      BEGIN
        -- Find the highest active subscription for this user
        SELECT 
          subscription_type,
          expires_at
        INTO v_active_subscription
        FROM public.subscription_redemptions
        WHERE user_id = v_user_record.id
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
        
        -- If user has an active subscription, update their profile
        IF v_active_subscription IS NOT NULL THEN
          UPDATE public.profiles
          SET 
            plan = v_active_subscription.subscription_type,
            plan_expires_at = v_active_subscription.expires_at
          WHERE id = v_user_record.id;
        END IF;
      EXCEPTION
        WHEN undefined_table THEN
          -- Table doesn't exist, skip this user
          NULL;
      END;
    END LOOP;
  END IF;
END;
$$;




