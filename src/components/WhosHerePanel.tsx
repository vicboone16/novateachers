/**
 * WhosHerePanel — Real-time staff visibility panel.
 * Uses the SAME status options as "Update My Status" (StaffActionSheet):
 *   In Room, Out, On Break, In Office, Floating, Covering, With Student, Unavailable
 * Plus availability: Available, Limited, Unavailable
 * Admin can override any staff member's status.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Users2, Bell, Zap, MoreHorizontal, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESENCE_STATUS_MAP, PRESENCE_STATUS_ORDER, type PresenceStatus } from './StaffPresencePanel';

interface StaffEntry {
  user_id: string;
  status: string;
  available_for_support: boolean;
  assigned_student_id: string | null;
  location_label: string | null;
  classroom_group_id: string | null;
  availability_status: string;
  updated_at: string;
  note: string | null;
}

interface ResolvedStaff extends StaffEntry {
  displayName: string;
  presenceStatus: PresenceStatus;
  isOffline: boolean;
}

interface WhosHerePanelProps {
  agencyId: string;
  classroomId?: string | null;
  variant?: 'full' | 'compact' | 'strip';
  onMessageStaff?: (userId: string) => void;
  onRequestHelp?: (staffIds: string[]) => void;
  onNotifyRoom?: (staffIds: string[]) => void;
}

/** Availability dot colors matching StaffActionSheet */
function getAvailabilityDot(entry: StaffEntry): string {
  const minutesSinceUpdate = (Date.now() - new Date(entry.updated_at).getTime()) / 60000;
  if (minutesSinceUpdate > 60) return 'bg-foreground';
  if (entry.availability_status === 'available' || entry.available_for_support) return 'bg-green-500';
  if (entry.availability_status === 'limited') return 'bg-amber-500';
  return 'bg-muted-foreground';
}

function isStaffOffline(entry: StaffEntry): boolean {
  const minutesSinceUpdate = (Date.now() - new Date(entry.updated_at).getTime()) / 60000;
  return minutesSinceUpdate > 60;
}

export function WhosHerePanel({
  agencyId, classroomId, variant = 'strip',
  onMessageStaff, onRequestHelp, onNotifyRoom,
}: WhosHerePanelProps) {
  const { user } = useAuth();
  const [staff, setStaff] = useState<ResolvedStaff[]>([]);

  const load = useCallback(async () => {
    if (!agencyId) return;
    try {
      const { data } = await cloudSupabase
        .from('staff_presence')
        .select('user_id, status, available_for_support, assigned_student_id, location_label, classroom_group_id, availability_status, updated_at, note')
        .eq('agency_id', agencyId);
      const rows = (data || []) as StaffEntry[];

      const ids = rows.map(r => r.user_id);
      let nameMap = new Map<string, string>();
      if (ids.length > 0) {
        try { nameMap = await resolveDisplayNames(ids); } catch { /* silent */ }
      }

      const resolved: ResolvedStaff[] = rows.map(r => ({
        ...r,
        displayName: nameMap.get(r.user_id)?.split(' ')[0] || 'Staff',
        presenceStatus: (PRESENCE_STATUS_MAP[r.status as PresenceStatus] ? r.status : 'in_room') as PresenceStatus,
        isOffline: isStaffOffline(r),
      }));

      // Sort: available first, then by status order, offline last
      resolved.sort((a, b) => {
        if (a.isOffline !== b.isOffline) return a.isOffline ? 1 : -1;
        const availA = a.available_for_support ? 0 : 1;
        const availB = b.available_for_support ? 0 : 1;
        if (availA !== availB) return availA - availB;
        return PRESENCE_STATUS_ORDER.indexOf(a.presenceStatus) - PRESENCE_STATUS_ORDER.indexOf(b.presenceStatus);
      });

      setStaff(resolved);
    } catch { /* silent */ }
  }, [agencyId, classroomId]);

  useEffect(() => {
    load();
    const channel = cloudSupabase
      .channel('whos_here_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_presence' }, () => load())
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [agencyId, load]);

  if (staff.length === 0) return null;

  const availableStaff = staff.filter(s => !s.isOffline && s.available_for_support);
  const onlineStaff = staff.filter(s => !s.isOffline);
  const hasActions = onRequestHelp || onNotifyRoom;

  // ── Strip variant (for thread headers) ──
  if (variant === 'strip') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap py-1.5">
        {availableStaff.slice(0, 3).map(s => {
          const cfg = PRESENCE_STATUS_MAP[s.presenceStatus];
          return (
            <Badge key={s.user_id} variant="secondary" className="text-[9px] h-5 px-1.5 gap-1 cursor-pointer hover:bg-accent/20"
              onClick={() => onMessageStaff?.(s.user_id)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', getAvailabilityDot(s))} />
              {s.displayName}
              <span className="text-muted-foreground">{cfg.label}</span>
            </Badge>
          );
        })}
        {availableStaff.length > 3 && (
          <Badge variant="outline" className="text-[9px] h-5 px-1.5">+{availableStaff.length - 3}</Badge>
        )}
        {onlineStaff.length > availableStaff.length && (
          <Badge variant="outline" className="text-[9px] h-5 px-1.5 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground inline-block" />
            {onlineStaff.length - availableStaff.length} busy
          </Badge>
        )}

        {hasActions && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-primary">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1.5 space-y-0.5" align="end" side="bottom">
              {onRequestHelp && availableStaff.length > 0 && (
                <button onClick={() => onRequestHelp(availableStaff.map(s => s.user_id))}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-accent/10 transition-colors text-left">
                  <Zap className="h-3 w-3 text-primary" /> Request help ({availableStaff.length})
                </button>
              )}
              {onNotifyRoom && (
                <button onClick={() => onNotifyRoom(onlineStaff.map(s => s.user_id))}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-accent/10 transition-colors text-left">
                  <Bell className="h-3 w-3 text-primary" /> Notify all staff
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // ── Full / compact variant — group by actual status ──
  const statusGroups = PRESENCE_STATUS_ORDER
    .map(statusKey => ({
      statusKey,
      cfg: PRESENCE_STATUS_MAP[statusKey],
      items: staff.filter(s => !s.isOffline && s.presenceStatus === statusKey),
    }))
    .filter(g => g.items.length > 0);

  const offlineItems = staff.filter(s => s.isOffline);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users2 className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Who's Here</span>
        <div className="flex items-center gap-1 ml-auto">
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
            {availableStaff.length}
          </Badge>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
            {onlineStaff.length} online
          </Badge>
        </div>
      </div>

      {statusGroups.map(({ statusKey, cfg, items }) => {
        const Icon = cfg.icon;
        return (
          <div key={statusKey}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{cfg.label}</p>
            </div>
            <div className="space-y-0.5">
              {items.map(s => (
                <button key={s.user_id}
                  onClick={() => onMessageStaff?.(s.user_id)}
                  className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', getAvailabilityDot(s))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">
                        {s.user_id === user?.id ? 'You' : s.displayName}
                      </p>
                      {s.available_for_support && (
                        <span className="text-[8px] text-green-600 dark:text-green-400 shrink-0">● available</span>
                      )}
                      {s.availability_status === 'limited' && (
                        <span className="text-[8px] text-amber-600 dark:text-amber-400 shrink-0">● limited</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      {s.location_label && <span>{s.location_label}</span>}
                      {s.note && <span className="italic truncate max-w-[100px]">"{s.note}"</span>}
                    </div>
                  </div>
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {variant === 'full' && offlineItems.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Offline</p>
          </div>
          <div className="space-y-0.5">
            {offlineItems.map(s => (
              <div key={s.user_id} className="flex items-center gap-2 px-2 py-1.5 opacity-50">
                <span className="h-2 w-2 rounded-full shrink-0 bg-foreground" />
                <p className="text-xs text-muted-foreground truncate">
                  {s.user_id === user?.id ? 'You' : s.displayName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
