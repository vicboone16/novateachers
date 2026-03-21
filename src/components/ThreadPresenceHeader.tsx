/**
 * ThreadPresenceHeader — shows who's in room, available, with student
 * at the top of a classroom thread. Uses realtime staff_presence.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserCheck, Radio, UserCog, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PresenceEntry {
  user_id: string;
  status: string;
  available_for_support: boolean;
  assigned_student_id: string | null;
  location_label: string | null;
  classroom_group_id: string | null;
}

interface ThreadPresenceHeaderProps {
  agencyId: string;
  classroomId?: string | null;
  onPingAvailable?: () => void;
}

export function ThreadPresenceHeader({ agencyId, classroomId, onPingAvailable }: ThreadPresenceHeaderProps) {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (!agencyId) return;
    try {
      const { data } = await supabase
        .from('v_classroom_staff_presence' as any)
        .select('user_id, status, available_for_support, assigned_student_id, location_label, classroom_group_id')
        .eq('agency_id', agencyId);
      const rows = (data || []) as any as PresenceEntry[];
      setPresence(rows);

      const ids = rows.map(r => r.user_id);
      if (ids.length > 0) {
        try {
          const names = await resolveDisplayNames(ids);
          setNameMap(names);
        } catch { /* silent */ }
      }
    } catch { /* silent */ }
  }, [agencyId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('thread_presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_presence', filter: `agency_id=eq.${agencyId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agencyId, load]);

  const inRoom = classroomId
    ? presence.filter(p => p.classroom_group_id === classroomId && p.status === 'in_room')
    : presence.filter(p => p.status === 'in_room');
  const available = presence.filter(p => p.available_for_support && p.status !== 'with_student');
  const withStudent = presence.filter(p => p.status === 'with_student');

  if (presence.length === 0) return null;

  const getName = (uid: string) => {
    const n = nameMap.get(uid);
    if (n) return n.split(' ')[0]; // first name only for compact display
    return uid.slice(0, 6);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-1.5">
      {inRoom.slice(0, 3).map(p => (
        <Badge key={p.user_id} variant="secondary" className="text-[9px] h-5 px-1.5 gap-1">
          <UserCheck className="h-2.5 w-2.5 text-green-500" />
          {getName(p.user_id)}
        </Badge>
      ))}
      {inRoom.length > 3 && (
        <Badge variant="outline" className="text-[9px] h-5 px-1.5">+{inRoom.length - 3}</Badge>
      )}
      {available.length > 0 && (
        <Badge variant="outline" className="text-[9px] h-5 px-1.5 gap-1">
          <Radio className="h-2.5 w-2.5 text-purple-500" />
          {available.length} available
        </Badge>
      )}
      {withStudent.length > 0 && (
        <Badge variant="outline" className="text-[9px] h-5 px-1.5 gap-1">
          <UserCog className="h-2.5 w-2.5 text-primary" />
          {withStudent.length} w/ student
        </Badge>
      )}
      {onPingAvailable && available.length > 0 && (
        <Button variant="ghost" size="sm" className="h-5 text-[9px] px-2 gap-1 text-primary" onClick={onPingAvailable}>
          <Zap className="h-2.5 w-2.5" /> Ping
        </Button>
      )}
    </div>
  );
}
