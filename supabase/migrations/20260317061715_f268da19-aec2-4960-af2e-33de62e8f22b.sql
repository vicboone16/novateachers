
-- Clean up duplicate RLS policies on push_tokens
DROP POLICY IF EXISTS "Users can insert their own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can update their own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can view their own push tokens" ON public.push_tokens;

-- Clean up duplicate RLS policies on notification_preferences
DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
