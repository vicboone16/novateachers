
DROP VIEW IF EXISTS public.v_staff_engagement;
CREATE VIEW public.v_staff_engagement AS
SELECT
  s.user_id,
  s.agency_id,
  s.first_login_at,
  s.welcome_dismissed,
  s.walkthrough_completed,
  s.first_action_completed,
  s.first_action_at,
  s.last_active_at,
  s.onboarding_day,
  s.total_actions,
  COALESCE(week_acts.actions_this_week, 0) AS actions_this_week,
  CASE
    WHEN s.first_action_completed AND s.last_active_at > now() - interval '2 days' THEN 'active'
    WHEN s.first_login_at IS NOT NULL THEN 'started'
    ELSE 'needs_support'
  END AS status
FROM public.staff_onboarding s
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS actions_this_week
  FROM public.staff_activity_log a2
  WHERE a2.user_id = s.user_id
    AND a2.created_at > now() - interval '7 days'
) week_acts ON true;
