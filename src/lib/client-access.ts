import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { normalizeClients } from '@/lib/student-utils';
import type { Client, Workspace, ClassroomGroup } from '@/lib/types';

type ClientPermission = 'can_collect_data' | 'can_generate_reports' | 'can_view_notes';

const ELEVATED_ROLES = new Set(['owner', 'admin']);

// ── Core fetchers ──

async function fetchByAgencyIds(agencyIds: string[]): Promise<Client[]> {
  if (agencyIds.length === 0) return [];

  let records = await supabase
    .from('clients')
    .select('*')
    .in('agency_id', agencyIds)
    .order('last_name');

  if (records.error) {
    records = await supabase
      .from('students')
      .select('*')
      .in('agency_id', agencyIds)
      .order('last_name');
  }

  if (records.error) throw records.error;
  return normalizeClients(records.data || []);
}

async function fetchByClientIds(clientIds: string[], agencyId: string): Promise<Client[]> {
  if (clientIds.length === 0) return [];

  let records = await supabase
    .from('clients')
    .select('*')
    .in('id', clientIds)
    .eq('agency_id', agencyId)
    .order('last_name');

  if (records.error) {
    records = await supabase
      .from('students')
      .select('*')
      .in('id', clientIds)
      .eq('agency_id', agencyId)
      .order('last_name');
  }

  if (records.error) throw records.error;
  return normalizeClients(records.data || []);
}

/**
 * Try to use the v_teacher_roster view first (returns client_id, access_source).
 * If the view doesn't exist yet, falls back to the manual classroom + access queries.
 */
async function fetchViaTeacherRoster(
  userId: string,
  agencyId: string,
): Promise<{ classroomClientIds: string[]; sharedClientIds: string[] } | null> {
  try {
    const { data, error } = await supabase
      .from('v_teacher_roster')
      .select('client_id, access_source, group_id')
      .eq('user_id', userId)
      .eq('agency_id', agencyId);

    if (error) return null; // view doesn't exist yet

    const classroomIds = new Set<string>();
    const sharedIds = new Set<string>();

    for (const row of (data || []) as any[]) {
      if (row.access_source === 'classroom_group') {
        classroomIds.add(row.client_id);
      } else {
        sharedIds.add(row.client_id);
      }
    }

    return {
      classroomClientIds: Array.from(classroomIds),
      sharedClientIds: Array.from(sharedIds),
    };
  } catch {
    return null;
  }
}

// ── Public API ──

interface FetchAccessibleClientsParams {
  currentWorkspace: Workspace;
  isSoloMode: boolean;
  userId?: string;
  permission?: ClientPermission;
  viewAll?: boolean;
}

export async function fetchAccessibleClients({
  currentWorkspace,
  isSoloMode,
  userId,
  permission,
  viewAll = false,
}: FetchAccessibleClientsParams): Promise<Client[]> {
  if (isSoloMode) {
    return fetchByAgencyIds([currentWorkspace.agency_id]);
  }

  if (!userId) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from('agency_memberships')
    .select('agency_id, role')
    .eq('user_id', userId);

  if (membershipError) throw membershipError;

  const allAgencyIds = Array.from(new Set((memberships || []).map((m: any) => m.agency_id).filter(Boolean)));
  const isElevated = (memberships || []).some((m: any) =>
    ELEVATED_ROLES.has(String(m.role || '').toLowerCase())
  );

  if (isElevated) {
    const agencyIds = viewAll ? allAgencyIds : [currentWorkspace.agency_id];
    return fetchByAgencyIds(agencyIds);
  }

  // Try v_teacher_roster first
  const rosterResult = await fetchViaTeacherRoster(userId, currentWorkspace.agency_id);
  if (rosterResult) {
    const allIds = Array.from(new Set([...rosterResult.classroomClientIds, ...rosterResult.sharedClientIds]));
    return fetchByClientIds(allIds, currentWorkspace.agency_id);
  }

  // Fallback: manual queries
  const [classroomClientIds, directClientIds] = await Promise.all([
    fetchClassroomGroupClientIds(userId, currentWorkspace.agency_id),
    fetchDirectAccessClientIds(userId, permission),
  ]);

  const allClientIds = Array.from(new Set([...classroomClientIds, ...directClientIds]));
  return fetchByClientIds(allClientIds, currentWorkspace.agency_id);
}

// ── Classroom group helpers ──

async function fetchClassroomGroupClientIds(userId: string, agencyId: string): Promise<string[]> {
  try {
    const { data: teacherGroups, error: tgErr } = await cloudSupabase
      .from('classroom_group_teachers')
      .select('group_id')
      .eq('user_id', userId);

    if (tgErr || !teacherGroups?.length) return [];

    const groupIds = teacherGroups.map((r: any) => r.group_id);

    const { data: groups, error: gErr } = await cloudSupabase
      .from('classroom_groups')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('agency_id', agencyId);

    if (gErr || !groups?.length) return [];

    const validGroupIds = groups.map((g: any) => g.group_id);

    const { data: groupStudents, error: gsErr } = await cloudSupabase
      .from('classroom_group_students')
      .select('client_id')
      .in('group_id', validGroupIds);

    if (gsErr) return [];
    return (groupStudents || []).map((r: any) => r.client_id).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchDirectAccessClientIds(userId: string, permission?: ClientPermission): Promise<string[]> {
  // Try user_student_access first with app_scope filter
  let accessQuery = supabase
    .from('user_student_access')
    .select(permission ? `client_id, ${permission}` : 'client_id')
    .eq('user_id', userId)
    .eq('app_scope', 'novateachers');

  if (permission) {
    accessQuery = accessQuery.eq(permission, true);
  }

  let { data: accessRows, error: accessError } = await accessQuery;

  // If app_scope column doesn't exist, retry without it
  if (accessError && String(accessError.message || '').includes('app_scope')) {
    let retryQuery = supabase
      .from('user_student_access')
      .select(permission ? `client_id, ${permission}` : 'client_id')
      .eq('user_id', userId);

    if (permission) {
      retryQuery = retryQuery.eq(permission, true);
    }

    const retry = await retryQuery;
    accessRows = retry.data;
    accessError = retry.error;
  }

  if (accessError) {
    // Fallback to user_client_access
    let fallbackQuery = supabase
      .from('user_client_access')
      .select(permission ? `client_id, ${permission}` : 'client_id')
      .eq('user_id', userId);

    if (permission) {
      fallbackQuery = fallbackQuery.eq(permission, true);
    }

    const fallback = await fallbackQuery;
    accessRows = fallback.data;
    accessError = fallback.error;
  }

  if (accessError) return [];
  return (accessRows || []).map((r: any) => r.client_id).filter(Boolean);
}

// ── Grouped fetch for the Students page ──

export interface ClassroomGroupWithStudents {
  group: ClassroomGroup;
  clients: Client[];
}

export interface GroupedStudentRoster {
  classrooms: ClassroomGroupWithStudents[];
  sharedWithMe: Client[];
  all: Client[];
}

export async function fetchGroupedRoster({
  currentWorkspace,
  userId,
}: {
  currentWorkspace: Workspace;
  userId: string;
}): Promise<GroupedStudentRoster> {
  const agencyId = currentWorkspace.agency_id;

  // Try v_teacher_roster view first for a single-query approach
  const rosterResult = await fetchViaTeacherRoster(userId, agencyId);

  if (rosterResult) {
    // We still need group metadata for the classroom section
    return buildGroupedRosterFromView(rosterResult, userId, agencyId);
  }

  // Fallback: manual multi-query approach
  return buildGroupedRosterManually(userId, agencyId);
}

async function buildGroupedRosterFromView(
  roster: { classroomClientIds: string[]; sharedClientIds: string[] },
  userId: string,
  agencyId: string,
): Promise<GroupedStudentRoster> {
  // Get classroom group details
  let classrooms: ClassroomGroupWithStudents[] = [];

  try {
    const { data: teacherGroups } = await cloudSupabase
      .from('classroom_group_teachers')
      .select('group_id')
      .eq('user_id', userId);

    if (teacherGroups?.length) {
      const groupIds = teacherGroups.map((r: any) => r.group_id);

      const { data: groups } = await cloudSupabase
        .from('classroom_groups')
        .select('*')
        .in('group_id', groupIds)
        .eq('agency_id', agencyId)
        .order('name');

      if (groups?.length) {
        const validGroupIds = groups.map((g: any) => g.group_id);
        const { data: groupStudents } = await cloudSupabase
          .from('classroom_group_students')
          .select('group_id, client_id')
          .in('group_id', validGroupIds);

        const studentsByGroup: Record<string, string[]> = {};
        for (const gs of (groupStudents || []) as any[]) {
          if (!studentsByGroup[gs.group_id]) studentsByGroup[gs.group_id] = [];
          studentsByGroup[gs.group_id].push(gs.client_id);
        }

        const allClassroomClientIds = roster.classroomClientIds;
        const classroomClients = allClassroomClientIds.length > 0
          ? await fetchByClientIds(allClassroomClientIds, agencyId)
          : [];
        const clientMap = new Map(classroomClients.map(c => [c.id, c]));

        classrooms = groups.map((g: any) => ({
          group: g as ClassroomGroup,
          clients: (studentsByGroup[g.group_id] || [])
            .map(id => clientMap.get(id))
            .filter(Boolean) as Client[],
        }));
      }
    }
  } catch {
    // tables may not exist
  }

  const sharedWithMe = roster.sharedClientIds.length > 0
    ? await fetchByClientIds(roster.sharedClientIds, agencyId)
    : [];

  const allMap = new Map<string, Client>();
  for (const cg of classrooms) for (const c of cg.clients) allMap.set(c.id, c);
  for (const c of sharedWithMe) allMap.set(c.id, c);

  return { classrooms, sharedWithMe, all: Array.from(allMap.values()) };
}

async function buildGroupedRosterManually(
  userId: string,
  agencyId: string,
): Promise<GroupedStudentRoster> {
  let classrooms: ClassroomGroupWithStudents[] = [];
  const classroomClientIdSet = new Set<string>();

  try {
    const { data: teacherGroups } = await cloudSupabase
      .from('classroom_group_teachers')
      .select('group_id')
      .eq('user_id', userId);

    if (teacherGroups?.length) {
      const groupIds = teacherGroups.map((r: any) => r.group_id);

      const { data: groups } = await cloudSupabase
        .from('classroom_groups')
        .select('*')
        .in('group_id', groupIds)
        .eq('agency_id', agencyId)
        .order('name');

      if (groups?.length) {
        const validGroupIds = groups.map((g: any) => g.group_id);
        const { data: groupStudents } = await cloudSupabase
          .from('classroom_group_students')
          .select('group_id, client_id')
          .in('group_id', validGroupIds);

        const studentsByGroup: Record<string, string[]> = {};
        for (const gs of (groupStudents || []) as any[]) {
          if (!studentsByGroup[gs.group_id]) studentsByGroup[gs.group_id] = [];
          studentsByGroup[gs.group_id].push(gs.client_id);
          classroomClientIdSet.add(gs.client_id);
        }

        const allClassroomClientIds = Array.from(classroomClientIdSet);
        const classroomClients = allClassroomClientIds.length > 0
          ? await fetchByClientIds(allClassroomClientIds, agencyId)
          : [];
        const clientMap = new Map(classroomClients.map(c => [c.id, c]));

        classrooms = groups.map((g: any) => ({
          group: g as ClassroomGroup,
          clients: (studentsByGroup[g.group_id] || [])
            .map(id => clientMap.get(id))
            .filter(Boolean) as Client[],
        }));
      }
    }
  } catch {
    // tables may not exist
  }

  const directClientIds = await fetchDirectAccessClientIds(userId);
  const sharedOnlyIds = directClientIds.filter(id => !classroomClientIdSet.has(id));
  const sharedWithMe = sharedOnlyIds.length > 0
    ? await fetchByClientIds(sharedOnlyIds, agencyId)
    : [];

  const allMap = new Map<string, Client>();
  for (const cg of classrooms) for (const c of cg.clients) allMap.set(c.id, c);
  for (const c of sharedWithMe) allMap.set(c.id, c);

  return { classrooms, sharedWithMe, all: Array.from(allMap.values()) };
}
