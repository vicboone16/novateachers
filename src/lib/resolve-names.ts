/**
 * Resolve user IDs to display names via the resolve-display-names edge function.
 * Falls back to profiles table, then auth.users metadata.
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
    const { data, error } = await invokeCloudFunction<{ names: Record<string, string> }>(
      'resolve-display-names',
      { user_ids: uncached },
      authToken
    );

    if (!error && data?.names) {
      for (const [id, name] of Object.entries(data.names)) {
        nameCache.set(id, name);
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
