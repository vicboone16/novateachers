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
  try {
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
      // Suppress "function not found" errors — RPC may not be deployed on Core yet
      if (error.message?.includes('Could not find') || error.code === '404') {
        console.warn('[Beacon] createSignal: create_supervisor_signal RPC not available on Core, skipping');
        return null;
      }
      console.error('[Beacon] createSignal failed:', error);
    }
    return data;
  } catch (err) {
    console.warn('[Beacon] createSignal error (suppressed):', err);
    return null;
  }
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
  try {
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
      // Suppress "function not found" errors — RPC may not be deployed on Core yet
      if (error.message?.includes('Could not find') || error.code === '404') {
        console.warn('[Beacon] logEvent: insert_event RPC not available on Core, skipping');
        return null;
      }
      console.error('[Beacon] logEvent failed:', error);
    }
    return data;
  } catch (err) {
    console.warn('[Beacon] logEvent error (suppressed):', err);
    return null;
  }
}

// ── CRITICAL behaviors that always warrant signals ──
const CRITICAL_BEHAVIORS = [
  'aggression', 'physical aggression', 'elopement', 'sib', 'self-injury', 'self injury',
  'weapon', 'property destruction',
];

const ESCALATION_BEHAVIORS = [
  'aggression', 'physical aggression', 'elopement', 'sib', 'self-injury', 'self injury',
];

// ── Threshold rules ──
// Returns signal params if intensity/behavior warrants auto-signal, else null
export function evaluateIncidentThreshold(
  behaviorName: string,
  intensity: number
): { signalType: SignalType; severity: SignalSeverity; title: string; message: string } | null {
  const norm = behaviorName.toLowerCase().trim();
  const isCriticalBehavior = CRITICAL_BEHAVIORS.some(b => norm.includes(b));

  // CRITICAL: intensity >= 4, or safety-critical behaviors at intensity >= 3
  if (intensity >= 4 || (isCriticalBehavior && intensity >= 3)) {
    return {
      signalType: 'incident',
      severity: 'critical',
      title: 'Critical incident logged',
      message: `${behaviorName} at intensity ${intensity} — immediate clinical review needed`,
    };
  }

  // ACTION: intensity 3 (non-critical behavior)
  if (intensity >= 3) {
    return {
      signalType: 'incident',
      severity: 'action',
      title: 'High-intensity incident logged',
      message: `${behaviorName} logged at intensity ${intensity}`,
    };
  }

  return null;
}

// ── Escalation Detection (client-side rolling window) ──
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

// ── WATCH: Repeated Low Behavior Ratings ──
// Fires when a client accumulates LOW_RATING_THRESHOLD low-intensity entries
// (intensity 1–2) within a rolling session window.

const LOW_RATING_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LOW_RATING_THRESHOLD = 4; // 4 low ratings in window

interface RatingEvent {
  clientId: string;
  intensity: number;
  timestamp: number;
}

const lowRatingBuffer: RatingEvent[] = [];
// Track which client has already fired to avoid repeated noise within the same window
const lowRatingFiredClients = new Set<string>();

/**
 * Track a behavior rating and return a WATCH signal descriptor if
 * repeated low ratings are detected for the same client.
 */
export function trackLowRatings(
  clientId: string,
  intensity: number
): { signalType: SignalType; severity: SignalSeverity; title: string; message: string; count: number } | null {
  if (intensity > 2) return null; // only track 1–2

  const now = Date.now();
  lowRatingBuffer.push({ clientId, intensity, timestamp: now });

  // Prune old entries
  const cutoff = now - LOW_RATING_WINDOW_MS;
  while (lowRatingBuffer.length > 0 && lowRatingBuffer[0].timestamp < cutoff) {
    lowRatingBuffer.shift();
  }
  // Also clear expired fired-client flags
  lowRatingFiredClients.forEach((key) => {
    const [, ts] = key.split('|');
    if (Number(ts) < cutoff) lowRatingFiredClients.delete(key);
  });

  const clientEvents = lowRatingBuffer.filter((e) => e.clientId === clientId);
  const windowKey = `${clientId}|${Math.floor(now / LOW_RATING_WINDOW_MS)}`;

  if (clientEvents.length >= LOW_RATING_THRESHOLD && !lowRatingFiredClients.has(windowKey)) {
    lowRatingFiredClients.add(windowKey);
    return {
      signalType: 'pattern',
      severity: 'watch',
      title: 'Repeated low behavior ratings',
      message: `${clientEvents.length} low-intensity ratings (1–2) in the last hour — possible regression pattern`,
      count: clientEvents.length,
    };
  }

  return null;
}

// ── WATCH: Reinforcement Gap Detection ──
// Fires when a client has received behavior events but no reinforcement
// events within the gap window.

const REINFORCEMENT_GAP_MS = 30 * 60 * 1000; // 30 minutes
const REINFORCEMENT_MIN_BEHAVIORS = 3; // at least 3 behavior events before flagging

interface ClientActivityWindow {
  lastReinforcementAt: number;
  behaviorCountSinceReinforcement: number;
  lastGapFiredAt: number; // prevent re-firing within cooldown
}

const clientActivity: Map<string, ClientActivityWindow> = new Map();
const GAP_COOLDOWN_MS = 30 * 60 * 1000; // only fire once per 30 min per client

/**
 * Call this whenever a reinforcement event is logged for a client.
 * Resets the gap timer.
 */
export function trackReinforcementEvent(clientId: string): void {
  const now = Date.now();
  const entry = clientActivity.get(clientId) || {
    lastReinforcementAt: now,
    behaviorCountSinceReinforcement: 0,
    lastGapFiredAt: 0,
  };
  entry.lastReinforcementAt = now;
  entry.behaviorCountSinceReinforcement = 0;
  clientActivity.set(clientId, entry);
}

/**
 * Call this whenever a behavior event is logged. Returns a WATCH signal
 * if there's a reinforcement gap (many behaviors, no reinforcement).
 */
export function trackBehaviorForReinforcementGap(
  clientId: string
): { signalType: SignalType; severity: SignalSeverity; title: string; message: string; gapMinutes: number } | null {
  const now = Date.now();
  let entry = clientActivity.get(clientId);

  if (!entry) {
    // First behavior event for this client — start tracking
    entry = {
      lastReinforcementAt: now,
      behaviorCountSinceReinforcement: 0,
      lastGapFiredAt: 0,
    };
  }

  entry.behaviorCountSinceReinforcement += 1;
  clientActivity.set(clientId, entry);

  const elapsed = now - entry.lastReinforcementAt;
  const cooldownOk = now - entry.lastGapFiredAt > GAP_COOLDOWN_MS;

  if (
    elapsed >= REINFORCEMENT_GAP_MS &&
    entry.behaviorCountSinceReinforcement >= REINFORCEMENT_MIN_BEHAVIORS &&
    cooldownOk
  ) {
    entry.lastGapFiredAt = now;
    const gapMinutes = Math.round(elapsed / 60_000);
    return {
      signalType: 'pattern',
      severity: 'watch',
      title: 'Reinforcement gap detected',
      message: `${entry.behaviorCountSinceReinforcement} behavior events logged over ${gapMinutes} min with no reinforcement — consider reinforcement opportunity`,
      gapMinutes,
    };
  }

  return null;
}
