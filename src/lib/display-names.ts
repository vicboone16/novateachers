import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { clearDisplayNameCache } from '@/lib/resolve-names';

interface SaveDisplayNameInput {
  userId: string;
  displayName: string;
  agencyId?: string | null;
  syncCurrentUserAuth?: boolean;
}

interface SaveDisplayNameResult {
  ok: boolean;
  saved_name: string;
  metadata_synced?: boolean;
}

export async function saveStaffDisplayName({
  userId,
  displayName,
  agencyId,
  syncCurrentUserAuth = false,
}: SaveDisplayNameInput): Promise<{ data: SaveDisplayNameResult | null; error: Error | null }> {
  const trimmed = displayName.trim();

  if (!userId) {
    return { data: null, error: new Error('Missing user ID') };
  }

  if (!trimmed) {
    return { data: null, error: new Error('Display name is required') };
  }

  const { data, error } = await invokeCloudFunction<SaveDisplayNameResult>('save-display-name', {
    user_id: userId,
    display_name: trimmed,
    agency_id: agencyId ?? null,
  });

  if (error) {
    return { data: null, error };
  }

  if (syncCurrentUserAuth) {
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: trimmed,
        display_name: trimmed,
        name: trimmed,
      },
    });

    if (authError && import.meta.env.DEV) {
      console.warn('[saveStaffDisplayName] Failed to sync current user metadata:', authError.message);
    }
  }

  clearDisplayNameCache();
  return { data, error: null };
}