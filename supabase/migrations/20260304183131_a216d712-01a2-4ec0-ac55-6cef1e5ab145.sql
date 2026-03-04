
-- Fix pre-existing function search_path warning on create_invite_code
CREATE OR REPLACE FUNCTION public.create_invite_code(p_agency_id uuid, p_invite_scope text DEFAULT 'agency'::text, p_role_slug text DEFAULT 'teacher'::text, p_app_context text DEFAULT 'novatrack_teacher'::text, p_max_uses integer DEFAULT 10, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_by uuid DEFAULT NULL::uuid, p_target_email text DEFAULT NULL::text, p_group_id uuid DEFAULT NULL::uuid, p_client_id uuid DEFAULT NULL::uuid, p_permissions jsonb DEFAULT NULL::jsonb, p_auto_assign_groups uuid[] DEFAULT NULL::uuid[])
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public
AS $$
DECLARE
  v_code text;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_max_uses < 1 OR p_max_uses > 10000 THEN
    RAISE EXCEPTION 'max_uses must be between 1 and 10000';
  END IF;
  IF p_role_slug IS NULL OR length(p_role_slug) > 50 THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'Agency ID is required';
  END IF;
  v_code := 'AGY-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
  INSERT INTO public.agency_invite_codes (
    agency_id, code, role, max_uses, expires_at, created_by, is_active
  ) VALUES (
    p_agency_id, v_code, p_role_slug, p_max_uses, p_expires_at, v_caller_id, true
  );
  RETURN v_code;
END;
$$;
