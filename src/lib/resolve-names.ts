/**
 * Resolve user IDs to display names via the resolve-display-names edge function.
 * Falls back to truncated IDs if the function is unavailable.
 */

import { invokeCloudFunction } from '@/lib/cloud-functions';

const nameCache = new Map<string, string>();

export async function resolveDisplayNames(
  userIds: string[],
  authToken?: string
): Promise<Map<string, string>> {
  // Filter out already-cached IDs
  const uncached = userIds.filter(id => !nameCache.has(id));
  
  if (uncached.length > 0) {
    try {
      const { data, error } = await invokeCloudFunction<{ names: Record<string, string> }>(
        'resolve-display-names',
        { user_ids: uncached },
        authToken
      );

      if (!error && data?.names) {
        for (const [id, name] of Object.entries(data.names)) {
          nameCache.set(id, name);
        }
      } else if (error) {
        console.warn('[resolveDisplayNames] Edge function error:', error.message);
        // Fallback: cache truncated IDs so we don't retry endlessly
        for (const id of uncached) {
          nameCache.set(id, id.slice(0, 8) + '…');
        }
      }
    } catch (err) {
      console.warn('[resolveDisplayNames] Unexpected error:', err);
      for (const id of uncached) {
        nameCache.set(id, id.slice(0, 8) + '…');
      }
    }
  }

  const result = new Map<string, string>();
  for (const id of userIds) {
    if (nameCache.has(id)) {
      result.set(id, nameCache.get(id)!);
    }
  }
  return result;
}

export function clearDisplayNameCache() {
  nameCache.clear();
}
