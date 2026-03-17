
-- ============================================================
-- 1. CLASSROOM_GROUPS: Replace overly permissive policies
-- ============================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated delete classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Authenticated insert classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Authenticated select classroom groups" ON public.classroom_groups;
DROP POLICY IF EXISTS "Authenticated update classroom groups" ON public.classroom_groups;

-- SELECT: creator OR assigned teacher can see group
CREATE POLICY "Members can view classroom groups"
  ON public.classroom_groups FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_group_teachers cgt
      WHERE cgt.group_id = classroom_groups.group_id
        AND cgt.user_id = auth.uid()
    )
  );

-- INSERT: only authenticated user as creator
CREATE POLICY "Users can create classroom groups"
  ON public.classroom_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: only creator
CREATE POLICY "Creator can update classroom groups"
  ON public.classroom_groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: only creator
CREATE POLICY "Creator can delete classroom groups"
  ON public.classroom_groups FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================
-- 2. CLASSROOM_GROUP_TEACHERS: Replace overly permissive policies
-- ============================================================

DROP POLICY IF EXISTS "Authenticated delete group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Authenticated insert group teachers" ON public.classroom_group_teachers;
DROP POLICY IF EXISTS "Authenticated select group teachers" ON public.classroom_group_teachers;

-- SELECT: group creator or the teacher themselves
CREATE POLICY "Members can view group teachers"
  ON public.classroom_group_teachers FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_teachers.group_id
        AND g.created_by = auth.uid()
    )
  );

-- INSERT: only group creator can add teachers
CREATE POLICY "Group creator can add teachers"
  ON public.classroom_group_teachers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_teachers.group_id
        AND g.created_by = auth.uid()
    )
  );

-- DELETE: group creator or teacher removing themselves
CREATE POLICY "Group creator or self can remove teachers"
  ON public.classroom_group_teachers FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_teachers.group_id
        AND g.created_by = auth.uid()
    )
  );

-- ============================================================
-- 3. CLASSROOM_GROUP_STUDENTS: Replace overly permissive policies
-- ============================================================

DROP POLICY IF EXISTS "Authenticated delete group students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Authenticated insert group students" ON public.classroom_group_students;
DROP POLICY IF EXISTS "Authenticated select group students" ON public.classroom_group_students;

-- SELECT: group creator or assigned teacher
CREATE POLICY "Members can view group students"
  ON public.classroom_group_students FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_students.group_id
        AND g.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.classroom_group_teachers cgt
      WHERE cgt.group_id = classroom_group_students.group_id
        AND cgt.user_id = auth.uid()
    )
  );

-- INSERT: group creator or assigned teacher
CREATE POLICY "Group members can add students"
  ON public.classroom_group_students FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_students.group_id
        AND g.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.classroom_group_teachers cgt
      WHERE cgt.group_id = classroom_group_students.group_id
        AND cgt.user_id = auth.uid()
    )
  );

-- DELETE: group creator or assigned teacher
CREATE POLICY "Group members can remove students"
  ON public.classroom_group_students FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_groups g
      WHERE g.group_id = classroom_group_students.group_id
        AND g.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.classroom_group_teachers cgt
      WHERE cgt.group_id = classroom_group_students.group_id
        AND cgt.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. AGENCY_INVITE_CODES: Scope mutations to creator
-- ============================================================

DROP POLICY IF EXISTS "Authenticated insert agency invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Authenticated update agency invite codes" ON public.agency_invite_codes;

CREATE POLICY "Users can create agency invite codes"
  ON public.agency_invite_codes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update agency invite codes"
  ON public.agency_invite_codes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================
-- 5. INVITE_CODES: Scope mutations to creator
-- ============================================================

DROP POLICY IF EXISTS "Authenticated insert invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated update invite codes" ON public.invite_codes;

CREATE POLICY "Users can create invite codes"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update invite codes"
  ON public.invite_codes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================
-- 6. IEP_DOCUMENTS: Scope mutations to uploader
-- ============================================================

DROP POLICY IF EXISTS "Authenticated insert iep_documents" ON public.iep_documents;
DROP POLICY IF EXISTS "Authenticated update iep_documents" ON public.iep_documents;

CREATE POLICY "Uploader can insert iep_documents"
  ON public.iep_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploader can update iep_documents"
  ON public.iep_documents FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid());

-- ============================================================
-- 7. IEP EXTRACTED TABLES: Scope mutations via document ownership
-- ============================================================

-- iep_extracted_goals
DROP POLICY IF EXISTS "Authenticated insert iep_extracted_goals" ON public.iep_extracted_goals;
DROP POLICY IF EXISTS "Authenticated update iep_extracted_goals" ON public.iep_extracted_goals;

CREATE POLICY "Doc uploader can insert goals"
  ON public.iep_extracted_goals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_goals.document_id AND d.uploaded_by = auth.uid()
  ));

CREATE POLICY "Doc uploader can update goals"
  ON public.iep_extracted_goals FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_goals.document_id AND d.uploaded_by = auth.uid()
  ));

-- iep_extracted_progress
DROP POLICY IF EXISTS "Authenticated insert iep_extracted_progress" ON public.iep_extracted_progress;
DROP POLICY IF EXISTS "Authenticated update iep_extracted_progress" ON public.iep_extracted_progress;

CREATE POLICY "Doc uploader can insert progress"
  ON public.iep_extracted_progress FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_progress.document_id AND d.uploaded_by = auth.uid()
  ));

CREATE POLICY "Doc uploader can update progress"
  ON public.iep_extracted_progress FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_progress.document_id AND d.uploaded_by = auth.uid()
  ));

-- iep_extracted_services
DROP POLICY IF EXISTS "Authenticated insert iep_extracted_services" ON public.iep_extracted_services;
DROP POLICY IF EXISTS "Authenticated update iep_extracted_services" ON public.iep_extracted_services;

CREATE POLICY "Doc uploader can insert services"
  ON public.iep_extracted_services FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_services.document_id AND d.uploaded_by = auth.uid()
  ));

CREATE POLICY "Doc uploader can update services"
  ON public.iep_extracted_services FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_services.document_id AND d.uploaded_by = auth.uid()
  ));

-- iep_extracted_accommodations
DROP POLICY IF EXISTS "Authenticated insert iep_extracted_accommodations" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Authenticated update iep_extracted_accommodations" ON public.iep_extracted_accommodations;

CREATE POLICY "Doc uploader can insert accommodations"
  ON public.iep_extracted_accommodations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_accommodations.document_id AND d.uploaded_by = auth.uid()
  ));

CREATE POLICY "Doc uploader can update accommodations"
  ON public.iep_extracted_accommodations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_accommodations.document_id AND d.uploaded_by = auth.uid()
  ));

-- ============================================================
-- 8. GUEST_ACCESS_CODES: Scope INSERT/UPDATE to creator
-- ============================================================

DROP POLICY IF EXISTS "Authenticated insert guest codes" ON public.guest_access_codes;
DROP POLICY IF EXISTS "Authenticated update guest codes" ON public.guest_access_codes;

CREATE POLICY "Creator can insert guest codes"
  ON public.guest_access_codes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update guest codes"
  ON public.guest_access_codes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================
-- 9. TEACHER_REMINDER_SCHEDULES: Enable RLS + add policies
-- ============================================================

ALTER TABLE public.teacher_reminder_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder schedules"
  ON public.teacher_reminder_schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reminder schedules"
  ON public.teacher_reminder_schedules FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reminder schedules"
  ON public.teacher_reminder_schedules FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reminder schedules"
  ON public.teacher_reminder_schedules FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 10. FIX VIEWS: Replace SECURITY DEFINER with SECURITY INVOKER
-- ============================================================

-- Recreate default_reminder_scope_rank as SECURITY INVOKER
CREATE OR REPLACE VIEW public.default_reminder_scope_rank
  WITH (security_invoker = true)
AS
SELECT
  id,
  scope_type,
  organization_id,
  school_id,
  classroom_id,
  owner_user_id,
  role_scope,
  name,
  reminder_key,
  reminder_type,
  timezone,
  is_active,
  allow_user_override,
  local_enabled,
  remote_enabled,
  start_time,
  end_time,
  days_of_week,
  interval_minutes,
  grace_period_minutes,
  message_title,
  message_body,
  app_environment,
  created_by,
  created_at,
  updated_at,
  CASE scope_type
    WHEN 'user' THEN 1
    WHEN 'classroom' THEN 2
    WHEN 'school' THEN 3
    WHEN 'organization' THEN 4
    WHEN 'platform' THEN 5
    ELSE 99
  END AS scope_rank
FROM public.default_reminder_schedules
WHERE is_active = true;
