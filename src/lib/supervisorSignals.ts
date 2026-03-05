import { supabase as novaCore } from '@/lib/supabase';

// ── Signal Types ──
export type SignalSeverity = 'watch' | 'action' | 'critical';
export type SignalType = 'incident' | 'escalation' | 'pattern' | 'safety_concern' | 'other';

export interface CreateSignalParams {
  clientId: string;
  agencyId: string;
  classroomId?: string | null;
  signalType: SignalType;
  severity: SignalSeverity;
  title: string;
  message: string;
  drivers?: Record<string, any>;
  source?: Record<string, any>;
}

export async function createSignal(params: CreateSignalParams) {
  const { data, error } = await (novaCore.rpc as any)('create_supervisor_signal', {
    p_client_id: params.clientId,
    p_signal_type: params.signalType,
    p_title: params.title,
    p_message: params.message,
    p_severity: params.severity,
    p_agency_id: params.agencyId,
    p_classroom_id: params.classroomId ?? null,
    p_drivers: params.drivers ?? {},
    p_source: params.source ?? { app: 'beacon' },
  });
  if (error) {
    console.error('[Beacon] createSignal failed:', error);
    throw error;
  }
  return data;
}

// ── Event Stream ──
export interface LogEventParams {
  clientId: string;
  agencyId: string;
  classroomId?: string | null;
  eventType: string; // 'behavior' | 'incident' | 'ai' | 'context' | 'prompt' | 'skill_trial' | 'reinforcement'
  eventName: string;
  value?: number | null;
  intensity?: number | null;
  phase?: string | null;
  promptCode?: string | null;
  correctness?: string | null; // '+' or '-'
  metadata?: Record<string, any>;
}

export async function logEvent(params: LogEventParams) {
  const { data, error } = await (novaCore.rpc as any)('insert_event', {
    p_client_id: params.clientId,
    p_event_type: params.eventType,
    p_event_name: params.eventName,
    p_agency_id: params.agencyId,
    p_classroom_id: params.classroomId ?? null,
    p_value: params.value ?? null,
    p_intensity: params.intensity ?? null,
    p_phase: params.phase ?? null,
    p_prompt_code: params.promptCode ?? null,
    p_correctness: params.correctness ?? null,
    p_metadata: params.metadata ?? {},
    p_source_app: 'beacon',
  });
  if (error) {
    console.error('[Beacon] logEvent failed:', error);
    throw error;
  }
  return data;
}

// ── Escalation Detection (client-side rolling window) ──
const ESCALATION_BEHAVIORS = ['aggression', 'elopement', 'sib', 'self-injury', 'physical aggression'];
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const THRESHOLD = 3;

interface BehaviorEvent {
  behavior: string;
  timestamp: number;
}

const rollingBuffer: BehaviorEvent[] = [];

/**
 * Track a behavior occurrence and return true if escalation threshold is reached.
 * Caller is responsible for calling createSignal/logEvent on escalation.
 */
export function trackBehaviorForEscalation(behaviorName: string): { escalated: boolean; behavior: string; count: number } | null {
  const normalised = behaviorName.toLowerCase().trim();
  const isKey = ESCALATION_BEHAVIORS.some(b => normalised.includes(b));
  if (!isKey) return null;

  const now = Date.now();
  rollingBuffer.push({ behavior: normalised, timestamp: now });

  // Prune old entries
  const cutoff = now - WINDOW_MS;
  while (rollingBuffer.length > 0 && rollingBuffer[0].timestamp < cutoff) {
    rollingBuffer.shift();
  }

  // Count matching behaviour in window
  const count = rollingBuffer.filter(e => e.behavior === normalised).length;

  if (count >= THRESHOLD) {
    // Reset buffer for this behavior to avoid re-firing immediately
    const remaining = rollingBuffer.filter(e => e.behavior !== normalised);
    rollingBuffer.length = 0;
    rollingBuffer.push(...remaining);
    return { escalated: true, behavior: normalised, count };
  }

  return null;
}
