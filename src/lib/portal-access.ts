import { invokeCloudFunction } from '@/lib/cloud-functions';

export interface PortalData {
  studentId: string; agencyId: string; studentName: string; avatarEmoji: string;
  pointsBalance: number; narrative: string | null;
  rewards: { name: string; emoji: string; cost: number }[];
  feedPosts: { id: string; body: string; title: string | null; created_at: string }[];
  insights: any[]; messages: any[]; quests: any[];
}

/** Intentionally no bearer: link holders are guests, not staff impersonations. */
export async function portalRequest<T = PortalData>(token: string, values: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ token, ...values }), referrerPolicy: 'no-referrer',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not access portal');
  return data as T;
}

export async function staffPortalLinks(values: Record<string, unknown>) {
  const { data, error } = await invokeCloudFunction('portal-links', values);
  if (error) throw error;
  return data;
}