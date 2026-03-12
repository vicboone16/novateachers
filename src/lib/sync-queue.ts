/**
 * Offline-resilient sync queue for teacher data writes to Core.
 * Queues failed writes in localStorage and retries them when online.
 */
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
 * Attempt to flush all queued writes. Returns count of remaining failures.
 */
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const stillFailed: QueuedWrite[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const { error } = await supabase.from(item.table as any).insert(item.payload as any);
      if (error) throw error;
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
 * Wraps a Supabase insert with automatic queuing on failure.
 * Returns success status; on failure queues for retry.
 */
export async function writeWithRetry(
  table: string,
  payload: Record<string, any>,
): Promise<{ ok: boolean; queued: boolean }> {
  try {
    const { error } = await supabase.from(table as any).insert(payload as any);
    if (error) throw error;
    return { ok: true, queued: false };
  } catch {
    enqueue(table, payload);
    return { ok: false, queued: true };
  }
}
