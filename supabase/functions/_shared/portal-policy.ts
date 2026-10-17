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

export function verifiedActor(userId: string, values: Record<string, unknown>) {
  return { ...values, created_by: userId, parent_user_id: userId };
}