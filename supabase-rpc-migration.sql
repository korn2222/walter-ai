-- Run ONLY this script in your Supabase SQL Editor
-- This adds the email check function without trying to recreate existing tables

CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = email_to_check);
END;
$$;
