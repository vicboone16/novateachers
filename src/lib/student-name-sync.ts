/**
 * Student name sync — ensures Cloud classroom_group_students rows
 * have first_name/last_name populated.
 *
 * Strategy:
 *  1. Read Cloud CGS rows for the group.
 *  2. If any are missing names AND the user is authenticated,
 *     read names from Core's `clients` table (which the user's JWT can access)
 *     and write them into the Cloud CGS rows.
 *  3. If names are still missing, apply safe display fallback labels.
 */
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

export interface CloudStudentNameRow {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
}

function hasName(row: CloudStudentNameRow) {
  return Boolean(row.first_name?.trim() || row.last_name?.trim());
}

/** Safe fallback so public boards never show raw UUID fragments */
function withSafeFallbackNames(rows: CloudStudentNameRow[]): CloudStudentNameRow[] {
  return rows.map((row, index) => {
    if (hasName(row)) return row;
    return { ...row, first_name: `Student ${index + 1}`, last_name: null };
  });
}

async function fetchGroupStudentNames(groupId: string): Promise<CloudStudentNameRow[]> {
  const { data } = await cloudSupabase
    .from('classroom_group_students')
    .select('client_id, first_name, last_name')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  return (data || []) as CloudStudentNameRow[];
}

/**
 * Client-side sync: read names from Core `clients` table using the
 * user's authenticated session, then write them into Cloud CGS rows.
 * This bypasses the edge function which can't access Core due to RLS.
 */
async function syncNamesFromCoreClient(
  groupId: string,
  missingIds: string[],
): Promise<number> {
  if (missingIds.length === 0) return 0;

  let synced = 0;

  // Try Core `clients` table with client_id column
  try {
    const { data: coreClients } = await supabase
      .from('clients' as any)
      .select('client_id, first_name, last_name')
      .in('client_id', missingIds);

    if (coreClients && coreClients.length > 0) {
      for (const c of coreClients as any[]) {
        if (c.first_name || c.last_name) {
          const { error } = await cloudSupabase
            .from('classroom_group_students')
            .update({
              first_name: c.first_name || null,
              last_name: c.last_name || null,
            } as any)
            .eq('group_id', groupId)
            .eq('client_id', c.client_id);
          if (!error) synced++;
        }
      }
      if (synced > 0) {
        console.log(`[name-sync] Synced ${synced} names from Core clients (client_id)`);
        return synced;
      }
    }
  } catch { /* silent — Core table may use different column */ }

  // Fallback: try Core `clients` with `id` column
  try {
    const { data: coreById } = await supabase
      .from('clients' as any)
      .select('id, first_name, last_name')
      .in('id', missingIds);

    if (coreById && coreById.length > 0) {
      for (const c of coreById as any[]) {
        if (c.first_name || c.last_name) {
          const { error } = await cloudSupabase
            .from('classroom_group_students')
            .update({
              first_name: c.first_name || null,
              last_name: c.last_name || null,
            } as any)
            .eq('group_id', groupId)
            .eq('client_id', c.id);
          if (!error) synced++;
        }
      }
      if (synced > 0) {
        console.log(`[name-sync] Synced ${synced} names from Core clients (id)`);
        return synced;
      }
    }
  } catch { /* silent */ }

  // Fallback: try Core `students` table
  try {
    const { data: coreStudents } = await supabase
      .from('students' as any)
      .select('id, first_name, last_name')
      .in('id', missingIds);

    if (coreStudents && coreStudents.length > 0) {
      for (const s of coreStudents as any[]) {
        if (s.first_name || s.last_name) {
          const { error } = await cloudSupabase
            .from('classroom_group_students')
            .update({
              first_name: s.first_name || null,
              last_name: s.last_name || null,
            } as any)
            .eq('group_id', groupId)
            .eq('client_id', s.id);
          if (!error) synced++;
        }
      }
      if (synced > 0) {
        console.log(`[name-sync] Synced ${synced} names from Core students`);
      }
    }
  } catch { /* silent */ }

  return synced;
}

/**
 * Main entry point: load students for a group, sync missing names
 * from Core if authenticated, and return rows with safe fallback names.
 */
export async function getGroupStudentsWithSyncedNames(
  groupId: string,
): Promise<CloudStudentNameRow[]> {
  let rows = await fetchGroupStudentNames(groupId);

  if (rows.length === 0) return rows;

  // If all rows already have names, return immediately
  if (rows.every(hasName)) return rows;

  // Try client-side sync from Core (only works when user is authenticated)
  const missingIds = rows.filter(r => !hasName(r)).map(r => r.client_id);
  const synced = await syncNamesFromCoreClient(groupId, missingIds);

  if (synced > 0) {
    // Re-fetch to get updated names
    rows = await fetchGroupStudentNames(groupId);
  }

  // Always apply safe fallback for any still-missing names
  return withSafeFallbackNames(rows);
}
