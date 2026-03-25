/**
 * StaffCoordinationPanel — Real-time view of staff across classrooms
 * with ability to reassign staff between rooms.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw, MapPin, ArrowRight, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StaffEntry {
  id: string;
  user_id: string;
  status: string;
  availability_status: string;
  location_label: string | null;
  classroom_group_id: string | null;
  note: string | null;
  updated_at: string;
}

interface ClassroomGroup {
  group_id: string;
  name: string;
}

const AVAILABILITY_COLORS: Record<string, string> = {
  available: 'bg-emerald-500',
  nearby: 'bg-amber-500',
  assigned: 'bg-blue-500',
  busy: 'bg-red-500',
  offline: 'bg-muted-foreground/50',
};

export function StaffCoordinationPanel() {
  const { currentWorkspace } = useWorkspace();
  const agencyId = currentWorkspace?.agency_id;
  const { toast } = useToast();

  const [staffList, setStaffList] = useState<StaffEntry[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomGroup[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [moveStaff, setMoveStaff] = useState<StaffEntry | null>(null);
  const [targetClassroom, setTargetClassroom] = useState<string>('');

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);

    const [presRes, classRes] = await Promise.all([
      cloudSupabase.from('staff_presence').select('*').eq('agency_id', agencyId),
      cloudSupabase.from('classroom_groups').select('group_id, name').eq('agency_id', agencyId),
    ]);

    const staff = (presRes.data || []) as StaffEntry[];
    const cls = (classRes.data || []) as ClassroomGroup[];
    setStaffList(staff);
    setClassrooms(cls);

    const ids = staff.map(s => s.user_id);
    if (ids.length > 0) {
      const names = await resolveDisplayNames(ids);
      setNameMap(names);
    }
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!agencyId) return;
    const channel = cloudSupabase
      .channel('staff-coord')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_presence' }, () => {
        load();
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [agencyId, load]);

  // Group staff by classroom
  const grouped = new Map<string, StaffEntry[]>();
  grouped.set('unassigned', []);
  classrooms.forEach(c => grouped.set(c.group_id, []));

  staffList.forEach(s => {
    if (s.status === 'out') return;
    const key = s.classroom_group_id && grouped.has(s.classroom_group_id) ? s.classroom_group_id : 'unassigned';
    grouped.get(key)!.push(s);
  });

  const handleMove = async () => {
    if (!moveStaff || !targetClassroom || !agencyId) return;
    const targetName = classrooms.find(c => c.group_id === targetClassroom)?.name || '';

    try {
      // Try RPC first
      const { error: rpcErr } = await (cloudSupabase.rpc as any)('move_staff_to_classroom', {
        p_agency_id: agencyId,
        p_user_id: moveStaff.user_id,
        p_to_classroom_id: targetClassroom,
        p_to_room_name: targetName,
        p_moved_by: null,
        p_move_reason: 'admin_reassignment',
      });

      if (rpcErr) {
        // Fallback: direct update
        await cloudSupabase
          .from('staff_presence')
          .update({
            classroom_group_id: targetClassroom,
            location_label: targetName,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', moveStaff.id);
      }

      toast({ title: 'Staff moved', description: `${nameMap[moveStaff.user_id] || 'Staff'} → ${targetName}` });
      setMoveStaff(null);
      setTargetClassroom('');
      load();
    } catch {
      toast({ title: 'Move failed', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Users className="h-4 w-4 text-primary" />
          Staff by Location
        </h3>
        <Button size="icon" variant="ghost" onClick={load} className="ml-auto">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {Array.from(grouped.entries()).map(([key, members]) => {
          const label = key === 'unassigned' ? 'Unassigned / Floating' : classrooms.find(c => c.group_id === key)?.name || key;
          return (
            <Card key={key} className="border-border/40">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {label}
                  <Badge variant="secondary" className="ml-auto text-[10px]">{members.length}</Badge>
                </CardTitle>
              </CardHeader>
              {members.length > 0 && (
                <CardContent className="p-3 pt-0 space-y-1.5">
                  {members.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <div className={`h-2 w-2 rounded-full ${AVAILABILITY_COLORS[s.availability_status] || AVAILABILITY_COLORS.offline}`} />
                      <span className="flex-1 truncate">{nameMap[s.user_id] || s.user_id.slice(0, 8)}</span>
                      <Badge variant="outline" className="text-[10px] px-1">{s.availability_status}</Badge>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => { setMoveStaff(s); setTargetClassroom(''); }}>
                        <ArrowRight className="h-3 w-3" /> Move
                      </Button>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Move dialog */}
      <Dialog open={!!moveStaff} onOpenChange={() => setMoveStaff(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Move {moveStaff ? nameMap[moveStaff.user_id] || 'Staff' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Select value={targetClassroom} onValueChange={setTargetClassroom}>
              <SelectTrigger>
                <SelectValue placeholder="Select classroom…" />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map(c => (
                  <SelectItem key={c.group_id} value={c.group_id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" disabled={!targetClassroom} onClick={handleMove}>
              Confirm Move
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
