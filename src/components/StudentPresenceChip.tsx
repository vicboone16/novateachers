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
  classroom:    { label: 'In Class',    icon: Check,        className: 'bg-accent/15 text-accent-foreground border-accent/30' },
  playground:   { label: 'Playground',  icon: TreePine,     className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
  cafeteria:    { label: 'Cafeteria',   icon: Coffee,       className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  pull_out:     { label: 'Pull-Out',    icon: BookOpen,     className: 'bg-primary/15 text-primary border-primary/30' },
  therapist:    { label: 'Therapist',   icon: Stethoscope,  className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  office:       { label: 'Office',      icon: DoorOpen,     className: 'bg-muted text-muted-foreground border-border' },
  with_staff:   { label: 'With Staff',  icon: Users,        className: 'bg-secondary text-secondary-foreground border-border' },
  hallway:      { label: 'Hallway',     icon: MapPin,       className: 'bg-muted text-muted-foreground border-border' },
  restroom:     { label: 'Restroom',    icon: MapPin,       className: 'bg-muted text-muted-foreground border-border' },
  absent:       { label: 'Absent',      icon: DoorOpen,     className: 'bg-destructive/15 text-destructive border-destructive/30' },
  on_break:     { label: 'Break',       icon: Coffee,       className: 'bg-muted text-muted-foreground border-border' },
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
