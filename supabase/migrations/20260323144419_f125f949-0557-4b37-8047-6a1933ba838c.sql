-- Enable RLS on 3 tables that are currently unprotected
ALTER TABLE public.beacon_student_day_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beacon_teacher_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beacon_teacher_plans ENABLE ROW LEVEL SECURITY;

-- Add permissive policies (matching existing architectural pattern - auth via external Nova Core)
-- beacon_student_day_state
CREATE POLICY "Open read beacon_student_day_state" ON public.beacon_student_day_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert beacon_student_day_state" ON public.beacon_student_day_state FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update beacon_student_day_state" ON public.beacon_student_day_state FOR UPDATE TO anon, authenticated USING (true);

-- beacon_teacher_feedback
CREATE POLICY "Open read beacon_teacher_feedback" ON public.beacon_teacher_feedback FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert beacon_teacher_feedback" ON public.beacon_teacher_feedback FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update beacon_teacher_feedback" ON public.beacon_teacher_feedback FOR UPDATE TO anon, authenticated USING (true);

-- beacon_teacher_plans
CREATE POLICY "Open read beacon_teacher_plans" ON public.beacon_teacher_plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert beacon_teacher_plans" ON public.beacon_teacher_plans FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update beacon_teacher_plans" ON public.beacon_teacher_plans FOR UPDATE TO anon, authenticated USING (true);

-- Fix Security Definer Views by recreating with security_invoker = true
CREATE OR REPLACE VIEW public.v_classroom_staff_presence WITH (security_invoker = true) AS
SELECT id, agency_id, user_id, classroom_group_id, location_type, location_label, status, availability_status, available_for_support, assigned_student_id, note, updated_at
FROM staff_presence sp;

CREATE OR REPLACE VIEW public.v_available_support_staff WITH (security_invoker = true) AS
SELECT id, agency_id, user_id, classroom_group_id, location_type, location_label, status, availability_status, available_for_support, assigned_student_id, updated_at
FROM staff_presence sp
WHERE available_for_support = true AND availability_status = 'available' AND status NOT IN ('on_break', 'unavailable', 'off_site');

CREATE OR REPLACE VIEW public.v_beacon_current_day_state WITH (security_invoker = true) AS
SELECT DISTINCT ON (student_id) student_id, state_date, day_state, selected_by, classroom_id, notes, updated_at
FROM beacon_student_day_state
ORDER BY student_id, state_date DESC, updated_at DESC;

CREATE OR REPLACE VIEW public.v_beacon_current_teacher_plan WITH (security_invoker = true) AS
SELECT DISTINCT ON (student_id) student_id, plan_date, day_state, classroom_id, selected_program_ids, targets, antecedents, reactives, reinforcement, teacher_summary, created_by, updated_at
FROM beacon_teacher_plans
ORDER BY student_id, plan_date DESC, updated_at DESC;