ALTER FUNCTION public.update_thread_last_message() SET search_path = public;

-- These privileged Cloud routines are not called by the frontend. Invite
-- management in the app uses Nova Core; Cloud execution is server-only.
REVOKE EXECUTE ON FUNCTION public.apply_invite_code_access(text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_invite_code(uuid,text,uuid,timestamp with time zone,text,integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_invite_code(text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.override_reward_price(uuid,uuid,integer,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restock_reward_inventory(uuid,uuid,integer,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_game_event_from_ledger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_student_xp_on_points() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_invite_code_access(text,text,uuid), public.create_invite_code(uuid,text,uuid,timestamp with time zone,text,integer,text,text), public.redeem_invite_code(text,text,uuid), public.override_reward_price(uuid,uuid,integer,uuid,text), public.restock_reward_inventory(uuid,uuid,integer,uuid,uuid), public.handle_new_user_notification_preferences(), public.auto_game_event_from_ledger(), public.update_student_xp_on_points() TO service_role;

ALTER VIEW public.v_staff_engagement SET (security_invoker = true);
ALTER VIEW public.v_help_progress SET (security_invoker = true);
ALTER VIEW public.v_open_reinforcement_ai_recommendations SET (security_invoker = true);
ALTER VIEW public.v_launch_readiness_score SET (security_invoker = true);
ALTER VIEW public.v_classroom_team_scores SET (security_invoker = true);