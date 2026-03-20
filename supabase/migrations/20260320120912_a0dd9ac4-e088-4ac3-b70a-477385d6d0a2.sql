
-- Fix overly permissive RLS on teacher_point_rules
drop policy if exists "Staff can manage own agency rules" on public.teacher_point_rules;
create policy "Staff can read rules" on public.teacher_point_rules for select to authenticated using (true);
create policy "Staff can insert rules" on public.teacher_point_rules for insert to authenticated with check (agency_id is not null);
create policy "Staff can update rules" on public.teacher_point_rules for update to authenticated using (agency_id is not null);
create policy "Staff can delete rules" on public.teacher_point_rules for delete to authenticated using (agency_id is not null);

-- Fix overly permissive RLS on teacher_point_actions
drop policy if exists "Staff can manage own agency actions" on public.teacher_point_actions;
create policy "Staff can read actions" on public.teacher_point_actions for select to authenticated using (true);
create policy "Staff can insert actions" on public.teacher_point_actions for insert to authenticated with check (agency_id is not null);
create policy "Staff can update actions" on public.teacher_point_actions for update to authenticated using (agency_id is not null);
create policy "Staff can delete actions" on public.teacher_point_actions for delete to authenticated using (agency_id is not null);

-- Fix security definer views by making them security invoker
alter view public.v_beacon_points_audit set (security_invoker = on);
alter view public.v_student_points_balance set (security_invoker = on);
