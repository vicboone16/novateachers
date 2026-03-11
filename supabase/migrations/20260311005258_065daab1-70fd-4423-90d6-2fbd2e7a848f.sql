
-- Fix iep_documents: drop restrictive policies, add permissive ones for cross-project access
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.iep_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.iep_documents;
DROP POLICY IF EXISTS "Users can read own agency documents" ON public.iep_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.iep_documents;

CREATE POLICY "Allow select iep_documents" ON public.iep_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert iep_documents" ON public.iep_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update iep_documents" ON public.iep_documents FOR UPDATE TO anon, authenticated USING (true);

-- Fix iep_extracted_goals: drop restrictive policies
DROP POLICY IF EXISTS "Users can insert goals for own documents" ON public.iep_extracted_goals;
DROP POLICY IF EXISTS "Users can read goals from own documents" ON public.iep_extracted_goals;
DROP POLICY IF EXISTS "Users can update goals for own documents" ON public.iep_extracted_goals;

CREATE POLICY "Allow select iep_extracted_goals" ON public.iep_extracted_goals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert iep_extracted_goals" ON public.iep_extracted_goals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update iep_extracted_goals" ON public.iep_extracted_goals FOR UPDATE TO anon, authenticated USING (true);

-- Fix iep_extracted_services
DROP POLICY IF EXISTS "Users can insert services for own documents" ON public.iep_extracted_services;
DROP POLICY IF EXISTS "Users can read services from own documents" ON public.iep_extracted_services;
DROP POLICY IF EXISTS "Users can update services for own documents" ON public.iep_extracted_services;

CREATE POLICY "Allow select iep_extracted_services" ON public.iep_extracted_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert iep_extracted_services" ON public.iep_extracted_services FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update iep_extracted_services" ON public.iep_extracted_services FOR UPDATE TO anon, authenticated USING (true);

-- Fix iep_extracted_accommodations
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Users can insert accommodations for own documents" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Users can read accommodations from own documents" ON public.iep_extracted_accommodations;
DROP POLICY IF EXISTS "Users can update accommodations for own documents" ON public.iep_extracted_accommodations;

CREATE POLICY "Allow select iep_extracted_accommodations" ON public.iep_extracted_accommodations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert iep_extracted_accommodations" ON public.iep_extracted_accommodations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update iep_extracted_accommodations" ON public.iep_extracted_accommodations FOR UPDATE TO anon, authenticated USING (true);

-- Fix iep_extracted_progress
DROP POLICY IF EXISTS "Users can insert progress for own documents" ON public.iep_extracted_progress;
DROP POLICY IF EXISTS "Users can read progress from own documents" ON public.iep_extracted_progress;
DROP POLICY IF EXISTS "Users can update progress for own documents" ON public.iep_extracted_progress;

CREATE POLICY "Allow select iep_extracted_progress" ON public.iep_extracted_progress FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert iep_extracted_progress" ON public.iep_extracted_progress FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update iep_extracted_progress" ON public.iep_extracted_progress FOR UPDATE TO anon, authenticated USING (true);

-- Fix storage bucket RLS for iep-uploads
CREATE POLICY "Allow anon upload to iep-uploads" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'iep-uploads');
CREATE POLICY "Allow anon read from iep-uploads" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'iep-uploads');
CREATE POLICY "Allow anon update in iep-uploads" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'iep-uploads');
