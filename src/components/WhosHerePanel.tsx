/**
 * WhosHerePanel — Real-time staff availability engine.
 * Primary system: behavior-driven availability (not self-reported status).
 * 5 states: available (green), nearby (yellow), assigned (blue), busy (red), offline (gray).
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
  Users2, MessageSquarePlus, Bell, Zap, MoreHorizontal, MapPin, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AvailabilityState = 'available' | 'nearby' | 'assigned' | 'busy' | 'offline';

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
  state: AvailabilityState;
}

interface WhosHerePanelProps {
  agencyId: string;
  classroomId?: string | null;
  variant?: 'full' | 'compact' | 'strip';
  onMessageStaff?: (userId: string) => void;
  onRequestHelp?: (staffIds: string[]) => void;
  onNotifyRoom?: (staffIds: string[]) => void;
}

const STATE_CONFIG: Record<AvailabilityState, { label: string; dot: string; bg: string }> = {
  available: { label: 'Available', dot: 'bg-green-500', bg: 'bg-green-500/10 border-green-500/30' },
  nearby:    { label: 'Nearby',    dot: 'bg-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  assigned:  { label: 'Assigned',  dot: 'bg-blue-500', bg: 'bg-blue-500/10 border-blue-500/30' },
  busy:      { label: 'Busy',      dot: 'bg-red-500', bg: 'bg-red-500/10 border-red-500/30' },
  offline:   { label: 'Offline',   dot: 'bg-muted-foreground', bg: 'bg-muted/30 border-muted' },
};

function deriveState(entry: StaffEntry, currentClassroomId?: string | null): AvailabilityState {
  const minutesSinceUpdate = (Date.now() - new Date(entry.updated_at).getTime()) / 60000;

  // Offline if no update in 60 minutes
  if (minutesSinceUpdate > 60) return 'offline';

  // Busy states
  if (entry.status === 'unavailable' || entry.availability_status === 'unavailable') return 'busy';
  if (entry.status === 'on_break' || entry.status === 'out') return 'busy';

  // Assigned to student
  if (entry.status === 'with_student' || entry.assigned_student_id) return 'assigned';

  // In current classroom = available
  if (currentClassroomId && entry.classroom_group_id === currentClassroomId && entry.status === 'in_room') return 'available';

  // In another classroom but available for support = nearby
  if (entry.available_for_support && entry.status === 'in_room') return 'nearby';
  if (entry.status === 'floating' || entry.status === 'covering') return 'nearby';

  // Available for support generally
  if (entry.available_for_support) return 'available';

  // In office / other = busy
  if (entry.status === 'in_office') return 'busy';

  return 'nearby';
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
        displayName: nameMap.get(r.user_id)?.split(' ')[0] || `Staff`,
        state: deriveState(r, classroomId),
      }));

      // Sort: available > nearby > assigned > busy > offline
      const order: AvailabilityState[] = ['available', 'nearby', 'assigned', 'busy', 'offline'];
      resolved.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));

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

  const available = staff.filter(s => s.state === 'available');
  const nearby = staff.filter(s => s.state === 'nearby');
  const assigned = staff.filter(s => s.state === 'assigned');
  const busy = staff.filter(s => s.state === 'busy');
  const offline = staff.filter(s => s.state === 'offline');

  if (staff.length === 0) return null;

  const hasActions = onRequestHelp || onNotifyRoom;

  // ── Strip variant (for thread headers) ──
  if (variant === 'strip') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap py-1.5">
        {available.slice(0, 3).map(s => (
          <Badge key={s.user_id} variant="secondary" className="text-[9px] h-5 px-1.5 gap-1 cursor-pointer hover:bg-accent/20"
            onClick={() => onMessageStaff?.(s.user_id)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', STATE_CONFIG.available.dot)} />
            {s.displayName}
          </Badge>
        ))}
        {available.length > 3 && (
          <Badge variant="outline" className="text-[9px] h-5 px-1.5">+{available.length - 3}</Badge>
        )}
        {nearby.length > 0 && (
          <Badge variant="outline" className="text-[9px] h-5 px-1.5 gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', STATE_CONFIG.nearby.dot)} />
            {nearby.length} nearby
          </Badge>
        )}
        {assigned.length > 0 && (
          <Badge variant="outline" className="text-[9px] h-5 px-1.5 gap-1">
            <UserCog className="h-2.5 w-2.5 text-blue-500" />
            {assigned.length} assigned
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
              {onRequestHelp && available.length > 0 && (
                <button onClick={() => onRequestHelp(available.map(s => s.user_id))}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-accent/10 transition-colors text-left">
                  <Zap className="h-3 w-3 text-primary" /> Request help ({available.length})
                </button>
              )}
              {onNotifyRoom && (
                <button onClick={() => onNotifyRoom(staff.filter(s => s.state !== 'offline').map(s => s.user_id))}
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

  // ── Full / compact variant ──
  const groups = [
    { state: 'available' as const, items: available, label: 'Available Now' },
    { state: 'nearby' as const, items: nearby, label: 'Nearby' },
    { state: 'assigned' as const, items: assigned, label: 'With Student' },
    { state: 'busy' as const, items: busy, label: 'Busy' },
    ...(variant === 'full' ? [{ state: 'offline' as const, items: offline, label: 'Offline' }] : []),
  ].filter(g => g.items.length > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users2 className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Who's Here</span>
        <div className="flex items-center gap-1 ml-auto">
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
            {available.length}
          </Badge>
          {nearby.length > 0 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 inline-block" />
              {nearby.length}
            </Badge>
          )}
        </div>
      </div>

      {groups.map(({ state, items, label }) => (
        <div key={state}>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
          <div className="space-y-0.5">
            {items.map(s => {
              const cfg = STATE_CONFIG[s.state];
              return (
                <button key={s.user_id}
                  onClick={() => onMessageStaff?.(s.user_id)}
                  className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {s.user_id === user?.id ? 'You' : s.displayName}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      {s.location_label && <span>{s.location_label}</span>}
                      {s.note && <span className="italic truncate max-w-[100px]">"{s.note}"</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[8px] h-3.5 px-1 shrink-0 border', cfg.bg)}>
                    {cfg.label}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
