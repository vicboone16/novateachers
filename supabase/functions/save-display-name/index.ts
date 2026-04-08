import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CORE_URL = Deno.env.get('VITE_CORE_SUPABASE_URL') || 'https://yboqqmkghwhlhhnsegje.supabase.co';
const CORE_ANON_KEY = Deno.env.get('VITE_CORE_SUPABASE_ANON_KEY') || '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function authenticateRequest(authHeader: string) {
  const token = authHeader.replace('Bearer ', '');

  try {
    const cloudClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await cloudClient.auth.getUser(token);
    if (!error && user) return { authenticated: true, userId: user.id };
  } catch {
    // continue to next auth tier
  }

  try {
    const coreClient = createClient(CORE_URL, CORE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await coreClient.auth.getUser(token);
    if (!error && user) return { authenticated: true, userId: user.id };
  } catch {
    // continue to final auth tier
  }

  try {
    const response = await fetch(`${CORE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: CORE_ANON_KEY },
    });

    if (response.ok) {
      const user = await response.json();
      if (user?.id) return { authenticated: true, userId: user.id as string };
    }
  } catch {
    // final auth tier failed
  }

  return { authenticated: false, userId: null as string | null };
}

async function persistProfileName(adminClient: ReturnType<typeof createClient>, userId: string, displayName: string, email?: string | null) {
  const { data: existingProfile, error: profileLookupError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileLookupError && /relation .*profiles/i.test(profileLookupError.message)) {
    return;
  }

  if (profileLookupError) throw profileLookupError;

  const updatePayload = {
    full_name: displayName,
    display_name: displayName,
  };

  if (existingProfile) {
    const { error } = await adminClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (error && /relation .*profiles/i.test(error.message)) {
      return;
    }

    if (error && /column .*display_name/i.test(error.message)) {
      const retry = await adminClient
        .from('profiles')
        .update({ full_name: displayName })
        .eq('id', userId);
      if (retry.error) throw retry.error;
      return;
    }

    if (error) throw error;
    return;
  }

  const insertPayload = {
    id: userId,
    full_name: displayName,
    display_name: displayName,
    email: email ?? null,
  };

  const { error } = await adminClient
    .from('profiles')
    .upsert(insertPayload, { onConflict: 'id' });

  if (error && /relation .*profiles/i.test(error.message)) {
    return;
  }

  if (error && /column .*display_name/i.test(error.message)) {
    const retry = await adminClient
      .from('profiles')
      .upsert({ id: userId, full_name: displayName, email: email ?? null }, { onConflict: 'id' });
    if (retry.error) throw retry.error;
    return;
  }

  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const serviceKey = Deno.env.get('CORE_SERVICE_ROLE_KEY');
  if (!serviceKey) {
    return json({ error: 'Missing CORE_SERVICE_ROLE_KEY' }, 500);
  }

  try {
    const { authenticated, userId: callerUserId } = await authenticateRequest(authHeader);
    if (!authenticated || !callerUserId) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const agencyId = typeof body.agency_id === 'string' && body.agency_id.trim() ? body.agency_id.trim() : null;

    if (!targetUserId || !displayName) {
      return json({ error: 'user_id and display_name are required' }, 400);
    }

    if (displayName.length > 80) {
      return json({ error: 'Display name must be 80 characters or less' }, 400);
    }

    const adminClient = createClient(CORE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (targetUserId !== callerUserId) {
      if (!agencyId) {
        return json({ error: 'agency_id is required when editing another user' }, 400);
      }

      const { data: membership, error: membershipError } = await adminClient
        .from('agency_memberships')
        .select('role')
        .eq('agency_id', agencyId)
        .eq('user_id', callerUserId)
        .maybeSingle();

      if (membershipError || !membership || !['owner', 'admin'].includes(String(membership.role || '').toLowerCase())) {
        return json({ error: 'Forbidden' }, 403);
      }

      const { data: targetMembership } = await adminClient
        .from('agency_memberships')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!targetMembership) {
        return json({ error: 'Target user is not in this workspace' }, 404);
      }
    }

    const { data: targetUserData, error: targetUserError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetUserError || !targetUserData.user) {
      return json({ error: targetUserError?.message || 'User not found' }, 404);
    }

    await persistProfileName(adminClient, targetUserId, displayName, targetUserData.user.email);

    const existingMetadata = (targetUserData.user.user_metadata || {}) as Record<string, unknown>;
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...existingMetadata,
        full_name: displayName,
        display_name: displayName,
        name: displayName,
      },
    });

    if (metadataError) {
      console.warn('Failed to sync auth metadata:', metadataError.message);
    }

    return json({ ok: true, saved_name: displayName, metadata_synced: !metadataError });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});