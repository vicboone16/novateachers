import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { invokeCloudFunction } from '@/lib/cloud-functions';

export interface CloudStudentNameRow {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
}

function hasName(row: CloudStudentNameRow) {
  return Boolean(row.first_name?.trim() || row.last_name?.trim());
}

async function fetchGroupStudentNames(groupId: string): Promise<CloudStudentNameRow[]> {
  const { data } = await cloudSupabase
    .from('classroom_group_students')
    .select('client_id, first_name, last_name')
    .eq('group_id', groupId);

  return (data || []) as CloudStudentNameRow[];
}

export async function getGroupStudentsWithSyncedNames(groupId: string): Promise<CloudStudentNameRow[]> {
  let rows = await fetchGroupStudentNames(groupId);

  if (rows.length === 0 || rows.every(hasName)) {
    return rows;
  }

  const { error } = await invokeCloudFunction<{ ok: boolean; synced: number }>('sync-student-names', {
    group_id: groupId,
  });

  if (!error) {
    rows = await fetchGroupStudentNames(groupId);
  }

  return rows;
}