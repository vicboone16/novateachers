import { describe, expect, it } from 'vitest';
import { validPortalLink, portalScope, verifiedActor } from '../../supabase/functions/_shared/portal-policy';

const link = { student_id: 'student-a', agency_id: 'agency-a', is_active: true, expires_at: null };
describe('portal authorization boundaries', () => {
  it('rejects revoked links', () => expect(validPortalLink({ ...link, is_active: false })).toBe(false));
  it('rejects expired links at the exact expiry', () => expect(validPortalLink({ ...link, expires_at: '2026-10-17T18:39:00Z' }, Date.parse('2026-10-17T18:39:00Z'))).toBe(false));
  it('rejects malformed expiry instead of treating it as unlimited', () => expect(validPortalLink({ ...link, expires_at: 'invalid' })).toBe(false));
  it('accepts intentional non-expiring active links', () => expect(validPortalLink(link)).toBe(true));
  it('rejects links without a bound agency', () => expect(validPortalLink({ ...link, agency_id: '' })).toBe(false));
  it('derives student and agency only from the validated link', () => expect(portalScope(link)).toEqual({ student_id: 'student-a', agency_id: 'agency-a' }));
  it('does not let supplied owner fields override verified identity', () => expect(verifiedActor('verified-user', { created_by: 'attacker', parent_user_id: 'attacker' })).toEqual({ created_by: 'verified-user', parent_user_id: 'verified-user' }));
});