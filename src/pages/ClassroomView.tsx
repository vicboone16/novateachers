/**
 * "Today in My Classroom" — default teacher landing page.
 * Grid of student cards with inline data collection.
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName, displayInitials } from '@/lib/student-utils';
import { writeUnifiedEvent } from '@/lib/unified-events';
import { writeWithRetry } from '@/lib/sync-queue';
import { logEvent, trackBehaviorForEscalation, createSignal, trackBehaviorForReinforcementGap } from '@/lib/supervisorSignals';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Hand, DoorOpen, Bomb, Megaphone, ShieldX,
  Check, X, Play, ExternalLink, Clock, Bell,
  BarChart3, AlertTriangle, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client } from '@/lib/types';

const BEHAVIORS = [
  { name: 'Aggression', icon: Hand, abbr: 'AGG' },
  { name: 'Elopement', icon: DoorOpen, abbr: 'ELP' },
  { name: 'Property Destruction', icon: Bomb, abbr: 'PD' },
  { name: 'Major Disruption', icon: Megaphone, abbr: 'DIS' },
  { name: 'Noncompliance', icon: ShieldX, abbr: 'NC' },
];

interface TodayCounts {
  [clientId: string]: number;
}

interface LastEvent {
  [clientId: string]: string; // ISO timestamp
}

const ClassroomView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCounts, setTodayCounts] = useState<TodayCounts>({});
  const [lastEvents, setLastEvents] = useState<LastEvent>({});
  const [totalToday, setTotalToday] = useState(0);
  // Per-card flash animation
  const [flashCard, setFlashCard] = useState<string | null>(null);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      setClients(normalizeClients(data));
    } catch { /* silent */ }
    setLoading(false);
  };

  // Load today's counts
  useEffect(() => {
    if (!user || clients.length === 0) return;
    loadTodayCounts();
  }, [clients, user]);

  const loadTodayCounts = async () => {
    if (!user) return;
    try {
      const clientIds = clients.map(c => c.id);
      const { data: freq } = await supabase
        .from('teacher_frequency_entries')
        .select('client_id, count')
        .eq('user_id', user.id)
        .eq('logged_date', today)
        .in('client_id', clientIds);

      const counts: TodayCounts = {};
      let total = 0;
      for (const row of (freq || []) as any[]) {
        counts[row.client_id] = (counts[row.client_id] || 0) + (row.count || 1);
        total += row.count || 1;
      }
      setTodayCounts(counts);
      setTotalToday(total);

      // Last events from teacher_data_events
      const startOfDay = today + 'T00:00:00Z';
      const { data: events } = await supabase
        .from('teacher_data_events')
        .select('student_id, recorded_at')
        .eq('staff_id', user.id)
        .gte('recorded_at', startOfDay)
        .in('student_id', clientIds)
        .order('recorded_at', { ascending: false });

      const last: LastEvent = {};
      for (const e of (events || []) as any[]) {
        if (!last[e.student_id]) last[e.student_id] = e.recorded_at;
      }
      setLastEvents(last);
    } catch { /* silent */ }
  };

  const logBehavior = async (clientId: string, behaviorName: string) => {
    if (!user) return;
    if ('vibrate' in navigator) navigator.vibrate(15);

    // Flash animation
    setFlashCard(clientId);
    setTimeout(() => setFlashCard(null), 300);

    // Optimistic update
    setTodayCounts(prev => ({ ...prev, [clientId]: (prev[clientId] || 0) + 1 }));
    setTotalToday(prev => prev + 1);
    const now = new Date().toISOString();
    setLastEvents(prev => ({ ...prev, [clientId]: now }));

    try {
      const result = await writeWithRetry('teacher_frequency_entries', {
        agency_id: effectiveAgencyId,
        client_id: clientId,
        user_id: user.id,
        behavior_name: behaviorName,
        count: 1,
        logged_date: today,
      });

      // Unified event stream (teacher_data_events)
      writeUnifiedEvent({
        studentId: clientId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        eventType: 'behavior_event',
        eventSubtype: 'frequency',
        eventValue: { behavior: behaviorName, count: 1 },
        sourceModule: 'classroom_view',
      });

      // Core event stream RPC (real-time feed for supervisors)
      try {
        await logEvent({
          clientId,
          agencyId: effectiveAgencyId,
          eventType: 'behavior',
          eventName: behaviorName,
          value: 1,
          metadata: { source: 'classroom_view' },
        });
      } catch (e) { console.warn('[ClassroomView] logEvent failed (non-blocking):', e); }

      // Escalation detection
      const esc = trackBehaviorForEscalation(behaviorName);
      if (esc?.escalated) {
        try {
          await createSignal({
            clientId,
            agencyId: effectiveAgencyId,
            signalType: 'escalation',
            severity: 'action',
            title: 'Escalation detected',
            message: `${esc.count} ${esc.behavior} events within 10 minutes`,
            drivers: { behavior: esc.behavior, count: esc.count, window_minutes: 10 },
            source: { app: 'beacon', trigger: 'escalation_rule' },
          });
          toast({ title: '🚨 Escalation alert sent' });
        } catch (e) { console.warn('[ClassroomView] escalation signal failed:', e); }
      }

      // Reinforcement gap tracking
      trackBehaviorForReinforcementGap(clientId);

      if (!result.ok) {
        toast({ title: `${behaviorName} queued (offline)`, variant: 'default' });
      }
    } catch {
      toast({ title: 'Error logging behavior', variant: 'destructive' });
    }
  };

  const logEngagement = async (clientId: string, engaged: boolean) => {
    if (!user) return;
    if ('vibrate' in navigator) navigator.vibrate(10);

    setFlashCard(clientId);
    setTimeout(() => setFlashCard(null), 300);

    toast({ title: `${engaged ? '✓ Engaged' : '✗ Not engaged'}` });

    // Unified event stream (teacher_data_events — immediate Core write)
    writeUnifiedEvent({
      studentId: clientId,
      staffId: user.id,
      agencyId: effectiveAgencyId,
      eventType: 'engagement_sample',
      eventSubtype: engaged ? 'engaged' : 'not_engaged',
      eventValue: { engaged, response_time: new Date().toISOString() },
      sourceModule: 'classroom_view',
    });

    // Core event stream RPC for supervisor live feed
    try {
      await logEvent({
        clientId,
        agencyId: effectiveAgencyId,
        eventType: 'context',
        eventName: 'engagement_check',
        value: engaged ? 1 : 0,
        metadata: { engaged, source: 'classroom_view' },
      });
    } catch (e) { console.warn('[ClassroomView] logEvent engagement failed:', e); }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Today in My Classroom
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Daily stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Students" value={clients.length} icon={Users} />
        <StatCard label="Events Today" value={totalToday} icon={BarChart3} />
        <StatCard
          label="Last Activity"
          value={Object.keys(lastEvents).length > 0
            ? formatTime(Object.values(lastEvents).sort().reverse()[0])
            : '—'}
          icon={Clock}
          isText
        />
        <StatCard label="Active Students" value={Object.keys(todayCounts).length} icon={AlertTriangle} />
      </div>

      {/* Student grid */}
      {clients.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No students in this workspace yet.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/students')}>
              Manage Students
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(client => (
            <StudentCard
              key={client.id}
              client={client}
              count={todayCounts[client.id] || 0}
              lastEvent={lastEvents[client.id]}
              flash={flashCard === client.id}
              onBehavior={(name) => logBehavior(client.id, name)}
              onEngagement={(engaged) => logEngagement(client.id, engaged)}
              onProbe={() => navigate(`/collect?student=${client.id}`)}
              onTracker={() => navigate('/tracker')}
              onDetail={() => navigate(`/students/${client.id}`)}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Stat card ── */
function StatCard({ label, value, icon: Icon, isText }: {
  label: string; value: string | number; icon: any; isText?: boolean;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className={cn("font-semibold leading-none", isText ? "text-sm" : "text-lg")}>{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Student card with inline data entry ── */
function StudentCard({ client, count, lastEvent, flash, onBehavior, onEngagement, onProbe, onTracker, onDetail, formatTime }: {
  client: Client;
  count: number;
  lastEvent?: string;
  flash: boolean;
  onBehavior: (name: string) => void;
  onEngagement: (engaged: boolean) => void;
  onProbe: () => void;
  onTracker: () => void;
  onDetail: () => void;
  formatTime: (iso: string) => string;
}) {
  return (
    <Card className={cn(
      "border-border/50 transition-all duration-200",
      flash && "ring-2 ring-primary/40 scale-[1.01]",
    )}>
      <CardContent className="p-3 space-y-2.5">
        {/* Student header */}
        <div className="flex items-center justify-between">
          <button onClick={onDetail} className="flex items-center gap-2 group text-left min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {displayInitials(client)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {displayName(client)}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {client.grade && <span>Gr {client.grade}</span>}
                {lastEvent && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTime(lastEvent)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
          {count > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
              {count} today
            </Badge>
          )}
        </div>

        {/* Quick behavior buttons */}
        <div className="flex flex-wrap gap-1">
          {BEHAVIORS.map(({ name, abbr, icon: Icon }) => (
            <button
              key={name}
              onClick={() => onBehavior(name)}
              title={name}
              className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive active:scale-95"
            >
              <Icon className="h-3 w-3" />
              {abbr}
            </button>
          ))}
        </div>

        {/* Engagement + Probe + ABC row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEngagement(true)}
            title="Engaged — Yes"
            className="flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent-foreground transition-colors hover:bg-accent/20 active:scale-95"
          >
            <Check className="h-3 w-3 text-accent" /> Yes
          </button>
          <button
            onClick={() => onEngagement(false)}
            title="Engaged — No"
            className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/10 active:scale-95"
          >
            <X className="h-3 w-3" /> No
          </button>
          <div className="flex-1" />
          <button
            onClick={onProbe}
            title="Start Probe"
            className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
          >
            <Play className="h-3 w-3" /> Probe
          </button>
          <button
            onClick={onTracker}
            title="ABC / Trigger Tracker"
            className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 active:scale-95"
          >
            <ExternalLink className="h-3 w-3" /> ABC
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ClassroomView;
