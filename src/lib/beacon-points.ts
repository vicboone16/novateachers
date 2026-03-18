/**
 * Beacon Points™ — Reinforcement engine.
 * Handles point awards, deductions, balance queries, and auto-reinforcement hooks.
 */
import { supabase } from '@/lib/supabase';

export type PointSource =
  | 'manual'
  | 'goal_success'
  | 'engagement_sample'
  | 'dro_interval'
  | 'probe_success'
  | 'response_cost'
  | 'reward_redeem';

export interface PointEntry {
  studentId: string;
  staffId: string;
  agencyId: string;
  points: number;
  reason?: string;
  source: PointSource;
  sourceEventId?: string;
}

export interface StudentBalance {
  student_id: string;
  agency_id: string;
  balance: number;
  total_earned_count: number;
  total_earned: number;
  total_spent: number;
  last_activity: string | null;
}

/**
 * Award or deduct points for a student.
 */
export async function writePointEntry(entry: PointEntry): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('beacon_points_ledger' as any).insert({
      student_id: entry.studentId,
      staff_id: entry.staffId,
      agency_id: entry.agencyId,
      points: entry.points,
      reason: entry.reason || null,
      source: entry.source,
      source_event_id: entry.sourceEventId || null,
    });
    if (error) {
      console.warn('[BeaconPoints] insert failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    console.warn('[BeaconPoints] write failed:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Get point balances for a list of students.
 */
export async function getStudentBalances(
  staffId: string,
  studentIds: string[],
): Promise<Record<string, number>> {
  if (studentIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('beacon_points_ledger' as any)
      .select('student_id, points')
      .eq('staff_id', staffId)
      .in('student_id', studentIds);

    if (error) {
      console.warn('[BeaconPoints] balance query failed:', error.message);
      return {};
    }

    const balances: Record<string, number> = {};
    for (const row of (data || []) as any[]) {
      balances[row.student_id] = (balances[row.student_id] || 0) + (row.points || 0);
    }
    return balances;
  } catch (err) {
    console.warn('[BeaconPoints] balance failed:', err);
    return {};
  }
}

/**
 * Get today's point ledger for a student.
 */
export async function getTodayPointHistory(
  staffId: string,
  studentId: string,
): Promise<any[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const { data, error } = await supabase
      .from('beacon_points_ledger' as any)
      .select('*')
      .eq('staff_id', staffId)
      .eq('student_id', studentId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[BeaconPoints] history query failed:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}
