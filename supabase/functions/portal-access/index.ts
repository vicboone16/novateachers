import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { validPortalLink, portalScope, verifiedActor, engagementBonus } from '../_shared/portal-policy.ts';
import { verifiedStaff, staffCanAccessStudent } from '../_shared/staff-identity.ts';

const requestSchema = z.object({
  token: z.string().min(4).max(256).regex(/^[A-Za-z0-9_-]+$/),
  portalType: z.enum(['parent', 'student']).default('parent'),
  action: z.enum(['read', 'message']).default('read'),
  message: z.string().trim().max(2000).optional(),
  actionType: z.enum(['message', 'noticed_too', 'home_followup', 'ask_question', 'praise_at_home']).default('message'),
  parentName: z.string().trim().min(1).max(100).default('Parent'),
}).strict();

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
});

function isLive(expires_at: string | null | undefined) {
  return !expires_at || Date.parse(expires_at) > Date.now();
}

/** The Data API caps rows; never silently truncate a student's lifetime balance. */
async function sumLedger(cloud: SupabaseClient, studentId: string, agencyId?: string) {
  const scoped = () => {
    let q = cloud.from('beacon_points_ledger').select('points').eq('student_id', studentId).order('id');
    return agencyId ? q.eq('agency_id', agencyId) : q;
  };
  const first = await scoped();
  if (first.error) return { error: true as const, total: 0 };
  let total = (first.data || []).reduce((sum, row) => sum + row.points, 0);
  let offset = first.data?.length || 0;
  while (offset >= 1000) {
    const page = await scoped().range(offset, offset + 999);
    if (page.error) return { error: true as const, total: 0 };
    total += (page.data || []).reduce((sum, row) => sum + row.points, 0);
    if ((page.data?.length || 0) < 1000) break;
    offset += 1000;
  }
  return { error: false as const, total };
}

/**
 * Student portal: resolve a portal token or classroom login code server-side,
 * then return only an allowlisted student-safe DTO. Browsers never query the
 * token or account tables directly.
 */
async function handleStudentPortal(token: string, cloud: SupabaseClient) {
  const coreUrl = Deno.env.get('VITE_CORE_SUPABASE_URL');
  const coreKey = Deno.env.get('VITE_CORE_SUPABASE_ANON_KEY');
  const core = coreUrl && coreKey
    ? createClient(coreUrl, coreKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  let studentId: string | null = null;
  let displayName = 'Student';
  let avatarEmoji = '👤';
  let goals: unknown[] = [];

  if (core) {
    const { data: tok } = await core.from('student_portal_tokens')
      .select('account_id, expires_at, is_active').eq('token', token).maybeSingle();
    if (tok) {
      if (!tok.is_active || !isLive(tok.expires_at)) return respond({ error: 'This link has expired' }, 403);
      const { data: acct } = await core.from('student_portal_accounts')
        .select('student_id, display_name, avatar_emoji').eq('id', tok.account_id).maybeSingle();
      if (!acct?.student_id) return respond({ error: 'Invalid or expired link' }, 403);
      studentId = acct.student_id;
      displayName = acct.display_name || displayName;
      avatarEmoji = acct.avatar_emoji || avatarEmoji;
      const { data: goalRows } = await core.from('v_student_reward_progress')
        .select('*').eq('student_id', studentId).limit(20);
      goals = goalRows || [];
    } else {
      // Legacy external student links.
      const { data: ext } = await core.from('external_access_links')
        .select('id, student_id, expires_at, is_active').eq('token', token).eq('link_type', 'student').maybeSingle();
      if (ext) {
        if (!ext.is_active || !isLive(ext.expires_at)) return respond({ error: 'This link has expired' }, 403);
        studentId = ext.student_id;
        await core.from('external_access_links').update({ last_used_at: new Date().toISOString() }).eq('id', ext.id);
      }
    }
  }

  if (!studentId) {
    // Classroom-issued login codes live in Cloud.
    const { data: code } = await cloud.from('student_login_codes')
      .select('student_id, expires_at, is_active').eq('login_code', token).eq('is_active', true).maybeSingle();
    if (!code?.student_id || !isLive(code.expires_at)) return respond({ error: 'Invalid or expired link' }, 403);
    studentId = code.student_id;
  }

  // Derive the agency from the student's own profile so reads stay agency-scoped.
  const { data: profile } = await cloud.from('student_game_profiles')
    .select('agency_id, avatar_emoji, display_name_override, current_level, current_xp')
    .eq('student_id', studentId).maybeSingle();
  const agencyId = profile?.agency_id as string | undefined;

  const ledger = await sumLedger(cloud, studentId, agencyId);
  if (ledger.error) return respond({ error: 'Could not load progress' }, 503);

  let rewards: { name: string; emoji: string; cost: number }[] = [];
  if (agencyId) {
    const { data } = await cloud.from('beacon_rewards').select('name, emoji, cost')
      .eq('agency_id', agencyId).eq('active', true).order('cost').limit(8);
    rewards = (data || []).map(r => ({ name: r.name, emoji: r.emoji || '🎁', cost: r.cost }));
  } else {
    const { data } = await cloud.from('v_beacon_rewards_by_classroom').select('name, emoji, cost').order('cost').limit(8);
    rewards = (data || []).map((r: { name: string; emoji: string | null; cost: number }) => ({ name: r.name, emoji: r.emoji || '🎁', cost: r.cost }));
  }

  return respond({
    studentId, agencyId: agencyId || null,
    displayName: profile?.display_name_override || displayName,
    avatarEmoji: profile?.avatar_emoji || avatarEmoji,
    pointsBalance: ledger.total,
    currentLevel: profile?.current_level || 1,
    currentXp: profile?.current_xp || 0,
    rewards, goals,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return respond({ error: 'Invalid portal request' }, 400);
    const { token, portalType, action, message, actionType, parentName } = parsed.data;
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return respond({ error: 'Portal unavailable' }, 503);
    const cloud = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (portalType === 'student') return await handleStudentPortal(token, cloud);

    const { data: link, error } = await cloud.from('parent_access_links')
      .select('id, student_id, agency_id, is_active, expires_at').eq('token', token).maybeSingle();
    if (error || !validPortalLink(link)) return respond({ error: 'Invalid or expired link' }, 403);
    const scope = portalScope(link);
    // The link must still point to a student in this agency, not merely contain IDs.
    const { data: memberships, error: membershipError } = await cloud.from('classroom_group_students')
      .select('group_id, first_name, last_name').eq('client_id', scope.student_id).eq('agency_id', scope.agency_id);
    if (membershipError || !memberships?.length) return respond({ error: 'Invalid or expired link' }, 403);
    if (action === 'message') {
      let owner: string | null = null;
      // Public portal requests intentionally have no Authorization header.
      // A present bearer is never ignored, even with a valid portal link.
      if (req.headers.has('Authorization')) {
        const staff = await verifiedStaff(req);
        if (!staff) return respond({ error: 'Unauthorized' }, 401);
        if (!await staffCanAccessStudent(staff, scope.agency_id, scope.student_id)) return respond({ error: 'Forbidden' }, 403);
        owner = staff.userId;
      }
      const { count, error: rateError } = await cloud.from('parent_actions').select('id', { count: 'exact', head: true })
        .eq('student_id', scope.student_id).eq('agency_id', scope.agency_id)
        .gte('created_at', new Date(Date.now() - 60000).toISOString());
      if (rateError) return respond({ error: 'Messaging unavailable' }, 503);
      if ((count || 0) >= 10) return respond({ error: 'Please wait before sending another message' }, 429);
      const { data: inserted, error: insertError } = await cloud.from('parent_actions').insert(verifiedActor(owner, {
        ...scope, action_type: actionType, message: message || null,
        parent_name: parentName,
      })).select('id').single();
      if (insertError) return respond({ error: 'Could not send message' }, 500);
      const bonus = engagementBonus(actionType);
      if (actionType === 'home_followup' && message) {
        await cloud.from('home_reinforcement_log').insert(verifiedActor(owner, {
          ...scope, activity: message, parent_name: parentName,
        }));
      }
      if (bonus > 0 && inserted) {
        await cloud.from('parent_reinforcement_events').insert({
          ...scope, parent_action_id: inserted.id, action_type: actionType,
          bonus_points_awarded: bonus, momentum_boost: actionType === 'praise_at_home',
        });
      }
      return respond({ ok: true });
    }
    const groupIds = memberships.map(row => row.group_id);
    const [profile, rewards, feed, insights, messages, quests] = await Promise.all([
      cloud.from('student_game_profiles').select('avatar_emoji, daily_narrative').eq('student_id', scope.student_id).eq('agency_id', scope.agency_id).maybeSingle(),
      cloud.from('beacon_rewards').select('name, emoji, cost, scope_type, scope_id').eq('agency_id', scope.agency_id).eq('active', true).order('cost').limit(100),
      cloud.from('classroom_feed_posts').select('id, body, title, created_at').eq('agency_id', scope.agency_id).in('group_id', groupIds).in('post_type', ['celebration', 'announcement', 'positive']).order('created_at', { ascending: false }).limit(5),
      cloud.from('parent_insights').select('id, insight_type, title, body, tone, is_read, created_at').eq('student_id', scope.student_id).eq('agency_id', scope.agency_id).order('created_at', { ascending: false }).limit(5),
      cloud.from('parent_actions').select('id, action_type, message, parent_name, staff_reply, staff_reply_at, created_at').eq('student_id', scope.student_id).eq('agency_id', scope.agency_id).order('created_at', { ascending: false }).limit(50),
      cloud.from('student_quests').select('id, title, description, quest_type, quest_category, target_value, current_value, reward_points, status, completed_at, expires_at').eq('student_id', scope.student_id).eq('agency_id', scope.agency_id).in('status', ['active', 'completed']).limit(10),
    ]);
    const ledger = await sumLedger(cloud, scope.student_id, scope.agency_id);
    if (ledger.error) return respond({ error: 'Could not load progress' }, 503);
    await cloud.from('parent_access_links').update({ last_used_at: new Date().toISOString() }).eq('id', link.id).eq('is_active', true);
    const student = memberships[0];
    return respond({
      studentId: scope.student_id, agencyId: scope.agency_id,
      studentName: `${student.first_name || ''} ${(student.last_name || '').slice(0, 1)}`.trim() || 'Your Child',
      avatarEmoji: profile.data?.avatar_emoji || '👤', narrative: profile.data?.daily_narrative || null,
      pointsBalance: ledger.total,
      rewards: (rewards.data || []).filter(row => row.scope_type === 'agency' || row.scope_id === scope.student_id || groupIds.includes(row.scope_id)).slice(0, 6).map(row => ({ name: row.name, emoji: row.emoji || '🎁', cost: row.cost })),
      feedPosts: feed.data || [], insights: insights.data || [], messages: (messages.data || []).reverse(), quests: quests.data || [],
    });
  } catch { return respond({ error: 'Could not process portal request' }, 400); }
});
