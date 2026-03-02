
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  -- Generate a unique code
  v_code := 'AGY-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));

  INSERT INTO public.agency_invite_codes (
    agency_id, code, role, max_uses, expires_at, created_by, is_active
  ) VALUES (
    p_agency_id, v_code, p_role_slug, p_max_uses, p_expires_at, p_created_by, true
  );

  RETURN v_code;
END;
$$;
