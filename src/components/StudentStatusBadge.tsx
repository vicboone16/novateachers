/**
 * StudentStatusBadge — Brightwheel-style tap-to-toggle student attendance status.
 * Reads/writes to Core-owned `student_attendance_status` table.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
  present: { label: 'Present', icon: Check, className: 'bg-green-100 text-green-900 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700' },
  absent: { label: 'Absent', icon: X, className: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700' },
  late: { label: 'Late', icon: Clock, className: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700' },
  with_therapist: { label: 'Therapist', icon: Stethoscope, className: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700' },
  on_playground: { label: 'Playground', icon: TreePine, className: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700' },
  on_break: { label: 'Break', icon: Coffee, className: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600' },
  picked_up: { label: 'Picked Up', icon: CarFront, className: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700' },
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
      // Core-owned table: student_attendance_status
      // Upsert by student + classroom + date
      const { error } = await supabase
        .from('student_attendance_status' as any)
        .upsert(
          {
            student_id: studentId,
            classroom_id: groupId,
            agency_id: agencyId,
            recorded_by: userId,
            recorded_date: today,
            status: newStatus,
            changed_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,classroom_id,recorded_date' }
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
