/**
 * Offline-resilient sync queue for teacher data writes to Core.
 * Routes writes through the core-bridge edge function to avoid
 * iOS "Load failed" errors from direct cross-origin PostgREST calls.
 */
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { supabase } from '@/lib/supabase';

export interface QueuedWrite {
  id: string;
  table: string;
  payload: Record<string, any>;
  timestamp: number;
  retries: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'queued';

const QUEUE_KEY = 'beacon_sync_queue';
const MAX_RETRIES = 5;

/** Maps table names to core-bridge actions for bridged writes */
const BRIDGE_ACTION_MAP: Record<string, string> = {
  teacher_frequency_entries: 'write_frequency',
  teacher_duration_entries: 'write_duration',
  abc_logs: 'write_abc',
  teacher_data_events: 'write_event',
};

function getQueue(): QueuedWrite[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedWrite[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueueLength(): number {
  return getQueue().length;
}

export function enqueue(table: string, payload: Record<string, any>) {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID(),
    table,
    payload,
    timestamp: Date.now(),
    retries: 0,
  });
  saveQueue(queue);
}

/**
 * Write a single row via the core-bridge edge function.
 * Falls back to direct Supabase insert if bridge action is unavailable.
 */
async function bridgedInsert(table: string, payload: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
  const bridgeAction = BRIDGE_ACTION_MAP[table];

  if (bridgeAction) {
    const { data, error } = await invokeCloudFunction('core-bridge', {
      action: bridgeAction,
      ...payload,
    });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true };
  }

  // Fallback: direct Supabase insert for tables not mapped to bridge
  const { error } = await supabase.from(table as any).insert(payload as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Attempt to flush all queued writes. Returns count of remaining failures.
 */
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const stillFailed: QueuedWrite[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const result = await bridgedInsert(item.table, item.payload);
      if (!result.ok) throw new Error(result.error);
      flushed++;
    } catch {
      if (item.retries < MAX_RETRIES) {
        stillFailed.push({ ...item, retries: item.retries + 1 });
      }
      // Drop items that exceeded MAX_RETRIES
    }
  }

  saveQueue(stillFailed);
  return { flushed, remaining: stillFailed.length };
}

/**
 * Wraps a Core write with automatic queuing on failure.
 * Uses the core-bridge edge function for iOS compatibility.
 */
export async function writeWithRetry(
  table: string,
  payload: Record<string, any>,
): Promise<{ ok: boolean; queued: boolean }> {
  try {
    const result = await bridgedInsert(table, payload);
    if (!result.ok) throw new Error(result.error);
    return { ok: true, queued: false };
  } catch {
    enqueue(table, payload);
    return { ok: false, queued: true };
  }
}
