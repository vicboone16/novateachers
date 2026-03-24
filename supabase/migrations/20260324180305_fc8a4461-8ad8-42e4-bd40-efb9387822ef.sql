CREATE TABLE IF NOT EXISTS public.student_response_cost_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  response_cost_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(student_id, agency_id)
);

ALTER TABLE public.student_response_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage response cost settings"
  ON public.student_response_cost_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);