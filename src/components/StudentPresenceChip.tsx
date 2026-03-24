/**
 * StudentPresenceChip — Compact live-status chip for student cards.
 * Reads from Nova Core `student_presence` via the Core supabase client.
 */
import { cn } from '@/lib/utils';
import {
  MapPin, Stethoscope, TreePine, Coffee, DoorOpen, Users, BookOpen, Check,
} from 'lucide-react';

export interface StudentPresenceData {
  student_id: string;
  location_type: string;
  location_label?: string | null;
  status: string;
  assigned_staff_id?: string | null;
  updated_at?: string;
}

const LOCATION_CONFIG: Record<string, { label: string; icon: typeof MapPin; className: string }> = {
  classroom:    { label: 'In Class',    icon: Check,        className: 'bg-green-100 text-green-900 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700' },
  playground:   { label: 'Playground',  icon: TreePine,     className: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700' },
  cafeteria:    { label: 'Cafeteria',   icon: Coffee,       className: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700' },
  pull_out:     { label: 'Pull-Out',    icon: BookOpen,     className: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700' },
  therapist:    { label: 'Therapist',   icon: Stethoscope,  className: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700' },
  office:       { label: 'Office',      icon: DoorOpen,     className: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600' },
  with_staff:   { label: 'With Staff',  icon: Users,        className: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-700' },
  hallway:      { label: 'Hallway',     icon: MapPin,       className: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600' },
  restroom:     { label: 'Restroom',    icon: MapPin,       className: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600' },
  absent:       { label: 'Absent',      icon: DoorOpen,     className: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700' },
  on_break:     { label: 'Break',       icon: Coffee,       className: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600' },
};

interface Props {
  presence: StudentPresenceData | null;
  compact?: boolean;
  onClick?: () => void;
}

export function StudentPresenceChip({ presence, compact = true, onClick }: Props) {
  if (!presence) return null;

  const loc = presence.location_type || 'classroom';
  // Don't show chip if student is just "in classroom" — it's the default
  if (loc === 'classroom' && presence.status !== 'absent') return null;

  const config = LOCATION_CONFIG[loc] || LOCATION_CONFIG.classroom;
  const Icon = config.icon;
  const label = presence.location_label || config.label;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium transition-all',
        'hover:opacity-80 active:scale-95',
        config.className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {!compact && label}
      {compact && label.length <= 8 && label}
      {compact && label.length > 8 && label.slice(0, 6) + '…'}
    </button>
  );
}
