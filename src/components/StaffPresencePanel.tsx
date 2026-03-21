/**
 * StaffPresencePanel — shows all staff in current classroom/agency.
 * Reads from Nova Core: staff_presence, v_classroom_staff_presence, v_available_support_staff.
 * Writes via Nova Core RPC: set_staff_presence(...).
 * No local schema — Nova Core is the source of truth.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StaffActionSheet } from '@/components/StaffActionSheet';
import {
  UserCheck, UserX, TreePine, UserCog, Briefcase, Coffee, ShieldCheck,
  Users2, Radio, HelpCircle, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PresenceStatus = 'in_room' | 'out' | 'on_break' | 'in_office' | 'floating' | 'covering' | 'with_student' | 'unavailable';

interface PresenceStatusConfig {
  label: string;
  icon: typeof UserCheck;
  dot: string;
}

export const PRESENCE_STATUS_MAP: Record<PresenceStatus, PresenceStatusConfig> = {
  in_room:      { label: 'In Room',       icon: UserCheck,    dot: 'bg-green-500' },
  out:          { label: 'Out',           icon: UserX,        dot: 'bg-muted-foreground' },
  on_break:     { label: 'On Break',      icon: Coffee,       dot: 'bg-amber-500' },
  in_office:    { label: 'In Office',     icon: Briefcase,    dot: 'bg-blue-500' },
  floating:     { label: 'Floating',      icon: Radio,        dot: 'bg-purple-500' },
  covering:     { label: 'Covering',      icon: ShieldCheck,  dot: 'bg-yellow-500' },
  with_student: { label: 'With Student',  icon: UserCog,      dot: 'bg-primary' },
  unavailable:  { label: 'Unavailable',   icon: HelpCircle,   dot: 'bg-destructive' },
};

export const PRESENCE_STATUS_ORDER: PresenceStatus[] = [
  'in_room', 'floating', 'covering', 'with_student', 'on_break', 'in_office', 'out', 'unavailable',
];

interface StaffPresenceRow {
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
  /** Optional list of student names for display */
  studentMap?: Record<string, string>;
}

export function StaffPresencePanel({ groupId, agencyId, studentMap }: StaffPresencePanelProps) {
  const { user } = useAuth();
  const [presenceRows, setPresenceRows] = useState<StaffPresenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSheetUserId, setActionSheetUserId] = useState<string | null>(null);

  const loadPresence = useCallback(async () => {
    try {
      // Use the view for classroom-scoped presence
      const { data } = await supabase
        .from('v_classroom_staff_presence' as any)
        .select('*')
        .eq('classroom_group_id', groupId);
      
      const rows = (data || []) as any as StaffPresenceRow[];
      
      // Also load agency-wide staff who are available for support but not in this room
      const { data: available } = await supabase
        .from('v_available_support_staff' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .neq('classroom_group_id', groupId);
      
      const availableRows = (available || []) as any as StaffPresenceRow[];
      
      // Merge, deduplicate by user_id
      const seen = new Set(rows.map(r => r.user_id));
      const merged = [...rows];
      for (const r of availableRows) {
        if (!seen.has(r.user_id)) {
          seen.add(r.user_id);
          merged.push(r);
        }
      }
      
      setPresenceRows(merged);
    } catch (e) {
      console.warn('[StaffPresence] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [groupId, agencyId]);

  useEffect(() => {
    loadPresence();
    // Poll every 30s for live updates
    const interval = setInterval(loadPresence, 30000);
    return () => clearInterval(interval);
  }, [loadPresence]);

  // Subscribe to realtime changes on staff_presence
  useEffect(() => {
    const channel = supabase
      .channel('staff_presence_live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'staff_presence',
        filter: `agency_id=eq.${agencyId}`,
      }, () => {
        loadPresence();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agencyId, loadPresence]);

  const inRoom = presenceRows.filter(r => r.classroom_group_id === groupId && r.status === 'in_room');
  const withStudent = presenceRows.filter(r => r.status === 'with_student');
  const floatingCovering = presenceRows.filter(r => r.status === 'floating' || r.status === 'covering');
  const available = presenceRows.filter(r => r.available_for_support && r.classroom_group_id !== groupId);
  const away = presenceRows.filter(r => ['out', 'on_break', 'in_office', 'unavailable'].includes(r.status));

  const myPresence = presenceRows.find(r => r.user_id === user?.id);

  return (
    <Card className="border-border/40">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Who's Here</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{inRoom.length} in room</Badge>
          </div>
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

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : presenceRows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No staff presence data yet.</p>
        ) : (
          <div className="space-y-2">
            {/* In Room */}
            {inRoom.length > 0 && (
              <PresenceGroup label="In Room" rows={inRoom} studentMap={studentMap} onSelect={setActionSheetUserId} currentUserId={user?.id} />
            )}
            {/* With Student */}
            {withStudent.length > 0 && (
              <PresenceGroup label="With Student" rows={withStudent} studentMap={studentMap} onSelect={setActionSheetUserId} currentUserId={user?.id} />
            )}
            {/* Floating / Covering */}
            {floatingCovering.length > 0 && (
              <PresenceGroup label="Floating / Covering" rows={floatingCovering} studentMap={studentMap} onSelect={setActionSheetUserId} currentUserId={user?.id} />
            )}
            {/* Available for Support (other rooms) */}
            {available.length > 0 && (
              <PresenceGroup label="Available Nearby" rows={available} studentMap={studentMap} onSelect={setActionSheetUserId} currentUserId={user?.id} />
            )}
            {/* Away */}
            {away.length > 0 && (
              <PresenceGroup label="Away" rows={away} studentMap={studentMap} onSelect={setActionSheetUserId} currentUserId={user?.id} />
            )}
          </div>
        )}
      </CardContent>

      {/* Staff Action Sheet */}
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

/* ── Presence group section ── */
function PresenceGroup({ label, rows, studentMap, onSelect, currentUserId }: {
  label: string;
  rows: StaffPresenceRow[];
  studentMap?: Record<string, string>;
  onSelect: (userId: string) => void;
  currentUserId?: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-1">
        {rows.map(row => {
          const config = PRESENCE_STATUS_MAP[row.status] || PRESENCE_STATUS_MAP.in_room;
          const Icon = config.icon;
          const isMe = row.user_id === currentUserId;
          return (
            <button
              key={row.id || row.user_id}
              onClick={() => onSelect(row.user_id)}
              className={cn(
                "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50",
                isMe && "bg-primary/5 border border-primary/20"
              )}
            >
              <div className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {isMe ? 'You' : row.user_id.slice(0, 8)}
                  {row.available_for_support && (
                    <span className="ml-1 text-[9px] text-green-600 dark:text-green-400">● available</span>
                  )}
                </p>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  {row.location_label && <span>{row.location_label}</span>}
                  {row.assigned_student_id && (
                    <span>→ {studentMap?.[row.assigned_student_id] || 'Student'}</span>
                  )}
                  {row.note && <span className="italic truncate max-w-[100px]">"{row.note}"</span>}
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
