-- Create a secure function to track API usage
-- This function runs with SECURITY DEFINER (elevated privileges) but validates inputs
-- This is more secure than allowing service role to bypass RLS on the table directly

CREATE OR REPLACE FUNCTION public.track_api_usage(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_count integer;
  v_result jsonb;
BEGIN
  -- Validate that the user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Invalid user_id: %', p_user_id;
  END IF;
  
  v_today := CURRENT_DATE;
  
  -- Insert or update usage record
  INSERT INTO public.api_usage (user_id, date, query_count)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    query_count = api_usage.query_count + 1,
    updated_at = now()
  RETURNING query_count, date INTO v_count, v_today;
  
  -- Return as JSON
  v_result := jsonb_build_object(
    'query_count', v_count,
    'date', v_today
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.track_api_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_api_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_api_usage(uuid) TO anon;

-- Add comment
COMMENT ON FUNCTION public.track_api_usage(uuid) IS 'Securely tracks API usage for a user. Validates user exists and increments their daily query count.';



