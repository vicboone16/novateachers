/**
 * Beacon Points™ — Reinforcement engine.
 * Handles point awards, deductions, balance queries, and auto-reinforcement hooks.
 * Uses Cloud supabase since beacon_points_ledger lives on Lovable Cloud.
 */
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

export type PointSource =
  | 'manual'
  | 'goal_success'
  | 'engagement_sample'
  | 'dro_interval'
  | 'probe_success'
  | 'response_cost'
  | 'reward_redeem'
  | 'quick_action'
  | 'teacher_data_auto'
  | 'teacher_frequency_auto'
  | 'teacher_duration_auto'
  | 'abc_auto'
  | 'manual_award'
  | 'undo';

export interface PointEntry {
  studentId: string;
  staffId: string;
  agencyId: string;
  points: number;
  reason?: string;
  source: PointSource;
  sourceEventId?: string;
  entryKind?: string;
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
 * Returns the inserted row id for undo support.
 */
export async function writePointEntry(entry: PointEntry): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { data, error } = await cloudSupabase.from('beacon_points_ledger').insert({
      student_id: entry.studentId,
      staff_id: entry.staffId,
      agency_id: entry.agencyId,
      points: entry.points,
      reason: entry.reason || null,
      source: entry.source,
      source_event_id: entry.sourceEventId || null,
      entry_kind: entry.entryKind || null,
    } as any).select('id').single();
    if (error) {
      console.warn('[BeaconPoints] insert failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err: any) {
    console.warn('[BeaconPoints] write failed:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Get point balances for a list of students.
 */
export async function getStudentBalances(
  _staffId: string,
  studentIds: string[],
): Promise<Record<string, number>> {
  if (studentIds.length === 0) return {};
  try {
    // Use the pre-aggregated view to avoid fetching every ledger row
    // (prevents hitting the 1000-row Supabase limit for active students)
    const { data, error } = await cloudSupabase
      .from('v_student_points_balance' as any)
      .select('student_id, balance')
      .in('student_id', studentIds);

    if (error) {
      console.warn('[BeaconPoints] balance view query failed, falling back to ledger sum:', error.message);
      return getStudentBalancesFallback(studentIds);
    }

    const balances: Record<string, number> = {};
    for (const row of (data || []) as any[]) {
      balances[row.student_id] = Number(row.balance) || 0;
    }
    return balances;
  } catch (err) {
    console.warn('[BeaconPoints] balance failed:', err);
    return getStudentBalancesFallback(studentIds);
  }
}

/** Fallback: sum ledger rows directly (may hit 1000-row limit for very active students) */
async function getStudentBalancesFallback(studentIds: string[]): Promise<Record<string, number>> {
  try {
    const { data } = await cloudSupabase
      .from('beacon_points_ledger')
      .select('student_id, points')
      .in('student_id', studentIds);
    const balances: Record<string, number> = {};
    for (const row of (data || []) as any[]) {
      balances[row.student_id] = (balances[row.student_id] || 0) + (row.points || 0);
    }
    return balances;
  } catch {
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
    const { data, error } = await cloudSupabase
      .from('beacon_points_ledger')
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

/**
 * Load teacher point actions from DB for the given agency.
 */
export interface TeacherPointAction {
  id: string;
  action_label: string;
  action_icon: string | null;
  source_table: string;
  default_event_type: string | null;
  default_event_subtype: string | null;
  default_behavior_name: string | null;
  default_behavior_category: string | null;
  mapped_rule_id: string | null;
  manual_points: number | null;
  manual_rule_type: string | null;
  action_group: string | null;
  sort_order: number;
}

export async function loadTeacherPointActions(agencyId: string): Promise<TeacherPointAction[]> {
  try {
    const { data, error } = await cloudSupabase
      .from('teacher_point_actions')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('active', true)
      .order('sort_order');
    if (error) {
      console.warn('[BeaconPoints] load actions failed:', error.message);
      return [];
    }
    return (data || []) as TeacherPointAction[];
  } catch {
    return [];
  }
}

/**
 * Execute a teacher point action using the appropriate RPC function.
 * Returns the ledger row id for undo.
 */
export async function executeTeacherAction(
  action: TeacherPointAction,
  params: {
    agencyId: string;
    studentId: string;
    staffId: string;
    classroomId?: string;
    /** When true, response_cost rules are skipped — behavior is logged but no points deducted */
    responseCostEnabled?: boolean;
  },
): Promise<{ ok: boolean; points: number; ledgerRowId?: string; error?: string }> {
  const { agencyId, studentId, staffId, classroomId, responseCostEnabled = true } = params;

  // If this action is a response_cost type but the student doesn't have RC enabled,
  // skip the point deduction entirely — just log the behavior with 0 points
  const isResponseCostAction = action.manual_rule_type === 'response_cost' ||
    action.action_group === 'behavior' ||
    (action.manual_points != null && action.manual_points < 0);

  const shouldSkipPoints = isResponseCostAction && !responseCostEnabled;

  try {
    if (shouldSkipPoints) {
      // Log the behavior data without any point deduction
      const { data, error } = await cloudSupabase.rpc('log_manual_points', {
        p_agency_id: agencyId,
        p_student_id: studentId,
        p_staff_id: staffId,
        p_points: 0,
        p_reason: action.action_label + ' (RC disabled)',
        p_manual_reason_category: 'because',
        p_source: 'manual_award',
      });
      if (error) return { ok: false, points: 0, error: error.message };
      const result = data as any;
      return { ok: true, points: 0, ledgerRowId: result?.points_ledger_id };
    }

    if (action.source_table === 'manual') {
      const pts = action.manual_points || 0;
      const { data, error } = await cloudSupabase.rpc('log_manual_points', {
        p_agency_id: agencyId,
        p_student_id: studentId,
        p_staff_id: staffId,
        p_points: pts,
        p_reason: action.action_label,
        p_manual_reason_category: action.manual_rule_type === 'response_cost' ? 'response_cost' : 'because',
        p_source: action.manual_rule_type === 'response_cost' ? 'response_cost' : 'manual_award',
      });
      if (error) return { ok: false, points: 0, error: error.message };
      const result = data as any;
      return { ok: true, points: pts, ledgerRowId: result?.points_ledger_id };
    }

    if (action.source_table === 'teacher_data_events') {
      const { data, error } = await cloudSupabase.rpc('log_teacher_data_event_with_points', {
        p_agency_id: agencyId,
        p_student_id: studentId,
        p_staff_id: staffId,
        p_classroom_id: classroomId || null,
        p_event_type: action.default_event_type || 'positive_action',
        p_event_subtype: action.default_event_subtype || null,
        p_source_module: 'quick_action',
      });
      if (error) return { ok: false, points: 0, error: error.message };
      const result = data as any;
      return { ok: true, points: result?.points || 0, ledgerRowId: result?.points_ledger_id };
    }

    if (action.source_table === 'teacher_frequency_entries') {
      const { data, error } = await cloudSupabase.rpc('log_teacher_frequency_with_points', {
        p_agency_id: agencyId,
        p_student_id: studentId,
        p_staff_id: staffId,
        p_behavior_name: action.default_behavior_name || 'Unknown',
      });
      if (error) return { ok: false, points: 0, error: error.message };
      const result = data as any;
      return { ok: true, points: result?.points || 0, ledgerRowId: result?.points_ledger_id };
    }

    if (action.source_table === 'teacher_duration_entries') {
      const { data, error } = await cloudSupabase.rpc('log_teacher_duration_with_points', {
        p_agency_id: agencyId,
        p_student_id: studentId,
        p_staff_id: staffId,
        p_behavior_name: action.default_behavior_name || 'Unknown',
        p_duration_seconds: 0,
      });
      if (error) return { ok: false, points: 0, error: error.message };
      const result = data as any;
      return { ok: true, points: result?.points || 0, ledgerRowId: result?.points_ledger_id };
    }

    if (action.source_table === 'abc_logs') {
      // ABC requires more info — for quick action, log minimal
      const { data, error } = await cloudSupabase.rpc('log_abc_with_points', {
        p_student_id: studentId,
        p_staff_id: staffId,
        p_antecedent: 'Quick action',
        p_behavior: action.default_behavior_name || action.action_label,
        p_consequence: 'Teacher response',
        p_behavior_category: action.default_behavior_category || null,
        p_agency_id: agencyId,
      });
      if (error) return { ok: false, points: 0, error: error.message };
      const result = data as any;
      return { ok: true, points: result?.points || 0, ledgerRowId: result?.points_ledger_id };
    }

    return { ok: false, points: 0, error: 'Unknown source_table' };
  } catch (err: any) {
    return { ok: false, points: 0, error: err.message };
  }
}
