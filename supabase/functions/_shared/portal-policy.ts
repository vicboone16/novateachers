export interface AccessLink {
  student_id: string;
  agency_id: string;
  is_active: boolean;
  expires_at: string | null;
}

export function validPortalLink(link: AccessLink | null, now = Date.now()): link is AccessLink {
  if (!link?.is_active || !link.student_id || !link.agency_id) return false;
  if (link.expires_at === null) return true;
  const expiry = Date.parse(link.expires_at);
  return Number.isFinite(expiry) && expiry > now;
}

export function portalScope(link: AccessLink) {
  return { student_id: link.student_id, agency_id: link.agency_id };
}

export function verifiedActor(userId: string | null, values: Record<string, unknown>) {
  return { ...values, parent_user_id: userId };
}

export function engagementBonus(actionType: string) {
  return actionType === 'praise_at_home' ? 2 : actionType === 'home_followup' ? 3 : actionType === 'noticed_too' ? 1 : 0;
}