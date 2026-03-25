
-- Create the reinforcement_ai_recommendations table
CREATE TABLE public.reinforcement_ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NULL,
  student_id uuid NOT NULL,
  recommendation_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  explanation text NOT NULL,
  suggested_action text NULL,
  suggested_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  accepted_by uuid NULL,
  dismissed_by uuid NULL,
  accepted_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  resolved_at timestamptz NULL,
  action_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reinforcement_ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recommendations"
  ON public.reinforcement_ai_recommendations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update recommendations"
  ON public.reinforcement_ai_recommendations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert recommendations"
  ON public.reinforcement_ai_recommendations FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_recs_student_status ON public.reinforcement_ai_recommendations (student_id, status);
CREATE INDEX idx_recs_agency_status ON public.reinforcement_ai_recommendations (agency_id, status);

CREATE TRIGGER trg_recs_updated_at
  BEFORE UPDATE ON public.reinforcement_ai_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Accept RPC
CREATE OR REPLACE FUNCTION public.accept_reinforcement_ai_recommendation(
  p_recommendation_id uuid, p_user_id uuid, p_action_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_rec record;
BEGIN
  UPDATE public.reinforcement_ai_recommendations
  SET status = 'accepted', accepted_by = p_user_id, accepted_at = now(),
      action_notes = coalesce(p_action_notes, action_notes)
  WHERE id = p_recommendation_id AND status = 'open'
  RETURNING * INTO v_rec;
  IF v_rec IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'recommendation_not_found_or_not_open');
  END IF;
  RETURN jsonb_build_object('ok', true, 'recommendation_id', v_rec.id, 'status', v_rec.status,
    'student_id', v_rec.student_id, 'recommendation_type', v_rec.recommendation_type);
END; $$;

-- Dismiss RPC
CREATE OR REPLACE FUNCTION public.dismiss_reinforcement_ai_recommendation(
  p_recommendation_id uuid, p_user_id uuid, p_action_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_rec record;
BEGIN
  UPDATE public.reinforcement_ai_recommendations
  SET status = 'dismissed', dismissed_by = p_user_id, dismissed_at = now(),
      action_notes = coalesce(p_action_notes, action_notes)
  WHERE id = p_recommendation_id AND status = 'open'
  RETURNING * INTO v_rec;
  IF v_rec IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'recommendation_not_found_or_not_open');
  END IF;
  RETURN jsonb_build_object('ok', true, 'recommendation_id', v_rec.id, 'status', v_rec.status,
    'student_id', v_rec.student_id, 'recommendation_type', v_rec.recommendation_type);
END; $$;

-- Resolve RPC
CREATE OR REPLACE FUNCTION public.resolve_reinforcement_ai_recommendation(
  p_recommendation_id uuid, p_user_id uuid, p_action_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_rec record;
BEGIN
  UPDATE public.reinforcement_ai_recommendations
  SET status = 'resolved', resolved_at = now(),
      action_notes = coalesce(p_action_notes, action_notes)
  WHERE id = p_recommendation_id AND status IN ('open','accepted')
  RETURNING * INTO v_rec;
  IF v_rec IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'recommendation_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'recommendation_id', v_rec.id, 'status', v_rec.status);
END; $$;

-- Open recommendations view
CREATE OR REPLACE VIEW public.v_open_reinforcement_ai_recommendations AS
SELECT id, agency_id, student_id, recommendation_type, priority,
  title, explanation, suggested_action, suggested_payload, evidence_json, status, created_at
FROM public.reinforcement_ai_recommendations
WHERE status = 'open'
ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC;
