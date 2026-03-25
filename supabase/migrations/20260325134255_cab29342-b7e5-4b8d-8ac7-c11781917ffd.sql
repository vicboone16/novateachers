
-- ============================================
-- Admin Audit Log
-- ============================================

CREATE TABLE public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  user_id UUID,
  user_name TEXT,
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL DEFAULT 'general',
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audit logs for their agency"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_audit_log_agency ON public.admin_audit_log(agency_id);
CREATE INDEX idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_category ON public.admin_audit_log(action_category);
CREATE INDEX idx_audit_log_user ON public.admin_audit_log(user_id);

-- ============================================
-- Auto-log point awards to audit log
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_log_point_award()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (agency_id, user_id, action_type, action_category, entity_type, entity_id, details)
  VALUES (
    NEW.agency_id,
    NEW.staff_id,
    CASE WHEN NEW.points >= 0 THEN 'points_awarded' ELSE 'points_deducted' END,
    'points',
    'student',
    NEW.student_id::text,
    jsonb_build_object('points', NEW.points, 'source', NEW.source, 'reason', NEW.reason, 'entry_kind', NEW.entry_kind)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_point_award
  AFTER INSERT ON public.beacon_points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_point_award();

-- ============================================
-- Auto-log reward redemptions to audit log
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_log_redemption()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (agency_id, user_id, action_type, action_category, entity_type, entity_id, details)
  VALUES (
    NEW.agency_id,
    NEW.staff_id,
    'reward_redeemed',
    'rewards',
    'student',
    NEW.student_id::text,
    jsonb_build_object('reward_id', NEW.reward_id, 'points_spent', NEW.points_spent, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_redemption
  AFTER INSERT ON public.beacon_reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_redemption();

-- ============================================
-- Auto-log staff presence changes to audit log
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_log_presence_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (agency_id, user_id, action_type, action_category, entity_type, entity_id, details)
  VALUES (
    NEW.agency_id,
    NEW.user_id,
    CASE WHEN NEW.status = 'out' THEN 'staff_checked_out' ELSE 'staff_status_changed' END,
    'presence',
    'staff',
    NEW.user_id::text,
    jsonb_build_object('status', NEW.status, 'location', NEW.location_label, 'availability', NEW.availability_status)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_presence
  AFTER INSERT OR UPDATE ON public.staff_presence
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_presence_change();
