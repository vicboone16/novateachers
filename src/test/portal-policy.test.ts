import { describe, expect, it } from 'vitest';
import { validPortalLink, portalScope, verifiedActor, engagementBonus } from '../../supabase/functions/_shared/portal-policy';

const link = { student_id: 'student-a', agency_id: 'agency-a', is_active: true, expires_at: null };
describe('portal authorization boundaries', () => {
  it('rejects revoked links', () => expect(validPortalLink({ ...link, is_active: false })).toBe(false));
  it('rejects expired links at the exact expiry', () => expect(validPortalLink({ ...link, expires_at: '2026-10-17T18:39:00Z' }, Date.parse('2026-10-17T18:39:00Z'))).toBe(false));
  it('rejects malformed expiry instead of treating it as unlimited', () => expect(validPortalLink({ ...link, expires_at: 'invalid' })).toBe(false));
  it('accepts intentional non-expiring active links', () => expect(validPortalLink(link)).toBe(true));
  it('rejects links without a bound agency', () => expect(validPortalLink({ ...link, agency_id: '' })).toBe(false));
  it('derives student and agency only from the validated link', () => expect(portalScope(link)).toEqual({ student_id: 'student-a', agency_id: 'agency-a' }));
  it('does not let supplied ownership override verified identity', () => expect(verifiedActor('verified-user', { parent_user_id: 'attacker' })).toEqual({ parent_user_id: 'verified-user' }));
  it('retains null ownership for proven guest requests', () => expect(verifiedActor(null, { parent_user_id: 'attacker' })).toEqual({ parent_user_id: null }));
  it('preserves praise engagement bonus of two', () => expect(engagementBonus('praise_at_home')).toBe(2));
  it('preserves home followup engagement bonus of three', () => expect(engagementBonus('home_followup')).toBe(3));
  it('preserves noticed engagement bonus of one', () => expect(engagementBonus('noticed_too')).toBe(1));
  it('does not award points for questions', () => expect(engagementBonus('ask_question')).toBe(0));
});