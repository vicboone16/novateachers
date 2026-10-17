import { describe, expect, it } from 'vitest';

const cloudUrl = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function anonymousRequest(path: string, body?: Record<string, unknown>) {
  if (!cloudUrl || !publicKey) throw new Error('Cloud test configuration is missing');
  return fetch(`${cloudUrl}/rest/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('anonymous Cloud access restrictions', () => {
  it('rejects reading private help history', async () => {
    const response = await anonymousRequest('help_interactions?select=id&limit=1');
    expect(response.ok).toBe(false);
    expect((await response.json()).code).toBe('42501');
  });

  const routines = [
    ['apply_invite_code_access', { p_code: '__security_test_invalid__', p_expected_app_context: 'novateachers', p_redeemer_id: null }],
    ['create_invite_code', { p_agency_id: null, p_role_slug: 'teacher', p_created_by: null, p_expires_at: null, p_app_context: 'novateachers', p_max_uses: 1, p_invite_scope: 'agency', p_note: null }],
    ['redeem_invite_code', { p_code: '__security_test_invalid__', p_expected_app_context: 'novateachers', p_redeemer_id: null }],
    ['override_reward_price', { p_student_id: null, p_reward_id: null, p_new_price: 0, p_staff_id: null, p_reason: '__security_test__' }],
    ['restock_reward_inventory', { p_student_id: null, p_reward_id: null, p_quantity: 0, p_staff_id: null, p_agency_id: null }],
  ] as const;

  for (const [routine, args] of routines) {
    it(`rejects anonymous execution of ${routine}`, async () => {
      const response = await anonymousRequest(`rpc/${routine}`, args);
      expect(response.ok).toBe(false);
      expect(['42501', 'PGRST202']).toContain((await response.json()).code);
    });
  }
});