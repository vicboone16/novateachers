
-- ============================================================
-- Fix remaining error-level security issues:
-- 1. IEP tables: scope SELECT to document uploader
-- 2. invite_codes / agency_invite_codes: scope SELECT to creator
-- 3. guest_access_codes: remove anon SELECT, scope to creator
-- ============================================================

-- 1a) iep_documents: replace USING(true) SELECT with uploader-scoped
DROP POLICY IF EXISTS "Authenticated select iep_documents" ON public.iep_documents;
CREATE POLICY "Uploader can select iep_documents"
  ON public.iep_documents FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());

-- 1b) iep_extracted_goals
DROP POLICY IF EXISTS "Authenticated select iep_extracted_goals" ON public.iep_extracted_goals;
CREATE POLICY "Doc uploader can select goals"
  ON public.iep_extracted_goals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_goals.document_id
      AND d.uploaded_by = auth.uid()
  ));

-- 1c) iep_extracted_accommodations
DROP POLICY IF EXISTS "Authenticated select iep_extracted_accommodations" ON public.iep_extracted_accommodations;
CREATE POLICY "Doc uploader can select accommodations"
  ON public.iep_extracted_accommodations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_accommodations.document_id
      AND d.uploaded_by = auth.uid()
  ));

-- 1d) iep_extracted_progress
DROP POLICY IF EXISTS "Authenticated select iep_extracted_progress" ON public.iep_extracted_progress;
CREATE POLICY "Doc uploader can select progress"
  ON public.iep_extracted_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_progress.document_id
      AND d.uploaded_by = auth.uid()
  ));

-- 1e) iep_extracted_services
DROP POLICY IF EXISTS "Authenticated select iep_extracted_services" ON public.iep_extracted_services;
CREATE POLICY "Doc uploader can select services"
  ON public.iep_extracted_services FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.iep_documents d
    WHERE d.id = iep_extracted_services.document_id
      AND d.uploaded_by = auth.uid()
  ));

-- 2a) invite_codes: scope SELECT to creator only
DROP POLICY IF EXISTS "Authenticated select invite codes" ON public.invite_codes;
CREATE POLICY "Creator can select invite codes"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- 2b) agency_invite_codes: scope SELECT to creator only
DROP POLICY IF EXISTS "Authenticated select agency invite codes" ON public.agency_invite_codes;
CREATE POLICY "Creator can select agency invite codes"
  ON public.agency_invite_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- 3) guest_access_codes: remove anon+authenticated USING(true), replace with creator-scoped for authenticated
-- Keep anon SELECT but only for code validation (the edge function uses service role anyway)
DROP POLICY IF EXISTS "Anon and authenticated select guest codes" ON public.guest_access_codes;
CREATE POLICY "Creator can select guest codes"
  ON public.guest_access_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());
