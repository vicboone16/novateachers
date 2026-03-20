
-- Fix remaining authenticated-only SELECT policies to include anon

-- teacher_targets
DROP POLICY IF EXISTS "Staff can read targets" ON public.teacher_targets;
CREATE POLICY "Open read teacher_targets" ON public.teacher_targets FOR SELECT TO anon, authenticated USING (true);

-- guest_data_entries
DROP POLICY IF EXISTS "Authenticated select guest data" ON public.guest_data_entries;
CREATE POLICY "Open read guest_data_entries" ON public.guest_data_entries FOR SELECT TO anon, authenticated USING (true);

-- default_reminder_schedules (keep is_active filter)
DROP POLICY IF EXISTS "Authenticated users can view default reminder schedules" ON public.default_reminder_schedules;
CREATE POLICY "Open read default_reminder_schedules" ON public.default_reminder_schedules FOR SELECT TO anon, authenticated USING (true);

-- beacon_reinforcement_templates
DROP POLICY IF EXISTS "Anyone can read preset templates" ON public.beacon_reinforcement_templates;
CREATE POLICY "Open read beacon_reinforcement_templates" ON public.beacon_reinforcement_templates FOR SELECT TO anon, authenticated USING (true);

-- beacon_classroom_templates
DROP POLICY IF EXISTS "Anyone can read classroom templates" ON public.beacon_classroom_templates;
CREATE POLICY "Open read beacon_classroom_templates" ON public.beacon_classroom_templates FOR SELECT TO anon, authenticated USING (true);

-- beacon_points_ledger
DROP POLICY IF EXISTS "Authenticated can read agency points" ON public.beacon_points_ledger;
CREATE POLICY "Open read beacon_points_ledger" ON public.beacon_points_ledger FOR SELECT TO anon, authenticated USING (true);

-- mayday_contacts
DROP POLICY IF EXISTS "Authenticated can read mayday contacts" ON public.mayday_contacts;
CREATE POLICY "Open read mayday_contacts" ON public.mayday_contacts FOR SELECT TO anon, authenticated USING (true);

-- teacher_point_rules
DROP POLICY IF EXISTS "Staff can read rules" ON public.teacher_point_rules;
CREATE POLICY "Open read teacher_point_rules" ON public.teacher_point_rules FOR SELECT TO anon, authenticated USING (true);

-- teacher_point_actions
DROP POLICY IF EXISTS "Staff can read actions" ON public.teacher_point_actions;
CREATE POLICY "Open read teacher_point_actions" ON public.teacher_point_actions FOR SELECT TO anon, authenticated USING (true);

-- Also fix authenticated-only INSERT/UPDATE/DELETE policies for remaining tables
-- mayday_contacts
DROP POLICY IF EXISTS "Authenticated can insert mayday contacts" ON public.mayday_contacts;
CREATE POLICY "Open insert mayday_contacts" ON public.mayday_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can update mayday contacts" ON public.mayday_contacts;
CREATE POLICY "Open update mayday_contacts" ON public.mayday_contacts FOR UPDATE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can delete mayday contacts" ON public.mayday_contacts;
CREATE POLICY "Open delete mayday_contacts" ON public.mayday_contacts FOR DELETE TO anon, authenticated USING (true);

-- teacher_point_rules
DROP POLICY IF EXISTS "Staff can insert rules" ON public.teacher_point_rules;
CREATE POLICY "Open insert teacher_point_rules" ON public.teacher_point_rules FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Staff can update rules" ON public.teacher_point_rules;
CREATE POLICY "Open update teacher_point_rules" ON public.teacher_point_rules FOR UPDATE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Staff can delete rules" ON public.teacher_point_rules;
CREATE POLICY "Open delete teacher_point_rules" ON public.teacher_point_rules FOR DELETE TO anon, authenticated USING (true);

-- teacher_point_actions
DROP POLICY IF EXISTS "Staff can insert actions" ON public.teacher_point_actions;
CREATE POLICY "Open insert teacher_point_actions" ON public.teacher_point_actions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Staff can update actions" ON public.teacher_point_actions;
CREATE POLICY "Open update teacher_point_actions" ON public.teacher_point_actions FOR UPDATE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Staff can delete actions" ON public.teacher_point_actions;
CREATE POLICY "Open delete teacher_point_actions" ON public.teacher_point_actions FOR DELETE TO anon, authenticated USING (true);
