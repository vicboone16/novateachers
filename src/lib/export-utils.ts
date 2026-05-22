/**
 * Client-side CSV export utilities.
 * All exports happen in the browser — no server round-trip needed.
 */

function escapeCsvCell(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(',')),
  ];
  return lines.join('\r\n');
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Domain-specific exporters ─────────────────────────────────────────────

export interface FreqEntry { behavior_name: string; count: number; logged_date: string; }
export interface DurEntry { behavior_name: string; duration_seconds: number; logged_date: string; }
export interface AbcEntry {
  antecedent: string; behavior: string; consequence: string;
  logged_at: string; intensity?: number | null;
  behavior_category?: string | null; notes?: string | null;
}
export interface QuickNoteEntry { behavior_name: string | null; note: string; logged_at: string; }
export interface PointsEntry { points: number; source: string; reason: string | null; entry_kind: string | null; created_at: string; }

export function exportFrequencyData(studentName: string, weekLabel: string, entries: FreqEntry[]): void {
  if (!entries.length) return;
  const headers = ['Date', 'Behavior', 'Count'];
  const rows = entries.map(e => [e.logged_date, e.behavior_name, e.count]);
  const csv = buildCsv(headers, rows);
  downloadCsv(`${studentName}_frequency_${weekLabel.replace(/[^a-z0-9]/gi, '_')}.csv`, csv);
}

export function exportDurationData(studentName: string, weekLabel: string, entries: DurEntry[]): void {
  if (!entries.length) return;
  const headers = ['Date', 'Behavior', 'Duration (seconds)', 'Duration (formatted)'];
  const rows = entries.map(e => [e.logged_date, e.behavior_name, e.duration_seconds, formatSeconds(e.duration_seconds)]);
  const csv = buildCsv(headers, rows);
  downloadCsv(`${studentName}_duration_${weekLabel.replace(/[^a-z0-9]/gi, '_')}.csv`, csv);
}

export function exportAbcLogs(studentName: string, weekLabel: string, entries: AbcEntry[]): void {
  if (!entries.length) return;
  const headers = ['Date/Time', 'Antecedent', 'Behavior', 'Behavior Category', 'Intensity', 'Consequence', 'Notes'];
  const rows = entries.map(e => [
    e.logged_at,
    e.antecedent,
    e.behavior,
    e.behavior_category ?? '',
    e.intensity ?? '',
    e.consequence,
    e.notes ?? '',
  ]);
  const csv = buildCsv(headers, rows);
  downloadCsv(`${studentName}_abc_logs_${weekLabel.replace(/[^a-z0-9]/gi, '_')}.csv`, csv);
}

export function exportPointsLedger(studentName: string, weekLabel: string, entries: PointsEntry[]): void {
  if (!entries.length) return;
  const headers = ['Date/Time', 'Points', 'Source', 'Entry Kind', 'Reason'];
  const rows = entries.map(e => [e.created_at, e.points, e.source, e.entry_kind ?? '', e.reason ?? '']);
  const csv = buildCsv(headers, rows);
  downloadCsv(`${studentName}_points_${weekLabel.replace(/[^a-z0-9]/gi, '_')}.csv`, csv);
}

export function exportNotes(studentName: string, weekLabel: string, entries: QuickNoteEntry[]): void {
  if (!entries.length) return;
  const headers = ['Date/Time', 'Behavior', 'Note'];
  const rows = entries.map(e => [e.logged_at, e.behavior_name ?? '', e.note]);
  const csv = buildCsv(headers, rows);
  downloadCsv(`${studentName}_notes_${weekLabel.replace(/[^a-z0-9]/gi, '_')}.csv`, csv);
}

/**
 * Export all data types in a single combined file with section separators.
 */
export function exportAllStudentData(
  studentName: string,
  weekLabel: string,
  data: {
    freq: FreqEntry[];
    dur: DurEntry[];
    abc: AbcEntry[];
    notes: QuickNoteEntry[];
    points: PointsEntry[];
  },
): void {
  const lines: string[] = [`Student: ${studentName}`, `Week: ${weekLabel}`, ''];

  if (data.freq.length) {
    lines.push('=== FREQUENCY DATA ===');
    lines.push(buildCsv(['Date', 'Behavior', 'Count'], data.freq.map(e => [e.logged_date, e.behavior_name, e.count])));
    lines.push('');
  }

  if (data.dur.length) {
    lines.push('=== DURATION DATA ===');
    lines.push(buildCsv(
      ['Date', 'Behavior', 'Duration (seconds)', 'Duration (formatted)'],
      data.dur.map(e => [e.logged_date, e.behavior_name, e.duration_seconds, formatSeconds(e.duration_seconds)]),
    ));
    lines.push('');
  }

  if (data.abc.length) {
    lines.push('=== ABC LOGS ===');
    lines.push(buildCsv(
      ['Date/Time', 'Antecedent', 'Behavior', 'Category', 'Intensity', 'Consequence', 'Notes'],
      data.abc.map(e => [e.logged_at, e.antecedent, e.behavior, e.behavior_category ?? '', e.intensity ?? '', e.consequence, e.notes ?? '']),
    ));
    lines.push('');
  }

  if (data.notes.length) {
    lines.push('=== QUICK NOTES ===');
    lines.push(buildCsv(['Date/Time', 'Behavior', 'Note'], data.notes.map(e => [e.logged_at, e.behavior_name ?? '', e.note])));
    lines.push('');
  }

  if (data.points.length) {
    lines.push('=== BEACON POINTS ===');
    lines.push(buildCsv(
      ['Date/Time', 'Points', 'Source', 'Entry Kind', 'Reason'],
      data.points.map(e => [e.created_at, e.points, e.source, e.entry_kind ?? '', e.reason ?? '']),
    ));
  }

  const csv = lines.join('\r\n');
  downloadCsv(`${studentName}_all_data_${weekLabel.replace(/[^a-z0-9]/gi, '_')}.csv`, csv);
}
