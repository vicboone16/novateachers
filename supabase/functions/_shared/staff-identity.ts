import { createClient } from 'npm:@supabase/supabase-js@2';

/** Staff identity must be issued by Core, never by a separate Cloud account. */
export async function verifiedStaff(req: Request) {
  const header = req.headers.get('Authorization');
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  const url = Deno.env.get('VITE_CORE_SUPABASE_URL');
  const key = Deno.env.get('VITE_CORE_SUPABASE_ANON_KEY');
  if (!match || !url || !key) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return { userId: data.user.id, client };
}

/** Positive membership and visible student are both required; errors deny access. */
export async function staffCanAccessStudent(
  staff: NonNullable<Awaited<ReturnType<typeof verifiedStaff>>>,
  agencyId: string,
  studentId: string,
) {
  let member = false;
  for (const table of ['user_agency_access', 'agency_memberships']) {
    const { data, error } = await staff.client.from(table).select('user_id')
      .eq('user_id', staff.userId).eq('agency_id', agencyId).limit(1);
    if (!error && data?.length) member = true;
  }
  if (!member) return false;
  // Core RLS preserves assigned-student restrictions for teachers and BCBA visibility.
  const { data, error } = await staff.client.from('clients').select('id')
    .eq('id', studentId).eq('agency_id', agencyId).maybeSingle();
  return !error && Boolean(data);
}