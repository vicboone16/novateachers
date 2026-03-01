import { supabase } from '@/lib/supabase';
import { normalizeClients } from '@/lib/student-utils';
import type { Client, Workspace, ClassroomGroup } from '@/lib/types';

type ClientPermission = 'can_collect_data' | 'can_generate_reports' | 'can_view_notes';

const ELEVATED_ROLES = new Set(['owner', 'admin']);

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

interface FetchAccessibleClientsParams {
  currentWorkspace: Workspace;
  isSoloMode: boolean;
  userId?: string;
  permission?: ClientPermission;
  /** When true, owner/admin users see students across ALL their agencies instead of just the current one. */
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

  // Regular teacher: combine classroom group students + explicit user_client_access
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
    // Get groups the teacher belongs to in this agency
    const { data: teacherGroups, error: tgErr } = await supabase
      .from('classroom_group_teachers')
      .select('group_id')
      .eq('user_id', userId);

    if (tgErr || !teacherGroups?.length) return [];

    const groupIds = teacherGroups.map((r: any) => r.group_id);

    // Filter to groups in the current agency
    const { data: groups, error: gErr } = await supabase
      .from('classroom_groups')
      .select('id')
      .in('id', groupIds)
      .eq('agency_id', agencyId);

    if (gErr || !groups?.length) return [];

    const validGroupIds = groups.map((g: any) => g.id);

    // Get student IDs from those groups
    const { data: groupStudents, error: gsErr } = await supabase
      .from('classroom_group_students')
      .select('client_id')
      .in('group_id', validGroupIds);

    if (gsErr) return [];
    return (groupStudents || []).map((r: any) => r.client_id).filter(Boolean);
  } catch {
    // Tables may not exist yet
    return [];
  }
}

async function fetchDirectAccessClientIds(userId: string, permission?: ClientPermission): Promise<string[]> {
  let accessQuery = supabase
    .from('user_client_access')
    .select(permission ? `client_id, ${permission}` : 'client_id')
    .eq('user_id', userId);

  if (permission) {
    accessQuery = accessQuery.eq(permission, true);
  }

  const { data: accessRows, error: accessError } = await accessQuery;
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
  /** All clients flattened and deduplicated */
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

  // Fetch classroom groups the teacher belongs to
  let classrooms: ClassroomGroupWithStudents[] = [];
  const classroomClientIdSet = new Set<string>();

  try {
    const { data: teacherGroups } = await supabase
      .from('classroom_group_teachers')
      .select('group_id')
      .eq('user_id', userId);

    if (teacherGroups?.length) {
      const groupIds = teacherGroups.map((r: any) => r.group_id);

      const { data: groups } = await supabase
        .from('classroom_groups')
        .select('*')
        .in('id', groupIds)
        .eq('agency_id', agencyId)
        .order('name');

      if (groups?.length) {
        // Get all students for these groups
        const validGroupIds = groups.map((g: any) => g.id);
        const { data: groupStudents } = await supabase
          .from('classroom_group_students')
          .select('group_id, client_id')
          .in('group_id', validGroupIds);

        // Map students per group
        const studentsByGroup: Record<string, string[]> = {};
        for (const gs of (groupStudents || []) as any[]) {
          if (!studentsByGroup[gs.group_id]) studentsByGroup[gs.group_id] = [];
          studentsByGroup[gs.group_id].push(gs.client_id);
          classroomClientIdSet.add(gs.client_id);
        }

        // Fetch all client records at once
        const allClassroomClientIds = Array.from(classroomClientIdSet);
        const classroomClients = allClassroomClientIds.length > 0
          ? await fetchByClientIds(allClassroomClientIds, agencyId)
          : [];
        const clientMap = new Map(classroomClients.map(c => [c.id, c]));

        classrooms = groups.map((g: any) => ({
          group: g as ClassroomGroup,
          clients: (studentsByGroup[g.id] || [])
            .map(id => clientMap.get(id))
            .filter(Boolean) as Client[],
        }));
      }
    }
  } catch {
    // Tables may not exist yet
  }

  // Fetch explicit user_client_access (shared with me)
  const directClientIds = await fetchDirectAccessClientIds(userId);
  // Exclude ones already in classroom groups
  const sharedOnlyIds = directClientIds.filter(id => !classroomClientIdSet.has(id));
  const sharedWithMe = sharedOnlyIds.length > 0
    ? await fetchByClientIds(sharedOnlyIds, agencyId)
    : [];

  // Combine all
  const allMap = new Map<string, Client>();
  for (const cg of classrooms) {
    for (const c of cg.clients) allMap.set(c.id, c);
  }
  for (const c of sharedWithMe) allMap.set(c.id, c);

  return {
    classrooms,
    sharedWithMe,
    all: Array.from(allMap.values()),
  };
}
