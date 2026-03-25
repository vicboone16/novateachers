/**
 * Game layer data access — all reads/writes use Lovable Cloud (cloudSupabase).
 */
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

// ── Classroom game settings ──

export async function getClassroomGameSettings(groupId: string) {
  const { data } = await cloudSupabase
    .from('classroom_game_settings')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();
  return data;
}

export async function upsertClassroomGameSettings(
  settings: Record<string, any> & { group_id: string; agency_id: string },
): Promise<{ ok: boolean; error?: string }> {
  // Only send columns that exist in the DB
  const payload: Record<string, any> = {
    group_id: settings.group_id,
    agency_id: settings.agency_id,
  };
  if (settings.game_mode !== undefined) payload.game_mode = settings.game_mode;
  if (settings.mode_id !== undefined) payload.mode_id = settings.mode_id;
  if (settings.theme_id !== undefined) payload.theme_id = settings.theme_id;
  if (settings.track_id !== undefined) payload.track_id = settings.track_id;
  if (settings.show_avatars !== undefined) payload.show_avatars = settings.show_avatars;
  if (settings.show_leaderboard !== undefined) payload.show_leaderboard = settings.show_leaderboard;
  if (settings.allow_team_mode !== undefined) payload.allow_team_mode = settings.allow_team_mode;
  if (settings.total_steps !== undefined) payload.total_steps = settings.total_steps;

  const { error } = await cloudSupabase
    .from('classroom_game_settings')
    .upsert(payload as any, { onConflict: 'group_id' });
  if (error) {
    console.error('[game-data] upsert error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── Game modes & themes ──

export async function getGameModes() {
  const { data } = await cloudSupabase
    .from('game_modes')
    .select('*')
    .eq('is_preset', true)
    .order('name');
  return data || [];
}

export async function getGameThemes() {
  const { data } = await cloudSupabase
    .from('game_themes')
    .select('*')
    .eq('is_preset', true)
    .order('name');
  return data || [];
}

// ── Teams ──

export async function getClassroomTeams(groupId: string) {
  const { data } = await cloudSupabase
    .from('classroom_teams')
    .select('*')
    .eq('group_id', groupId)
    .order('team_name');
  return data || [];
}

export async function createTeam(team: {
  group_id: string;
  team_name: string;
  team_color: string;
  team_icon: string;
  agency_id?: string;
}) {
  const { data } = await cloudSupabase
    .from('classroom_teams')
    .insert(team as any)
    .select()
    .single();
  return data;
}

export async function deleteTeam(teamId: string) {
  await cloudSupabase.from('classroom_teams').delete().eq('id', teamId);
}

// ── Student game progress (view) ──

export async function getClassroomGameProgress(groupId: string) {
  try {
    const { data, error } = await cloudSupabase
      .from('v_classroom_student_game_progress' as any)
      .select('*')
      .eq('group_id', groupId)
      .order('track_position', { ascending: false });
    if (error || !data) return [];
    return data as any[];
  } catch {
    return [];
  }
}

export async function getTeamScores(groupId: string) {
  const { data } = await cloudSupabase
    .from('v_classroom_team_scores')
    .select('*')
    .eq('group_id', groupId)
    .order('total_points', { ascending: false });
  return data || [];
}

// ── Student game profiles ──

export async function getStudentGameProfile(studentId: string) {
  const { data } = await cloudSupabase
    .from('student_game_profiles')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  return data;
}

// ── Student login codes ──

export async function generateStudentLoginCode(studentId: string, agencyId: string) {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const expiresAt = new Date();
  expiresAt.setHours(23, 59, 59, 999);

  await cloudSupabase
    .from('student_login_codes' as any)
    .update({ is_active: false } as any)
    .eq('student_id', studentId)
    .eq('is_active', true);

  const { data } = await cloudSupabase
    .from('student_login_codes' as any)
    .insert({
      student_id: studentId,
      agency_id: agencyId,
      login_code: code,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    } as any)
    .select()
    .single();
  return data;
}

export async function getActiveStudentCode(studentId: string) {
  const { data } = await cloudSupabase
    .from('student_login_codes' as any)
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();
  return data;
}

// ── Public links ──

export async function getClassroomPublicLink(groupId: string) {
  const { data } = await cloudSupabase
    .from('classroom_public_links' as any)
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .maybeSingle();
  return data as any;
}

export async function generatePublicLink(groupId: string, agencyId: string) {
  const slug = `class-${groupId.slice(0, 8)}-${Date.now().toString(36)}`;
  await cloudSupabase
    .from('classroom_public_links' as any)
    .update({ is_active: false } as any)
    .eq('group_id', groupId);

  const { data } = await cloudSupabase
    .from('classroom_public_links' as any)
    .insert({ group_id: groupId, agency_id: agencyId, slug, is_active: true } as any)
    .select()
    .single();
  return data as any;
}

// ── Unlocks ──

export async function getUnlockCatalog(agencyId?: string) {
  let q = cloudSupabase.from('unlock_catalog').select('*').eq('is_active', true);
  if (agencyId) {
    q = q.or(`agency_id.is.null,agency_id.eq.${agencyId}`);
  }
  const { data } = await q.order('points_required');
  return data || [];
}

export async function getStudentUnlocks(studentId: string) {
  const { data } = await cloudSupabase
    .from('student_unlocks')
    .select('*')
    .eq('student_id', studentId);
  return data || [];
}

// ── Streaks ──

export async function getStudentStreaks(studentId: string) {
  const { data } = await cloudSupabase
    .from('student_streaks')
    .select('*')
    .eq('student_id', studentId)
    .order('current_count', { ascending: false });
  return data || [];
}

// ── Portal access validation ──

export async function validateStudentPortalAccess(code: string): Promise<{
  valid: boolean;
  studentId?: string;
  accountId?: string;
}> {
  const { data: loginCode } = await cloudSupabase
    .from('student_login_codes' as any)
    .select('student_id')
    .eq('login_code', code)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (loginCode) {
    return { valid: true, studentId: (loginCode as any).student_id };
  }

  const { data: token } = await cloudSupabase
    .from('student_portal_tokens' as any)
    .select('account_id')
    .eq('token', code)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (token) {
    return { valid: true, accountId: (token as any).account_id };
  }

  return { valid: false };
}
