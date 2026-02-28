import { supabase } from '@/lib/supabase';
import { normalizeClients } from '@/lib/student-utils';
import type { Client, Workspace } from '@/lib/types';

type ClientPermission = 'can_collect_data' | 'can_generate_reports' | 'can_view_notes';

const ELEVATED_ROLES = new Set(['owner', 'admin']);

async function fetchByAgencyIds(agencyIds: string[]): Promise<Client[]> {
  if (agencyIds.length === 0) return [];

  let records = await supabase
    .from('students')
    .select('*')
    .in('agency_id', agencyIds)
    .order('last_name');

  if (records.error) {
    records = await supabase
      .from('clients')
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
    .from('students')
    .select('*')
    .in('id', clientIds)
    .eq('agency_id', agencyId)
    .order('last_name');

  if (records.error) {
    records = await supabase
      .from('clients')
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
}

export async function fetchAccessibleClients({
  currentWorkspace,
  isSoloMode,
  userId,
  permission,
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

  const agencyIds = Array.from(new Set((memberships || []).map((m: any) => m.agency_id).filter(Boolean)));
  const canViewAcrossOrganizations = (memberships || []).some((m: any) =>
    ELEVATED_ROLES.has(String(m.role || '').toLowerCase())
  );

  if (canViewAcrossOrganizations) {
    return fetchByAgencyIds(agencyIds);
  }

  let accessQuery = supabase
    .from('user_client_access')
    .select(permission ? `client_id, ${permission}` : 'client_id')
    .eq('user_id', userId);

  if (permission) {
    accessQuery = accessQuery.eq(permission, true);
  }

  const { data: accessRows, error: accessError } = await accessQuery;
  if (accessError) throw accessError;

  const clientIds = Array.from(new Set((accessRows || []).map((r: any) => r.client_id).filter(Boolean)));

  return fetchByClientIds(clientIds, currentWorkspace.agency_id);
}
