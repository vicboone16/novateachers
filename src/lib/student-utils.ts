import type { Client } from './types';

/**
 * Normalizes a student/client record that may have either:
 * - split fields: first_name + last_name
 * - unified field: name
 * Returns a Client with first_name and last_name always populated.
 */
export function normalizeClient(record: any): Client {
  if (!record) return record;

  let firstName = record.first_name || '';
  let lastName = record.last_name || '';

  if (!firstName && !lastName && record.name) {
    const parts = record.name.trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }

  return {
    ...record,
    id: record.id || record.client_id || '',
    first_name: firstName,
    last_name: lastName,
  };
}

export function normalizeClients(records: any[]): Client[] {
  return (records || []).map(normalizeClient);
}

/** Display name from a possibly-mixed record */
export function displayName(record: any): string {
  if (!record) return '';
  if (record.first_name || record.last_name) {
    return `${record.first_name || ''} ${record.last_name || ''}`.trim();
  }
  return record.name || '';
}

/** Initials from a possibly-mixed record */
export function displayInitials(record: any): string {
  const name = displayName(record);
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.map(p => p[0]?.toUpperCase()).slice(0, 2).join('');
}
