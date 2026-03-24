/**
 * StaffPresencePanel — "Who's Here" panel for classroom page.
 * Reads from Nova Core: staff_presence, v_classroom_staff_presence, v_available_support_staff.
 * Writes via Nova Core RPC: set_staff_presence(...).
 * Shows My Status card, In This Room, Available Support, With Student sections.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StaffActionSheet } from '@/components/StaffActionSheet';
import { resolveDisplayNames } from '@/lib/resolve-names';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  UserCheck, UserX, Coffee, Briefcase, ShieldCheck,
  Users2, Radio, HelpCircle, MapPin, UserCog,
  ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PresenceStatus = 'in_room' | 'out' | 'on_break' | 'in_office' | 'floating' | 'covering' | 'with_student' | 'unavailable';

interface PresenceStatusConfig {
  label: string;
  icon: typeof UserCheck;
  dot: string;
}

export const PRESENCE_STATUS_MAP: Record<PresenceStatus, PresenceStatusConfig> = {
  in_room:      { label: 'In Room',       icon: UserCheck,    dot: 'bg-green-600' },
  out:          { label: 'Out',           icon: UserX,        dot: 'bg-slate-500' },
  on_break:     { label: 'On Break',      icon: Coffee,       dot: 'bg-amber-600' },
  in_office:    { label: 'In Office',     icon: Briefcase,    dot: 'bg-blue-600' },
  floating:     { label: 'Floating',      icon: Radio,        dot: 'bg-purple-600' },
  covering:     { label: 'Covering',      icon: ShieldCheck,  dot: 'bg-yellow-600' },
  with_student: { label: 'With Student',  icon: UserCog,      dot: 'bg-indigo-600' },
  unavailable:  { label: 'Unavailable',   icon: HelpCircle,   dot: 'bg-red-600' },
};

export const PRESENCE_STATUS_ORDER: PresenceStatus[] = [
  'in_room', 'floating', 'covering', 'with_student', 'on_break', 'in_office', 'out', 'unavailable',
];

export interface StaffPresenceRow {
  id: string;
  user_id: string;
  status: PresenceStatus;
  location_type: string;
  location_label: string | null;
  availability_status: string;
  available_for_support: boolean;
  assigned_student_id: string | null;
  classroom_group_id: string | null;
  note: string | null;
  updated_at: string;
}

interface StaffPresencePanelProps {
  groupId: string;
  agencyId: string;
  studentMap?: Record<string, string>;
  compact?: boolean;
}

export function StaffPresencePanel({ groupId, agencyId, studentMap, compact }: StaffPresencePanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [presenceRows, setPresenceRows] = useState<StaffPresenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSheetUserId, setActionSheetUserId] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(!compact);

  // Load staff roles from classroom_group_teachers (Lovable Cloud)
  const loadRoles = useCallback(async () => {
    try {
      const { data } = await cloudSupabase
        .from('classroom_group_teachers')
        .select('user_id, staff_role')
        .eq('group_id', groupId);
      const roles: Record<string, string> = {};
      for (const row of data || []) {
        roles[row.user_id] = row.staff_role || 'Staff';
      }
      setRoleMap(roles);
    } catch { /* silent */ }
  }, [groupId]);

  const loadPresence = useCallback(async () => {
    try {
      // Read from Lovable Cloud staff_presence table
      const { data } = await cloudSupabase
        .from('staff_presence')
        .select('*')
        .eq('agency_id', agencyId);
      const allRows = (data || []) as any as StaffPresenceRow[];

      // Filter: in this classroom + others
      setPresenceRows(allRows);

      const allIds = allRows.map(r => r.user_id);
      if (allIds.length > 0) {
        try {
          const names = await resolveDisplayNames(allIds);
          setNameMap(names);
        } catch { /* fallback to truncated IDs */ }
      }
    } catch (e) {
      console.warn('[StaffPresence] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    loadPresence();
    loadRoles();
    const interval = setInterval(loadPresence, 30000);
    return () => clearInterval(interval);
  }, [loadPresence, loadRoles]);

  // Realtime subscription
  useEffect(() => {
    const channel = cloudSupabase
      .channel('staff_presence_live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'staff_presence',
      }, () => {
        loadPresence();
      })
      .subscribe();

    return () => { cloudSupabase.removeChannel(channel); };
  }, [agencyId, loadPresence]);

  const myPresence = presenceRows.find(r => r.user_id === user?.id);
  const inRoom = presenceRows.filter(r => r.classroom_group_id === groupId && r.status === 'in_room');
  const withStudent = presenceRows.filter(r => r.status === 'with_student');
  const availableSupport = presenceRows.filter(r => r.available_for_support && r.classroom_group_id !== groupId && r.status !== 'with_student');
  const away = presenceRows.filter(r => ['out', 'on_break', 'in_office', 'unavailable', 'floating', 'covering'].includes(r.status) && r.classroom_group_id !== groupId && !r.available_for_support);

  const getDisplayName = (userId: string) => {
    if (userId === user?.id) return 'You';
    return nameMap.get(userId) || userId.slice(0, 8) + '…';
  };
  const getRole = (userId: string) => roleMap[userId] || null;

  // Mini presence chips for compact header display
  const miniCounts = {
    inRoom: inRoom.length,
    available: availableSupport.length,
    withStudent: withStudent.length,
  };

  return (
    <Card className="border-border/40">
      <CardContent className="p-3 space-y-3">
        {/* Panel header with mini-presence chips */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Users2 className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Who's Here</span>
                <div className="flex items-center gap-1.5 ml-1">
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    {miniCounts.inRoom}
                  </Badge>
                  {miniCounts.available > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                      <Zap className="h-2 w-2 text-purple-500" />
                      {miniCounts.available}
                    </Badge>
                  )}
                  {miniCounts.withStudent > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                      <UserCog className="h-2 w-2 text-primary" />
                      {miniCounts.withStudent}
                    </Badge>
                  )}
                </div>
                {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-1" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />}
              </button>
            </CollapsibleTrigger>
            {user && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setActionSheetUserId(user.id)}
              >
                <MapPin className="h-3 w-3 mr-1" />
                {myPresence ? PRESENCE_STATUS_MAP[myPresence.status]?.label || myPresence.status : 'Set Status'}
              </Button>
            )}
          </div>

          <CollapsibleContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : presenceRows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2 mt-2">No staff presence data yet. Tap "Set Status" to start.</p>
            ) : (
              <div className="space-y-3 mt-3">
                {/* My Status card */}
                {user && (
                  <MyStatusCard
                    presence={myPresence || null}
                    studentMap={studentMap}
                    onEdit={() => setActionSheetUserId(user.id)}
                  />
                )}

                {inRoom.length > 0 && (
                  <PresenceGroup label="In This Room" rows={inRoom} studentMap={studentMap} onSelect={setActionSheetUserId} getDisplayName={getDisplayName} getRole={getRole} />
                )}
                {withStudent.length > 0 && (
                  <PresenceGroup label="With Student" rows={withStudent} studentMap={studentMap} onSelect={setActionSheetUserId} getDisplayName={getDisplayName} getRole={getRole} />
                )}
                {availableSupport.length > 0 && (
                  <PresenceGroup label="Available Support" rows={availableSupport} studentMap={studentMap} onSelect={setActionSheetUserId} getDisplayName={getDisplayName} getRole={getRole} />
                )}
                {away.length > 0 && (
                  <PresenceGroup label="Away" rows={away} studentMap={studentMap} onSelect={setActionSheetUserId} getDisplayName={getDisplayName} getRole={getRole} />
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {actionSheetUserId && (
        <StaffActionSheet
          open={!!actionSheetUserId}
          onOpenChange={(open) => { if (!open) setActionSheetUserId(null); }}
          userId={actionSheetUserId}
          agencyId={agencyId}
          currentGroupId={groupId}
          currentPresence={presenceRows.find(r => r.user_id === actionSheetUserId) || null}
          onUpdated={loadPresence}
          studentMap={studentMap}
        />
      )}
    </Card>
  );
}

/* ── My Status Card ── */
function MyStatusCard({ presence, studentMap, onEdit }: {
  presence: StaffPresenceRow | null;
  studentMap?: Record<string, string>;
  onEdit: () => void;
}) {
  if (!presence) {
    return (
      <button
        onClick={onEdit}
        className="w-full rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-3 py-3 text-center transition-colors hover:bg-primary/10"
      >
        <MapPin className="h-4 w-4 mx-auto text-primary mb-1" />
        <p className="text-xs font-medium text-primary">Set your status</p>
        <p className="text-[10px] text-muted-foreground">Let your team know where you are</p>
      </button>
    );
  }

  const config = PRESENCE_STATUS_MAP[presence.status] || PRESENCE_STATUS_MAP.in_room;
  const Icon = config.icon;

  return (
    <button
      onClick={onEdit}
      className="w-full rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", config.dot)} />
          <span className="text-xs font-bold text-primary">My Status</span>
        </div>
        <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1 capitalize">
          <Icon className="h-2.5 w-2.5" />
          {config.label}
        </Badge>
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
        {presence.location_label && <span>📍 {presence.location_label}</span>}
        {presence.available_for_support && <span className="text-green-600 dark:text-green-400">● Available</span>}
        {!presence.available_for_support && <span className="text-muted-foreground">○ Busy</span>}
        {presence.assigned_student_id && (
          <span>→ {studentMap?.[presence.assigned_student_id] || 'Student'}</span>
        )}
        {presence.note && <span className="italic truncate max-w-[120px]">"{presence.note}"</span>}
      </div>
    </button>
  );
}

/* ── Presence group section ── */
function PresenceGroup({ label, rows, studentMap, onSelect, getDisplayName, getRole }: {
  label: string;
  rows: StaffPresenceRow[];
  studentMap?: Record<string, string>;
  onSelect: (userId: string) => void;
  getDisplayName: (userId: string) => string;
  getRole: (userId: string) => string | null;
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-1">
        {rows.map(row => {
          const config = PRESENCE_STATUS_MAP[row.status] || PRESENCE_STATUS_MAP.in_room;
          const Icon = config.icon;
          const name = getDisplayName(row.user_id);
          const role = getRole(row.user_id);
          return (
            <button
              key={row.id || row.user_id}
              onClick={() => onSelect(row.user_id)}
              className={cn(
                "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50",
                name === 'You' && "bg-primary/5 border border-primary/20"
              )}
            >
              <div className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate">{name}</p>
                  {role && (
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0 capitalize">{role}</Badge>
                  )}
                  {row.available_for_support && (
                    <span className="text-[8px] text-green-600 dark:text-green-400 shrink-0">● available</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  {row.location_label && <span>{row.location_label}</span>}
                  {row.assigned_student_id && (
                    <span>→ {studentMap?.[row.assigned_student_id] || 'Student'}</span>
                  )}
                  {row.note && <span className="italic truncate max-w-[120px]">"{row.note}"</span>}
                </div>
              </div>
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
