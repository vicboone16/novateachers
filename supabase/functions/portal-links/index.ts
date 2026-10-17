import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { verifiedStaff, staffCanAccessStudent } from '../_shared/staff-identity.ts';

const schema = z.object({
  action: z.enum(['list', 'create', 'revoke']),
  studentId: z.string().uuid(), agencyId: z.string().uuid(),
  linkId: z.string().uuid().optional(),
  expiry: z.enum(['none', '24h', '7d', '30d']).default('7d'),
  replace: z.boolean().default(false),
}).strict();
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const staff = await verifiedStaff(req);
    if (!staff) return respond({ error: 'Unauthorized' }, 401);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return respond({ error: 'Invalid link request' }, 400);
    const { action, studentId, agencyId, linkId, expiry, replace } = parsed.data;
    if (!await staffCanAccessStudent(staff, agencyId, studentId)) return respond({ error: 'Forbidden' }, 403);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return respond({ error: 'Link service unavailable' }, 503);
    const cloud = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (action === 'list') {
      const { data, error } = await cloud.from('parent_access_links').select('*').eq('student_id', studentId).eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(100);
      return error ? respond({ error: 'Could not load links' }, 500) : respond({ links: data });
    }
    if (action === 'revoke') {
      if (!linkId) return respond({ error: 'Link required' }, 400);
      const { data, error } = await cloud.from('parent_access_links').update({ is_active: false }).eq('id', linkId).eq('student_id', studentId).eq('agency_id', agencyId).select('id').maybeSingle();
      return error || !data ? respond({ error: 'Link not found' }, 404) : respond({ ok: true });
    }
    const { data: student, error: studentError } = await cloud.from('classroom_group_students').select('id').eq('client_id', studentId).eq('agency_id', agencyId).limit(1);
    if (studentError || !student?.length) return respond({ error: 'Student is not in this classroom agency' }, 403);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const days = expiry === '24h' ? 1 : expiry === '7d' ? 7 : 30;
    const expires_at = expiry === 'none' ? null : new Date(Date.now() + days * 86400000).toISOString();
    // Create first: a failed insert must not invalidate an existing working link.
    const { data: created, error } = await cloud.from('parent_access_links').insert({ student_id: studentId, agency_id: agencyId, token, expires_at, created_by: staff.userId, is_active: true }).select('id').single();
    if (error || !created) return respond({ error: 'Could not create link' }, 500);
    if (replace) {
      const { error: revokeError } = await cloud.from('parent_access_links').update({ is_active: false }).eq('student_id', studentId).eq('agency_id', agencyId).neq('id', created.id).eq('is_active', true);
      if (revokeError) return respond({ error: 'Link created, but older links could not be revoked' }, 500);
    }
    return respond({ ok: true });
  } catch { return respond({ error: 'Could not process link request' }, 400); }
});