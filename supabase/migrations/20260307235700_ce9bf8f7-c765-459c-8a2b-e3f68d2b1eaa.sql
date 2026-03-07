
-- Fix RLS policies for Cloud tables that are accessed via anon role
-- (Auth lives on Core project, not Cloud, so auth.uid() is always null here)

-- ============ classroom_groups ============
DROP POLICY IF EXISTS "Authenticated users can insert classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Authenticated users can view classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Creators can delete classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Creators can update classroom groups" ON public.classroom_groups;

CREATE POLICY "Allow select classroom groups" ON public.classroom_groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert classroom groups" ON public.classroom_groups FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update classroom groups" ON public.classroom_groups FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow delete classroom groups" ON public.classroom_groups FOR DELETE TO anon, authenticated USING (true);

-- ============ classroom_group_teachers ============
DROP POLICY IF EXISTS "Authenticated users can view group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Group creator can add teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Group creator can remove teachers" ON public.classroom_group_teachers;

CREATE POLICY "Allow select group teachers" ON public.classroom_group_teachers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert group teachers" ON public.classroom_group_teachers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow delete group teachers" ON public.classroom_group_teachers FOR DELETE TO anon, authenticated USING (true);

-- ============ classroom_group_students ============
DROP POLICY IF EXISTS "Authenticated users can view group students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Group creator can add students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Group creator can remove students" ON public.classroom_group_students;

CREATE POLICY "Allow select group students" ON public.classroom_group_students FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert group students" ON public.classroom_group_students FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow delete group students" ON public.classroom_group_students FOR DELETE TO anon, authenticated USING (true);

-- ============ invite_codes ============
DROP POLICY IF EXISTS "Creators can insert invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Creators can read own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Creators can update own invite codes" ON public.invite_codes;

CREATE POLICY "Allow select invite codes" ON public.invite_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert invite codes" ON public.invite_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update invite codes" ON public.invite_codes FOR UPDATE TO anon, authenticated USING (true);

-- ============ guest_access_codes ============
DROP POLICY IF EXISTS "Creators manage guest codes" ON public.guest_access_codes;

CREATE POLICY "Allow select guest codes" ON public.guest_access_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert guest codes" ON public.guest_access_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update guest codes" ON public.guest_access_codes FOR UPDATE TO anon, authenticated USING (true);

-- ============ guest_data_entries ============
DROP POLICY IF EXISTS "Teachers read guest data" ON public.guest_data_entries;

CREATE POLICY "Allow select guest data" ON public.guest_data_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert guest data" ON public.guest_data_entries FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============ agency_invite_codes ============
DROP POLICY IF EXISTS "Creators can manage their invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Creators can read their invite codes" ON public.agency_invite_codes;

CREATE POLICY "Allow select agency invite codes" ON public.agency_invite_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert agency invite codes" ON public.agency_invite_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update agency invite codes" ON public.agency_invite_codes FOR UPDATE TO anon, authenticated USING (true);
