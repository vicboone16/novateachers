/**
 * WhosHerePanel — Real-time interactive staff visibility panel.
 * Uses the SAME status options as "Update My Status" (StaffActionSheet).
 * Tapping a staff chip opens an action sheet with: Message, Request Help,
 * View Room, Add to Thread, Move to Room (admin), Mark Helping.
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Users2, Bell, Zap, MoreHorizontal, MessageSquare,
  HandHelping, Eye, UserPlus, ArrowRightLeft, HeartHandshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESENCE_STATUS_MAP, PRESENCE_STATUS_ORDER, type PresenceStatus } from './StaffPresencePanel';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';

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
  onAddToThread?: (userId: string) => void;
  onViewRoom?: (classroomId: string) => void;
}

/** Availability dot colors */
function getAvailabilityDot(entry: StaffEntry): string {
  const minutesSinceUpdate = (Date.now() - new Date(entry.updated_at).getTime()) / 60000;
  if (minutesSinceUpdate > 60) return 'bg-muted-foreground/40';
  if (entry.availability_status === 'available' || entry.available_for_support) return 'bg-green-500';
  if (entry.availability_status === 'limited') return 'bg-amber-500';
  return 'bg-destructive/60';
}

function isStaffOffline(entry: StaffEntry): boolean {
  return (Date.now() - new Date(entry.updated_at).getTime()) / 60000 > 60;
}

export function WhosHerePanel({
  agencyId, classroomId, variant = 'strip',
  onMessageStaff, onRequestHelp, onNotifyRoom, onAddToThread, onViewRoom,
}: WhosHerePanelProps) {
  const { user } = useAuth();
  const [staff, setStaff] = useState<ResolvedStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<ResolvedStaff | null>(null);

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
        displayName: nameMap.get(r.user_id)?.split(' ')[0] || r.user_id.slice(0, 8) + '…',
        presenceStatus: (PRESENCE_STATUS_MAP[r.status as PresenceStatus] ? r.status : 'in_room') as PresenceStatus,
        isOffline: isStaffOffline(r),
      }));

      resolved.sort((a, b) => {
        if (a.isOffline !== b.isOffline) return a.isOffline ? 1 : -1;
        const availA = a.available_for_support ? 0 : 1;
        const availB = b.available_for_support ? 0 : 1;
        if (availA !== availB) return availA - availB;
        return PRESENCE_STATUS_ORDER.indexOf(a.presenceStatus) - PRESENCE_STATUS_ORDER.indexOf(b.presenceStatus);
      });

      setStaff(resolved);
    } catch { /* silent */ }
  }, [agencyId]);

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

  const handleStaffTap = (s: ResolvedStaff) => {
    if (s.user_id === user?.id) return;
    setSelectedStaff(s);
  };

  const actionSheet = selectedStaff && (
    <Sheet open={!!selectedStaff} onOpenChange={(o) => { if (!o) setSelectedStaff(null); }}>
      <SheetContent side="bottom" className="max-h-[50vh] rounded-t-2xl px-4 pb-8">
        <SheetHeader className="pb-3">
          <SheetTitle className="font-heading text-sm flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', getAvailabilityDot(selectedStaff))} />
            {selectedStaff.displayName}
            <span className="text-muted-foreground font-normal text-xs">
              {PRESENCE_STATUS_MAP[selectedStaff.presenceStatus]?.label}
              {selectedStaff.location_label ? ` — ${selectedStaff.location_label}` : ''}
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2">
          {onMessageStaff && (
            <button onClick={() => { onMessageStaff(selectedStaff.user_id); setSelectedStaff(null); }}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 hover:bg-muted/50 active:scale-95 transition-all text-left">
              <MessageSquare className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-medium">Message</span>
            </button>
          )}
          {onRequestHelp && (
            <button onClick={() => { onRequestHelp([selectedStaff.user_id]); setSelectedStaff(null); }}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 hover:bg-muted/50 active:scale-95 transition-all text-left">
              <HandHelping className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-xs font-medium">Request Help</span>
            </button>
          )}
          {onViewRoom && selectedStaff.classroom_group_id && (
            <button onClick={() => { onViewRoom(selectedStaff.classroom_group_id!); setSelectedStaff(null); }}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 hover:bg-muted/50 active:scale-95 transition-all text-left">
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium">View Room</span>
            </button>
          )}
          {onAddToThread && (
            <button onClick={() => { onAddToThread(selectedStaff.user_id); setSelectedStaff(null); }}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 hover:bg-muted/50 active:scale-95 transition-all text-left">
              <UserPlus className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-medium">Add to Thread</span>
            </button>
          )}
          <button onClick={() => {
            cloudSupabase.from('staff_presence').update({ status: 'covering', location_label: classroomId || null })
              .eq('user_id', selectedStaff.user_id).then(() => { load(); setSelectedStaff(null); });
          }}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 hover:bg-muted/50 active:scale-95 transition-all text-left">
            <HeartHandshake className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-xs font-medium">Mark Helping</span>
          </button>
          <button onClick={() => {
            cloudSupabase.from('staff_presence').update({ classroom_group_id: classroomId || null, status: 'in_room' })
              .eq('user_id', selectedStaff.user_id).then(() => { load(); setSelectedStaff(null); });
          }}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 hover:bg-muted/50 active:scale-95 transition-all text-left">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium">Move to Room</span>
          </button>
        </div>
        {selectedStaff.note && (
          <p className="text-[10px] text-muted-foreground italic mt-3 px-1">"{selectedStaff.note}"</p>
        )}
      </SheetContent>
    </Sheet>
  );

  // ── Strip variant (for thread headers) ──
  if (variant === 'strip') {
    return (
      <>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1.5 flex-wrap py-1.5">
            {availableStaff.slice(0, 4).map(s => {
              const cfg = PRESENCE_STATUS_MAP[s.presenceStatus];
              const pairedStudent = s.assigned_student_id ? (s.location_label || 'a student') : null;
              return (
                <Tooltip key={s.user_id}>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleStaffTap(s)}
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary px-2 py-0.5 text-[9px] font-semibold hover:bg-accent/20 active:scale-95 transition-all cursor-pointer">
                      <span className={cn('h-1.5 w-1.5 rounded-full', getAvailabilityDot(s))} />
                      {s.displayName}
                      <span className="text-muted-foreground font-normal">{cfg.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p className="font-medium">{s.displayName} — {cfg.label}</p>
                    {s.location_label && <p className="text-muted-foreground">📍 {s.location_label}</p>}
                    {pairedStudent && <p className="text-muted-foreground">👤 With {pairedStudent}</p>}
                    {s.note && <p className="italic text-muted-foreground">"{s.note}"</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {availableStaff.length > 4 && (
              <Badge variant="outline" className="text-[9px] h-5 px-1.5">+{availableStaff.length - 4}</Badge>
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
        </TooltipProvider>
        {actionSheet}
      </>
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
    <>
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
                    onClick={() => handleStaffTap(s)}
                    className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50 active:scale-[0.98]">
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
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Offline</p>
            </div>
            <div className="space-y-0.5">
              {offlineItems.map(s => (
                <div key={s.user_id} className="flex items-center gap-2 px-2 py-1.5 opacity-50">
                  <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground truncate">
                    {s.user_id === user?.id ? 'You' : s.displayName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {actionSheet}
    </>
  );
}
