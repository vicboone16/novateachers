-- ============================================================
-- v_teacher_roster view for NovaTrack Core
-- Combines classroom group membership + user_student_access
-- into a single queryable view per teacher.
-- Run this SQL in the NovaTrack Core Supabase project.
-- ============================================================

-- If you're renaming user_client_access → user_student_access, run:
-- ALTER TABLE public.user_client_access RENAME TO user_student_access;
-- Otherwise keep user_client_access and adjust the view below.

CREATE OR REPLACE VIEW public.v_teacher_roster
WITH (security_invoker = on)
AS
  -- Students via classroom group membership
  SELECT DISTINCT
    cgt.user_id,
    cgs.client_id,
    cg.agency_id,
    cg.id AS group_id,
    cg.name AS group_name,
    'classroom_group'::text AS access_source
  FROM public.classroom_group_teachers cgt
  JOIN public.classroom_groups cg ON cg.id = cgt.group_id
  JOIN public.classroom_group_students cgs ON cgs.group_id = cg.id

  UNION

  -- Students via explicit user_student_access (or user_client_access)
  SELECT DISTINCT
    usa.user_id,
    usa.client_id,
    c.agency_id,
    NULL::uuid AS group_id,
    NULL::text AS group_name,
    'shared'::text AS access_source
  FROM public.user_client_access usa   -- Change to user_student_access if renamed
  JOIN public.clients c ON c.id = usa.client_id;

-- Note: This view uses security_invoker=on so RLS policies on the
-- underlying tables are enforced for the querying user.
