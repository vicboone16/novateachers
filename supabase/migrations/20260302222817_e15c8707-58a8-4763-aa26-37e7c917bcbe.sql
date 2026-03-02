
-- 1. Fix RLS policies: drop RESTRICTIVE and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Creators can read their invite codes" ON public.agency_invite_codes;
DROP POLICY IF EXISTS "Creators can manage their invite codes" ON public.agency_invite_codes;

CREATE POLICY "Creators can read their invite codes"
  ON public.agency_invite_codes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creators can manage their invite codes"
  ON public.agency_invite_codes FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- 2. Replace SECURITY DEFINER with SECURITY INVOKER so RLS is enforced
CREATE OR REPLACE FUNCTION public.create_invite_code(
  p_agency_id uuid,
  p_invite_scope text DEFAULT 'agency',
  p_role_slug text DEFAULT 'teacher',
  p_app_context text DEFAULT 'novatrack_teacher',
  p_max_uses integer DEFAULT 10,
  p_expires_at timestamptz DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_target_email text DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_permissions jsonb DEFAULT NULL,
  p_auto_assign_groups uuid[] DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_caller_id uuid;
BEGIN
  -- Always use authenticated user
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate inputs
  IF p_max_uses < 1 OR p_max_uses > 10000 THEN
    RAISE EXCEPTION 'max_uses must be between 1 and 10000';
  END IF;

  IF p_role_slug IS NULL OR length(p_role_slug) > 50 THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'Agency ID is required';
  END IF;

  -- Generate a unique code
  v_code := 'AGY-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));

  -- RLS enforces that created_by = auth.uid() via WITH CHECK
  INSERT INTO public.agency_invite_codes (
    agency_id, code, role, max_uses, expires_at, created_by, is_active
  ) VALUES (
    p_agency_id, v_code, p_role_slug, p_max_uses, p_expires_at, v_caller_id, true
  );

  RETURN v_code;
END;
$$;
