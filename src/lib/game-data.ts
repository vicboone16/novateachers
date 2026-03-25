/**
 * Game layer data access — reads from Cloud tables where available,
 * falls back to Core supabase for game settings/teams/progress views.
 */
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
  ClassroomGameSettings,
  ClassroomTeam,
  StudentGameProgress,
  TeamScore,
  StudentGameProfile,
  StudentLoginCode,
  ClassroomPublicLink,
  UnlockCatalogItem,
  StudentUnlock,
  StudentStreak,
  GameMode,
  GameTheme,
} from './game-types';

// ── Classroom game settings ──

export async function getClassroomGameSettings(groupId: string): Promise<ClassroomGameSettings | null> {
  const { data } = await supabase
    .from('classroom_game_settings' as any)
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();
  return data as any;
}

export async function upsertClassroomGameSettings(
  settings: Partial<ClassroomGameSettings> & { group_id: string; agency_id: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('classroom_game_settings' as any)
    .upsert(settings as any, { onConflict: 'group_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Game modes & themes ──

export async function getGameModes(): Promise<GameMode[]> {
  const { data } = await supabase
    .from('game_modes' as any)
    .select('*')
    .eq('is_active', true)
    .order('name');
  return (data || []) as any[];
}

export async function getGameThemes(): Promise<GameTheme[]> {
  const { data } = await supabase
    .from('game_themes' as any)
    .select('*')
    .eq('is_active', true)
    .order('name');
  return (data || []) as any[];
}

// ── Teams ──

export async function getClassroomTeams(groupId: string): Promise<ClassroomTeam[]> {
  const { data } = await supabase
    .from('classroom_teams' as any)
    .select('*')
    .eq('group_id', groupId)
    .order('team_name');
  return (data || []) as any[];
}

export async function createTeam(team: Partial<ClassroomTeam>): Promise<ClassroomTeam | null> {
  const { data } = await supabase
    .from('classroom_teams' as any)
    .insert(team as any)
    .select()
    .single();
  return data as any;
}

export async function deleteTeam(teamId: string): Promise<void> {
  await supabase.from('classroom_teams' as any).delete().eq('id', teamId);
}

export async function assignStudentToTeam(studentId: string, teamId: string, groupId: string): Promise<void> {
  await supabase
    .from('student_team_assignments' as any)
    .upsert({ student_id: studentId, team_id: teamId, group_id: groupId } as any, {
      onConflict: 'student_id,group_id',
    });
}

// ── Student game progress (view) ──

export async function getClassroomGameProgress(groupId: string): Promise<StudentGameProgress[]> {
  const { data } = await supabase
    .from('v_classroom_student_game_progress' as any)
    .select('*')
    .eq('group_id', groupId)
    .order('track_position', { ascending: false });
  return (data || []) as any[];
}

export async function getTeamScores(groupId: string): Promise<TeamScore[]> {
  const { data } = await supabase
    .from('v_student_team_scores' as any)
    .select('*')
    .eq('group_id', groupId)
    .order('total_points', { ascending: false });
  return (data || []) as any[];
}

// ── Student game profiles ──

export async function getStudentGameProfile(studentId: string): Promise<StudentGameProfile | null> {
  const { data } = await cloudSupabase
    .from('student_game_profiles')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  return data as any;
}

// ── Student login codes ──

export async function generateStudentLoginCode(
  studentId: string,
  agencyId: string,
): Promise<StudentLoginCode | null> {
  // Generate a 4-digit numeric code
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const expiresAt = new Date();
  expiresAt.setHours(23, 59, 59, 999); // expires end of day

  // Deactivate existing codes
  await supabase
    .from('student_login_codes' as any)
    .update({ is_active: false } as any)
    .eq('student_id', studentId)
    .eq('is_active', true);

  const { data } = await supabase
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
  return data as any;
}

export async function getActiveStudentCode(studentId: string): Promise<StudentLoginCode | null> {
  const { data } = await supabase
    .from('student_login_codes' as any)
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();
  return data as any;
}

// ── Public links ──

export async function getClassroomPublicLink(groupId: string): Promise<ClassroomPublicLink | null> {
  const { data } = await supabase
    .from('classroom_public_links' as any)
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .maybeSingle();
  return data as any;
}

export async function generatePublicLink(
  groupId: string,
  agencyId: string,
): Promise<ClassroomPublicLink | null> {
  const slug = `class-${groupId.slice(0, 8)}-${Date.now().toString(36)}`;
  // Deactivate existing
  await supabase
    .from('classroom_public_links' as any)
    .update({ is_active: false } as any)
    .eq('group_id', groupId);

  const { data } = await supabase
    .from('classroom_public_links' as any)
    .insert({ group_id: groupId, agency_id: agencyId, slug, is_active: true } as any)
    .select()
    .single();
  return data as any;
}

// ── Unlocks ──

export async function getUnlockCatalog(agencyId?: string): Promise<UnlockCatalogItem[]> {
  let q = supabase.from('unlock_catalog' as any).select('*').eq('is_active', true);
  if (agencyId) {
    q = q.or(`agency_id.is.null,agency_id.eq.${agencyId}`);
  }
  const { data } = await q.order('points_required');
  return (data || []) as any[];
}

export async function getStudentUnlocks(studentId: string): Promise<StudentUnlock[]> {
  const { data } = await supabase
    .from('student_unlocks' as any)
    .select('*')
    .eq('student_id', studentId);
  return (data || []) as any[];
}

// ── Streaks ──

export async function getStudentStreaks(studentId: string): Promise<StudentStreak[]> {
  const { data } = await supabase
    .from('student_streaks' as any)
    .select('*')
    .eq('student_id', studentId)
    .order('current_count', { ascending: false });
  return (data || []) as any[];
}

// ── Portal access validation ──

export async function validateStudentPortalAccess(code: string): Promise<{
  valid: boolean;
  studentId?: string;
  accountId?: string;
}> {
  // Try login code first
  const { data: loginCode } = await supabase
    .from('student_login_codes' as any)
    .select('student_id')
    .eq('login_code', code)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (loginCode) {
    return { valid: true, studentId: (loginCode as any).student_id };
  }

  // Try portal token
  const { data: token } = await supabase
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
