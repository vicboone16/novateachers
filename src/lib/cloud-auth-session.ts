const CLOUD_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const CLOUD_STORAGE_PREFIX = CLOUD_PROJECT_ID ? `sb-${CLOUD_PROJECT_ID}-auth-token` : null;

function clearPrefixedStorage(storage: Storage, prefix: string) {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
}

export function clearCloudAuthStorage() {
  if (!CLOUD_STORAGE_PREFIX || typeof window === 'undefined') return;

  try {
    clearPrefixedStorage(window.localStorage, CLOUD_STORAGE_PREFIX);
    clearPrefixedStorage(window.sessionStorage, CLOUD_STORAGE_PREFIX);
  } catch {
    // ignore storage access issues
  }
}

export function bootstrapCloudAuthSession() {
  clearCloudAuthStorage();
}