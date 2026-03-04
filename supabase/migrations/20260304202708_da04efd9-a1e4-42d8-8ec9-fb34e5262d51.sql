
-- Storage bucket for IEP uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('iep-uploads', 'iep-uploads', false);

-- 1. iep_documents - tracks uploaded IEP PDFs and pipeline state
CREATE TABLE public.iep_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  student_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  ocr_raw_text text,
  ocr_cleaned_text text,
  ocr_confidence smallint,
  pipeline_status text NOT NULL DEFAULT 'uploaded',
  pipeline_error text,
  sections_detected jsonb DEFAULT '[]'::jsonb,
  global_issues jsonb DEFAULT '[]'::jsonb,
  iep_cycle_start date,
  iep_cycle_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iep_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own documents" ON public.iep_documents
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can read own agency documents" ON public.iep_documents
  FOR SELECT TO authenticated USING (uploaded_by = auth.uid());

CREATE POLICY "Users can update own documents" ON public.iep_documents
  FOR UPDATE TO authenticated USING (uploaded_by = auth.uid());

-- 2. iep_extracted_goals
CREATE TABLE public.iep_extracted_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.iep_documents(id) ON DELETE CASCADE,
  goal_key text NOT NULL,
  goal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iep_extracted_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read goals from own documents" ON public.iep_extracted_goals
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can insert goals for own documents" ON public.iep_extracted_goals
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can update goals for own documents" ON public.iep_extracted_goals
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

-- 3. iep_extracted_progress
CREATE TABLE public.iep_extracted_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.iep_documents(id) ON DELETE CASCADE,
  linked_goal_id uuid REFERENCES public.iep_extracted_goals(id) ON DELETE SET NULL,
  progress_key text NOT NULL,
  progress_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  link_confidence real,
  is_approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iep_extracted_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read progress from own documents" ON public.iep_extracted_progress
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can insert progress for own documents" ON public.iep_extracted_progress
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can update progress for own documents" ON public.iep_extracted_progress
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

-- 4. iep_extracted_services
CREATE TABLE public.iep_extracted_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.iep_documents(id) ON DELETE CASCADE,
  service_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iep_extracted_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read services from own documents" ON public.iep_extracted_services
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can insert services for own documents" ON public.iep_extracted_services
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can update services for own documents" ON public.iep_extracted_services
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

-- 5. iep_extracted_accommodations
CREATE TABLE public.iep_extracted_accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.iep_documents(id) ON DELETE CASCADE,
  accommodation_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iep_extracted_accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read accommodations from own documents" ON public.iep_extracted_accommodations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can insert accommodations for own documents" ON public.iep_extracted_accommodations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

CREATE POLICY "Users can update accommodations for own documents" ON public.iep_extracted_accommodations
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.iep_documents d WHERE d.id = document_id AND d.uploaded_by = auth.uid())
  );

-- Storage RLS for iep-uploads bucket
CREATE POLICY "Users can upload IEP files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'iep-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own IEP files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'iep-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
