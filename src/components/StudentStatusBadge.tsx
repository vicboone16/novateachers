/**
 * StudentStatusBadge — Brightwheel-style tap-to-toggle student attendance status.
 * Compact badge that cycles through statuses on tap.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Check, X, Clock, Stethoscope, TreePine, Coffee, CarFront,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StudentStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'with_therapist'
  | 'on_playground'
  | 'on_break'
  | 'picked_up';

interface StatusConfig {
  label: string;
  icon: typeof Check;
  className: string;
}

const STATUS_MAP: Record<StudentStatus, StatusConfig> = {
  present: { label: 'Present', icon: Check, className: 'bg-accent/20 text-accent-foreground border-accent/40' },
  absent: { label: 'Absent', icon: X, className: 'bg-destructive/15 text-destructive border-destructive/30' },
  late: { label: 'Late', icon: Clock, className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  with_therapist: { label: 'Therapist', icon: Stethoscope, className: 'bg-primary/15 text-primary border-primary/30' },
  on_playground: { label: 'Playground', icon: TreePine, className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
  on_break: { label: 'Break', icon: Coffee, className: 'bg-muted text-muted-foreground border-border' },
  picked_up: { label: 'Picked Up', icon: CarFront, className: 'bg-secondary text-secondary-foreground border-border' },
};

const STATUS_ORDER: StudentStatus[] = [
  'present', 'absent', 'late', 'with_therapist', 'on_playground', 'on_break', 'picked_up',
];

interface StudentStatusBadgeProps {
  studentId: string;
  groupId: string;
  agencyId: string;
  userId: string;
  currentStatus: StudentStatus;
  onStatusChange: (studentId: string, status: StudentStatus) => void;
}

export function StudentStatusBadge({
  studentId, groupId, agencyId, userId, currentStatus, onStatusChange,
}: StudentStatusBadgeProps) {
  const [saving, setSaving] = useState(false);
  const config = STATUS_MAP[currentStatus] || STATUS_MAP.present;
  const Icon = config.icon;

  const updateStatus = useCallback(async (newStatus: StudentStatus) => {
    if (newStatus === currentStatus) return;
    setSaving(true);
    onStatusChange(studentId, newStatus);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await (supabase as any)
        .from('student_attendance')
        .upsert(
          {
            student_id: studentId,
            group_id: groupId,
            agency_id: agencyId,
            recorded_by: userId,
            recorded_date: today,
            status: newStatus,
            changed_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,group_id,recorded_date' }
        );
      if (error) console.warn('[StudentStatus] upsert failed:', error.message);
    } catch (err) {
      console.warn('[StudentStatus] save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [studentId, groupId, agencyId, userId, currentStatus, onStatusChange]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:opacity-80 active:scale-95',
            config.className,
            saving && 'opacity-50',
          )}
        >
          <Icon className="h-2.5 w-2.5" />
          {config.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {STATUS_ORDER.map((s) => {
          const sc = STATUS_MAP[s];
          const SIcon = sc.icon;
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => updateStatus(s)}
              className={cn('gap-2 text-xs', s === currentStatus && 'bg-accent/20')}
            >
              <SIcon className="h-3 w-3" />
              {sc.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
