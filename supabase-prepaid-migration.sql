-- PREPAID SUBSCRIPTIONS TABLE
-- Stores subscription info for users who haven't signed up yet
CREATE TABLE IF NOT EXISTS public.prepaid_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for prepaid_subscriptions (Service Role only usually, but let's be safe)
ALTER TABLE public.prepaid_subscriptions ENABLE ROW LEVEL SECURITY;
-- No public policies needed as this is backend-only access usually.

-- UPDATE HANDLE_NEW_USER FUNCTION
-- Checks if a new user has a prepaid subscription and syncs it
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  prepaid_record public.prepaid_subscriptions%ROWTYPE;
BEGIN
  -- Insert the basic profile first
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'User'));

  -- Check for prepaid subscription
  SELECT * INTO prepaid_record FROM public.prepaid_subscriptions WHERE email = NEW.email;

  IF FOUND THEN
    -- Update the new profile with subscription data
    UPDATE public.profiles
    SET 
      stripe_customer_id = prepaid_record.stripe_customer_id,
      subscription_id = prepaid_record.subscription_id,
      subscription_status = prepaid_record.subscription_status,
      current_period_end = prepaid_record.current_period_end
    WHERE id = NEW.id;

    -- Optional: Delete the prepaid record after claiming? 
    -- Keeping it strictly might be better for audit, but let's delete to prevent double claiming (though unique email prevents that mostly)
    -- Let's keep it for now or maybe mark as claimed. For simplicity, we'll leave it.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
