
-- Fix staff_presence UPDATE policy: add WITH CHECK for upsert support
DROP POLICY IF EXISTS "Open update staff_presence" ON public.staff_presence;
CREATE POLICY "Open update staff_presence" ON public.staff_presence
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Fix admin_audit_log INSERT: allow anon role (Cloud client uses anon key)
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Allow insert audit logs" ON public.admin_audit_log
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Fix admin_audit_log SELECT: allow anon role too
DROP POLICY IF EXISTS "Authenticated users can read audit logs for their agency" ON public.admin_audit_log;
CREATE POLICY "Allow read audit logs" ON public.admin_audit_log
  FOR SELECT TO anon, authenticated USING (true);
