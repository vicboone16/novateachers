/**
 * Supervisor Dashboard — live feed of supervisor_signals for the agency.
 *
 * RLS note: The supervisor_signals SELECT policy currently only allows
 * users to read signals they created (created_by = auth.uid()). To allow
 * supervisors to read all agency signals, run the commented-out policy in
 * sql/nova-core-supervisor-signals.sql on the Nova Core instance.
 * Until then, this dashboard shows signals created by the current user plus
 * any signals they can see via the acknowledgment policy.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, Eye, CheckCircle2,
  Clock, Users, RefreshCw, Filter, Loader2, Siren,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { resolveDisplayNames } from '@/lib/resolve-names';

interface Signal {
  id: string;
  client_id: string;
  agency_id: string;
  signal_type: string;
  severity: 'watch' | 'action' | 'critical';
  title: string;
  message: string;
  drivers: Record<string, any>;
  source: Record<string, any>;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  created_by: string | null;
}

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: Siren,
    badgeClass: 'bg-red-100 text-red-700 border-red-400',
    borderClass: 'border-l-4 border-red-500',
    dotClass: 'bg-red-500',
  },
  action: {
    label: 'Action',
    icon: AlertTriangle,
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-400',
    borderClass: 'border-l-4 border-amber-500',
    dotClass: 'bg-amber-500',
  },
  watch: {
    label: 'Watch',
    icon: Eye,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-400',
    borderClass: 'border-l-4 border-blue-400',
    dotClass: 'bg-blue-400',
  },
};

const TYPE_LABELS: Record<string, string> = {
  incident: 'Incident',
  escalation: 'Escalation',
  pattern: 'Pattern',
  safety_concern: 'Safety',
  other: 'Other',
};

const SupervisorDashboard = () => {
  const { user, session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { appRole } = useAppAccess();
  const { toast } = useToast();

  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);

  // Acknowledge dialog
  const [resolveSignal, setResolveSignal] = useState<Signal | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // Student name resolution
  const [studentNames, setStudentNames] = useState<Map<string, string>>(new Map());

  const loadSignals = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('supervisor_signals')
        .select('*')
        .eq('agency_id', currentWorkspace.agency_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!showResolved) {
        query = query.eq('acknowledged', false);
      }

      const { data, error } = await query;

      if (error) {
        // If the query fails due to RLS, fall back to own signals
        if (error.code === 'PGRST116' || error.message?.includes('permission')) {
          const { data: ownData } = await (supabase as any)
            .from('supervisor_signals')
            .select('*')
            .eq('created_by', user?.id)
            .order('created_at', { ascending: false })
            .limit(200);
          setSignals((ownData || []) as Signal[]);
        } else {
          console.error('[SupervisorDashboard] load signals:', error);
        }
      } else {
        setSignals((data || []) as Signal[]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, showResolved, user?.id]);

  useEffect(() => { loadSignals(); }, [loadSignals]);

  // Resolve student names
  useEffect(() => {
    const clientIds = [...new Set(signals.map(s => s.client_id))];
    if (!clientIds.length) return;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('clients')
          .select('id, first_name, last_name')
          .in('id', clientIds);
        if (data) {
          const map = new Map<string, string>();
          for (const c of data) {
            map.set(c.id, `${c.first_name} ${c.last_name}`.trim());
          }
          setStudentNames(map);
        }
      } catch { /* silent */ }
    })();
  }, [signals]);

  // Realtime signal updates
  useEffect(() => {
    if (!currentWorkspace) return;
    const channel = (supabase as any)
      .channel('supervisor-signals-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'supervisor_signals',
      }, (payload: any) => {
        setSignals(prev => [payload.new as Signal, ...prev]);
        toast({
          title: `New ${payload.new.severity} signal`,
          description: payload.new.title,
          variant: payload.new.severity === 'critical' ? 'destructive' : 'default',
        });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [currentWorkspace, toast]);

  const handleAcknowledge = async () => {
    if (!resolveSignal || !user) return;
    setResolving(true);
    try {
      const { error } = await (supabase as any)
        .from('supervisor_signals')
        .update({
          acknowledged: true,
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
          drivers: {
            ...resolveSignal.drivers,
            resolution_note: resolveNote.trim() || null,
          },
        })
        .eq('id', resolveSignal.id);

      if (error) throw error;
      setSignals(prev => prev.map(s =>
        s.id === resolveSignal.id
          ? { ...s, acknowledged: true, acknowledged_by: user.id, acknowledged_at: new Date().toISOString() }
          : s,
      ));
      toast({ title: 'Signal resolved' });
      setResolveSignal(null);
      setResolveNote('');
    } catch (err: any) {
      toast({ title: 'Failed to resolve', description: err.message, variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  const filtered = signals.filter(s => {
    if (severityFilter !== 'all' && s.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && s.signal_type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: signals.filter(s => !s.acknowledged).length,
    critical: signals.filter(s => s.severity === 'critical' && !s.acknowledged).length,
    action: signals.filter(s => s.severity === 'action' && !s.acknowledged).length,
    watch: signals.filter(s => s.severity === 'watch' && !s.acknowledged).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Supervisor Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">Live signal feed — incidents, patterns, and escalations</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSignals} disabled={loading} className="gap-1.5 self-start">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Open Signals</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <Siren className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.action}</p>
              <p className="text-xs text-muted-foreground">Action</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Eye className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.watch}</p>
              <p className="text-xs text-muted-foreground">Watch</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="action">Action</SelectItem>
            <SelectItem value="watch">Watch</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="incident">Incident</SelectItem>
            <SelectItem value="escalation">Escalation</SelectItem>
            <SelectItem value="pattern">Pattern</SelectItem>
            <SelectItem value="safety_concern">Safety</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showResolved ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => setShowResolved(v => !v)}
        >
          <CheckCircle2 className="h-3 w-3" />
          {showResolved ? 'Hiding resolved' : 'Show resolved'}
        </Button>
      </div>

      {/* Signal list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No open signals</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total === 0
                ? 'All clear — no active signals for your agency'
                : 'No signals match the current filters'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(signal => {
            const cfg = SEVERITY_CONFIG[signal.severity] || SEVERITY_CONFIG.watch;
            const SeverityIcon = cfg.icon;
            const studentName = studentNames.get(signal.client_id) || signal.client_id.slice(0, 8);
            const isResolved = signal.acknowledged;

            return (
              <Card
                key={signal.id}
                className={cn(
                  'transition-opacity',
                  cfg.borderClass,
                  isResolved && 'opacity-50',
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0', cfg.dotClass)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <Badge variant="outline" className={cn('text-[10px] border', cfg.badgeClass)}>
                            <SeverityIcon className="h-2.5 w-2.5 mr-0.5" />
                            {cfg.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {TYPE_LABELS[signal.signal_type] || signal.signal_type}
                          </Badge>
                          <span className="text-xs font-medium text-foreground">{studentName}</span>
                          {isResolved && (
                            <Badge variant="outline" className="text-[10px] border-green-400 text-green-700">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Resolved
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold leading-snug">{signal.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{signal.message}</p>
                        {signal.drivers?.resolution_note && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {signal.drivers.resolution_note}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
                      </span>
                      {!isResolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => { setResolveSignal(signal); setResolveNote(''); }}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resolve dialog */}
      <Dialog open={!!resolveSignal} onOpenChange={open => { if (!open) { setResolveSignal(null); setResolveNote(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Resolve Signal</DialogTitle>
          </DialogHeader>
          {resolveSignal && (
            <div className="space-y-3">
              <div className="rounded-md border border-border/60 bg-muted/40 p-3">
                <p className="text-sm font-medium">{resolveSignal.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{resolveSignal.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Student: {studentNames.get(resolveSignal.client_id) || resolveSignal.client_id.slice(0, 8)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Resolution note (optional)</Label>
                <Textarea
                  value={resolveNote}
                  onChange={e => setResolveNote(e.target.value)}
                  placeholder="Describe the action taken or why this is resolved…"
                  className="resize-none h-24 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveSignal(null)}>Cancel</Button>
            <Button onClick={handleAcknowledge} disabled={resolving} className="gap-1.5">
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorDashboard;
