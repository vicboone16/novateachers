/**
 * Unified event writer for teacher_data_events table.
 * All data collection tools funnel through this utility.
 */
import { supabase } from '@/lib/supabase';

export type UnifiedEventType =
  | 'behavior_event'
  | 'engagement_sample'
  | 'abc_event'
  | 'trigger_event'
  | 'skill_probe'
  | 'quick_add_note';

export interface UnifiedEvent {
  studentId: string;
  staffId: string;
  agencyId: string;
  eventType: UnifiedEventType;
  eventSubtype?: string;
  eventValue?: Record<string, any>;
  sourceModule: string;
  classroomId?: string;
}

/**
 * Write a single event to teacher_data_events.
 * Fire-and-forget safe — errors are logged but not thrown.
 */
export async function writeUnifiedEvent(event: UnifiedEvent): Promise<void> {
  try {
    const { error } = await supabase.from('teacher_data_events').insert({
      student_id: event.studentId,
      staff_id: event.staffId,
      event_type: event.eventType,
      event_subtype: event.eventSubtype || null,
      event_value: event.eventValue || null,
      source_module: event.sourceModule,
      agency_id: event.agencyId,
      classroom_id: event.classroomId || null,
      metadata: {},
      recorded_at: new Date().toISOString(),
    } as any);
    if (error) console.warn('[UnifiedEvents] insert failed:', error.message);
  } catch (err) {
    console.warn('[UnifiedEvents] write failed:', err);
  }
}

/**
 * Write a batch of events (e.g., end-of-probe results).
 */
export async function writeUnifiedEventBatch(events: UnifiedEvent[]): Promise<void> {
  if (events.length === 0) return;
  try {
    const rows = events.map(e => ({
      student_id: e.studentId,
      staff_id: e.staffId,
      event_type: e.eventType,
      event_subtype: e.eventSubtype || null,
      event_value: e.eventValue || null,
      source_module: e.sourceModule,
      agency_id: e.agencyId,
      classroom_id: e.classroomId || null,
      metadata: {},
      recorded_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('teacher_data_events').insert(rows as any);
    if (error) console.warn('[UnifiedEvents] batch insert failed:', error.message);
  } catch (err) {
    console.warn('[UnifiedEvents] batch write failed:', err);
  }
}

/**
 * Query unified events for a student within a date range.
 */
export async function queryUnifiedEvents(
  studentId: string,
  staffId: string,
  startDate: string,
  endDate: string,
  eventType?: UnifiedEventType,
) {
  let query = supabase
    .from('teacher_data_events')
    .select('*')
    .eq('student_id', studentId)
    .eq('staff_id', staffId)
    .gte('recorded_at', startDate)
    .lte('recorded_at', endDate)
    .order('recorded_at', { ascending: false });

  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  const { data, error } = await query;
  if (error) console.warn('[UnifiedEvents] query failed:', error.message);
  return data || [];
}
