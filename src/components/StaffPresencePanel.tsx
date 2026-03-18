/**
 * StaffPresencePanel — shows current user's presence status in a classroom.
 * Reads/writes to Core-owned `staff_presence_status` table.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  UserCheck, UserX, TreePine, UserCog, Briefcase, Coffee, ShieldCheck,
  ChevronDown, Users2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StaffStatus =
  | 'in_classroom'
  | 'absent'
  | 'on_playground'
  | 'with_student'
  | 'in_office'
  | 'on_break'
  | 'sub_covering';

interface StaffStatusConfig {
  label: string;
  icon: typeof UserCheck;
  className: string;
}

const STAFF_STATUS_MAP: Record<StaffStatus, StaffStatusConfig> = {
  in_classroom: { label: 'In Classroom', icon: UserCheck, className: 'bg-accent/20 text-accent-foreground' },
  absent: { label: 'Absent', icon: UserX, className: 'bg-destructive/15 text-destructive' },
  on_playground: { label: 'Playground', icon: TreePine, className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  with_student: { label: 'With Student', icon: UserCog, className: 'bg-primary/15 text-primary' },
  in_office: { label: 'In Office', icon: Briefcase, className: 'bg-secondary text-secondary-foreground' },
  on_break: { label: 'On Break', icon: Coffee, className: 'bg-muted text-muted-foreground' },
  sub_covering: { label: 'Sub Covering', icon: ShieldCheck, className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' },
};

const STAFF_STATUS_ORDER: StaffStatus[] = [
  'in_classroom', 'on_playground', 'with_student', 'in_office', 'on_break', 'sub_covering', 'absent',
];

interface StaffPresencePanelProps {
  groupId: string;
  agencyId: string;
}

export function StaffPresencePanel({ groupId, agencyId }: StaffPresencePanelProps) {
  const { user } = useAuth();
  const [myStatus, setMyStatus] = useState<StaffStatus>('in_classroom');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    loadPresence();
  }, [user, groupId]);

  const loadPresence = async () => {
    if (!user) return;
    try {
      // Core-owned table: staff_presence_status
      const { data } = await supabase
        .from('staff_presence_status' as any)
        .select('status')
        .eq('user_id', user.id)
        .eq('classroom_id', groupId)
        .maybeSingle();
      if (data?.status) setMyStatus(data.status as StaffStatus);
    } catch { /* silent — table may not exist yet on Core */ }
  };

  const updateStatus = useCallback(async (newStatus: StaffStatus) => {
    if (!user || newStatus === myStatus) return;
    setSaving(true);
    setMyStatus(newStatus);

    try {
      // Core-owned table: staff_presence_status
      // Upsert by user + classroom
      const { error } = await supabase
        .from('staff_presence_status' as any)
        .upsert(
          {
            user_id: user.id,
            classroom_id: groupId,
            agency_id: agencyId,
            status: newStatus,
            changed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,classroom_id' }
        );
      if (error) console.warn('[StaffPresence] upsert failed:', error.message);
    } catch (err) {
      console.warn('[StaffPresence] save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [user, groupId, agencyId, myStatus]);

  const config = STAFF_STATUS_MAP[myStatus];
  const Icon = config.icon;

  return (
    <Card className="border-border/40">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Users2 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground">My Status</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={saving}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all hover:opacity-80 active:scale-95 mt-0.5',
                  config.className,
                  saving && 'opacity-50',
                )}
              >
                <Icon className="h-3 w-3" />
                {config.label}
                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              {STAFF_STATUS_ORDER.map((s) => {
                const sc = STAFF_STATUS_MAP[s];
                const SIcon = sc.icon;
                return (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => updateStatus(s)}
                    className={cn('gap-2 text-xs', s === myStatus && 'bg-accent/20')}
                  >
                    <SIcon className="h-3 w-3" />
                    {sc.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
