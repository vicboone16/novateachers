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
          if (name?.trim()) {
            nameCache.set(id, name.trim());
          }
        }
      } else if (error) {
        console.warn('[resolveDisplayNames] Edge function error:', error.message);
      }
    } catch (err) {
      console.warn('[resolveDisplayNames] Unexpected error:', err);
    }
  }

  const result = new Map<string, string>();
  for (const id of userIds) {
    result.set(id, nameCache.get(id) || id.slice(0, 8) + '…');
  }
  return result;
}

export function clearDisplayNameCache() {
  nameCache.clear();
}
