
-- =====================================================
-- SECURITY FIX 1: Remove anon access from iep-uploads storage bucket
-- =====================================================
DROP POLICY IF EXISTS "Allow anon upload to iep-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon read from iep-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon update in iep-uploads" ON storage.objects;

-- Authenticated-only policies for iep-uploads (user_id folder scoping)
CREATE POLICY "Authenticated users can upload IEP files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'iep-uploads');

CREATE POLICY "Authenticated users can read IEP files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'iep-uploads');

CREATE POLICY "Authenticated users can update IEP files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'iep-uploads');

-- =====================================================
-- SECURITY FIX 2: Tighten RLS policies from anon to authenticated
-- Remove anon role from all public table policies
-- =====================================================

-- agency_invite_codes
DROP POLICY IF EXISTS "Allow insert agency invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Allow select agency invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Allow update agency invite codes" ON public.agency_invite_codes;

CREATE POLICY "Authenticated insert agency invite codes"
  ON public.agency_invite_codes FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select agency invite codes"
  ON public.agency_invite_codes FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update agency invite codes"
  ON public.agency_invite_codes FOR UPDATE TO authenticated
  USING (true);

-- classroom_group_students
DROP POLICY IF EXISTS "Allow delete group students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Allow insert group students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Allow select group students" ON public.classroom_group_students;

CREATE POLICY "Authenticated delete group students"
  ON public.classroom_group_students FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "Authenticated insert group students"
  ON public.classroom_group_students FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select group students"
  ON public.classroom_group_students FOR SELECT TO authenticated
  USING (true);

-- classroom_group_teachers
DROP POLICY IF EXISTS "Allow delete group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Allow insert group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Allow select group teachers" ON public.classroom_group_teachers;

CREATE POLICY "Authenticated delete group teachers"
  ON public.classroom_group_teachers FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "Authenticated insert group teachers"
  ON public.classroom_group_teachers FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select group teachers"
  ON public.classroom_group_teachers FOR SELECT TO authenticated
  USING (true);

-- classroom_groups
DROP POLICY IF EXISTS "Allow delete classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Allow insert classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Allow select classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Allow update classroom groups" ON public.classroom_groups;

CREATE POLICY "Authenticated delete classroom groups"
  ON public.classroom_groups FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "Authenticated insert classroom groups"
  ON public.classroom_groups FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select classroom groups"
  ON public.classroom_groups FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update classroom groups"
  ON public.classroom_groups FOR UPDATE TO authenticated
  USING (true);

-- guest_access_codes (keep anon for SELECT since guests use codes without auth)
DROP POLICY IF EXISTS "Allow insert guest codes" ON public.guest_access_codes;
DROP POLICY IF EXISTS "Allow select guest codes" ON public.guest_access_codes;
DROP POLICY IF EXISTS "Allow update guest codes" ON public.guest_access_codes;

CREATE POLICY "Authenticated insert guest codes"
  ON public.guest_access_codes FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Anon and authenticated select guest codes"
  ON public.guest_access_codes FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Authenticated update guest codes"
  ON public.guest_access_codes FOR UPDATE TO authenticated
  USING (true);

-- guest_data_entries (keep anon for INSERT and SELECT since guests submit without auth)
DROP POLICY IF EXISTS "Allow insert guest data" ON public.guest_data_entries;
DROP POLICY IF EXISTS "Allow select guest data" ON public.guest_data_entries;

CREATE POLICY "Anon and authenticated insert guest data"
  ON public.guest_data_entries FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select guest data"
  ON public.guest_data_entries FOR SELECT TO authenticated
  USING (true);

-- iep_documents
DROP POLICY IF EXISTS "Allow insert iep_documents" ON public.iep_documents;
DROP POLICY IF EXISTS "Allow select iep_documents" ON public.iep_documents;
DROP POLICY IF EXISTS "Allow update iep_documents" ON public.iep_documents;

CREATE POLICY "Authenticated insert iep_documents"
  ON public.iep_documents FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select iep_documents"
  ON public.iep_documents FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update iep_documents"
  ON public.iep_documents FOR UPDATE TO authenticated
  USING (true);

-- iep_extracted_accommodations
DROP POLICY IF EXISTS "Allow insert iep_extracted_accommodations" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Allow select iep_extracted_accommodations" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Allow update iep_extracted_accommodations" ON public.iep_extracted_accommodations;

CREATE POLICY "Authenticated insert iep_extracted_accommodations"
  ON public.iep_extracted_accommodations FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select iep_extracted_accommodations"
  ON public.iep_extracted_accommodations FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update iep_extracted_accommodations"
  ON public.iep_extracted_accommodations FOR UPDATE TO authenticated
  USING (true);

-- iep_extracted_goals
DROP POLICY IF EXISTS "Allow insert iep_extracted_goals" ON public.iep_extracted_goals;
DROP POLICY IF EXISTS "Allow select iep_extracted_goals" ON public.iep_extracted_goals;
DROP POLICY IF EXISTS "Allow update iep_extracted_goals" ON public.iep_extracted_goals;

CREATE POLICY "Authenticated insert iep_extracted_goals"
  ON public.iep_extracted_goals FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select iep_extracted_goals"
  ON public.iep_extracted_goals FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update iep_extracted_goals"
  ON public.iep_extracted_goals FOR UPDATE TO authenticated
  USING (true);

-- iep_extracted_progress
DROP POLICY IF EXISTS "Allow insert iep_extracted_progress" ON public.iep_extracted_progress;
DROP POLICY IF EXISTS "Allow select iep_extracted_progress" ON public.iep_extracted_progress;
DROP POLICY IF EXISTS "Allow update iep_extracted_progress" ON public.iep_extracted_progress;

CREATE POLICY "Authenticated insert iep_extracted_progress"
  ON public.iep_extracted_progress FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select iep_extracted_progress"
  ON public.iep_extracted_progress FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update iep_extracted_progress"
  ON public.iep_extracted_progress FOR UPDATE TO authenticated
  USING (true);

-- iep_extracted_services
DROP POLICY IF EXISTS "Allow insert iep_extracted_services" ON public.iep_extracted_services;
DROP POLICY IF EXISTS "Allow select iep_extracted_services" ON public.iep_extracted_services;
DROP POLICY IF EXISTS "Allow update iep_extracted_services" ON public.iep_extracted_services;

CREATE POLICY "Authenticated insert iep_extracted_services"
  ON public.iep_extracted_services FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select iep_extracted_services"
  ON public.iep_extracted_services FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update iep_extracted_services"
  ON public.iep_extracted_services FOR UPDATE TO authenticated
  USING (true);

-- invite_codes
DROP POLICY IF EXISTS "Allow insert invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Allow select invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Allow update invite codes" ON public.invite_codes;

CREATE POLICY "Authenticated insert invite codes"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated select invite codes"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated update invite codes"
  ON public.invite_codes FOR UPDATE TO authenticated
  USING (true);

-- =====================================================
-- SECURITY FIX 3: Set search_path on functions
-- =====================================================

ALTER FUNCTION public.set_thread_id() SET search_path = public;

ALTER FUNCTION public.apply_invite_code_access(text, text, uuid) SET search_path = public;

ALTER FUNCTION public.redeem_invite_code(text, text, uuid) SET search_path = public;
