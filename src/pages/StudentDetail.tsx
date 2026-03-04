import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Activity, FileText, TrendingUp, Hash, AlertTriangle, MessageSquare, Trash2 } from 'lucide-react';
import { normalizeClient, displayName } from '@/lib/student-utils';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { DataCollectionSession } from '@/components/DataCollectionSession';
import { TargetManager } from '@/components/TargetManager';
import { IEPTab } from '@/components/IEPTab';
import { BCBASummary } from '@/components/BCBASummary';
import { TeacherSummaries } from '@/components/TeacherSummaries';
import StudentInfoEditor from '@/components/StudentInfoEditor';
import { useToast } from '@/hooks/use-toast';
import type { Client, ABCLog, TeacherTarget, TeacherDataSession } from '@/lib/types';

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSoloMode, permissions, currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Data tab state
  const [logs, setLogs] = useState<ABCLog[]>([]);
  const [targets, setTargets] = useState<TeacherTarget[]>([]);
  const [sessions, setSessions] = useState<TeacherDataSession[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (id) loadClient();
  }, [id]);

  useEffect(() => {
    if (id && activeTab === 'data') loadDataTab();
  }, [id, activeTab]);

  const loadClient = async () => {
    setLoading(true);
    let result = await supabase.from('clients').select('*').eq('id', id).single();
    if (result.error) {
      result = await supabase.from('students').select('*').eq('id', id).single();
    }
    if (!result.error && result.data) setClient(normalizeClient(result.data));
    setLoading(false);
  };

  const loadDataTab = async () => {
    if (!id || !currentWorkspace) return;
    setLoadingData(true);

    const [logsRes, targetsRes, sessionsRes] = await Promise.all([
      supabase.from('abc_logs').select('*').eq('client_id', id).order('logged_at', { ascending: false }).limit(200),
      supabase.from('teacher_targets').select('*').eq('client_id', id).eq('agency_id', currentWorkspace.agency_id).order('name'),
      supabase.from('teacher_data_sessions').select('*').eq('client_id', id).eq('agency_id', currentWorkspace.agency_id).order('started_at', { ascending: false }).limit(50),
    ]);

    setLogs(logsRes.data || []);
    setTargets(targetsRes.data || []);
    setSessions(sessionsRes.data || []);
    setLoadingData(false);
  };

  // ── Stats ──
  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter(l => new Date(l.logged_at).toDateString() === today).length;
  }, [logs]);

  const weekCount = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return logs.filter(l => new Date(l.logged_at) >= weekAgo).length;
  }, [logs]);

  const topAntecedents = useMemo(() => {
    const f: Record<string, number> = {};
    logs.forEach(l => { f[l.antecedent] = (f[l.antecedent] || 0) + 1; });
    return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);

  const topConsequences = useMemo(() => {
    const f: Record<string, number> = {};
    logs.forEach(l => { f[l.consequence] = (f[l.consequence] || 0) + 1; });
    return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);

  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {};
    logs.forEach(l => {
      const day = new Date(l.logged_at).toLocaleDateString();
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return Object.entries(byDay).map(([date, count]) => ({ date, count })).reverse().slice(-14);
  }, [logs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Student not found</p>
        <Button variant="link" onClick={() => navigate('/students')}>Back to students</Button>
      </div>
    );
  }

  const diagnoses: string[] = Array.isArray(client.diagnoses) ? client.diagnoses : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/students')} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight font-heading truncate">{displayName(client)}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {client.grade && (
              <Badge variant="outline" className="text-xs font-normal bg-primary/5 border-primary/20 text-primary">
                Grade {client.grade}
              </Badge>
            )}
            {client.primary_setting && (
              <Badge variant="outline" className="text-xs font-normal bg-accent/5 border-accent/20 text-accent">
                {client.primary_setting}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">
            <User className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          {(isSoloMode || permissions.can_collect_data) && (
            <TabsTrigger value="data" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">
              <Activity className="h-3.5 w-3.5" /> Data
            </TabsTrigger>
          )}
          <TabsTrigger value="iep" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">
            <FileText className="h-3.5 w-3.5" /> IEP
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="animate-in fade-in-50 duration-300">
          <StudentInfoEditor client={client} onRefresh={loadClient} />
        </TabsContent>

        {/* ── DATA ── */}
        <TabsContent value="data" className="animate-in fade-in-50 duration-300">
          {loadingData ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quick stats — color-coded */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Today"
                  value={todayCount}
                  icon={<Hash className="h-4 w-4" />}
                  color="primary"
                />
                <StatCard
                  label="This Week"
                  value={weekCount}
                  icon={<TrendingUp className="h-4 w-4" />}
                  color="accent"
                />
                <StatCard
                  label="Top Antecedent"
                  value={topAntecedents[0]?.[0] || '—'}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  color="warning"
                  small
                />
                <StatCard
                  label="Top Consequence"
                  value={topConsequences[0]?.[0] || '—'}
                  icon={<MessageSquare className="h-4 w-4" />}
                  color="destructive"
                  small
                />
              </div>

              {/* Charts */}
              {chartData.length > 0 && (
                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading">Frequency — Last 14 Days</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                          }}
                          formatter={(value: number) => [value, 'ABC Events']}
                          labelFormatter={(label: string) => `Date: ${label}`}
                        />
                        <Line type="monotone" dataKey="count" className="stroke-primary" strokeWidth={2.5} dot={{ r: 3, className: 'fill-primary' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Targets */}
              <TargetManager
                clientId={client.id}
                targets={targets}
                onRefresh={loadDataTab}
                readOnly={!isSoloMode && !permissions.can_collect_data}
              />

              {/* Data Collection Session */}
              {(isSoloMode || permissions.can_collect_data) && (
                <DataCollectionSession
                  clientId={client.id}
                  targets={targets}
                  onSessionEnd={loadDataTab}
                  onNavigateToTracker={() => navigate('/tracker')}
                />
              )}

              {/* BCBA Summary */}
              {(isSoloMode || permissions.can_collect_data) && (
                <BCBASummary
                  clientId={client.id}
                  clientName={displayName(client)}
                  logs={logs}
                  sessions={sessions}
                />
              )}

              {/* Shared summaries with Mark as Reviewed */}
              <TeacherSummaries clientId={client.id} />

              {/* Recent Sessions */}
              {sessions.length > 0 && (
                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading">Recent Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sessions.slice(0, 10).map(s => {
                        const targetName = targets.find(t => t.id === s.target_id)?.name;
                        return (
                          <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/40 p-2.5 bg-muted/20 hover:bg-muted/40 transition-colors group">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-[10px] font-medium bg-primary/5 border-primary/20 text-primary shrink-0">{s.mode}</Badge>
                              {targetName && <Badge variant="secondary" className="text-[10px] shrink-0">{targetName}</Badge>}
                              <span className="text-xs text-muted-foreground truncate">
                                {new Date(s.started_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {s.summary_json && (
                                <span className="text-xs font-semibold text-foreground">
                                  {s.summary_json.count != null && `Count: ${s.summary_json.count}`}
                                  {s.summary_json.percentage != null && `${s.summary_json.percentage}%`}
                                  {s.summary_json.rating != null && `Rating: ${s.summary_json.rating}/5`}
                                  {s.summary_json.total_seconds != null && `${Math.round(s.summary_json.total_seconds)}s`}
                                  {s.summary_json.trials != null && `${s.summary_json.correct}/${s.summary_json.trials} correct`}
                                </span>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                onClick={async () => {
                                  const { error } = await supabase.from('teacher_data_sessions').delete().eq('id', s.id);
                                  if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
                                  else { toast({ title: 'Session deleted' }); loadDataTab(); }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ABC Log History */}
              {logs.length > 0 && (
                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading">Recent ABC Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {logs.slice(0, 10).map(log => (
                        <div key={log.id} className="rounded-lg border border-border/40 p-3 bg-muted/10 hover:bg-muted/30 transition-colors group">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{new Date(log.logged_at).toLocaleString()}</span>
                              {log.intensity && (
                                <Badge variant="secondary" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                                  Intensity: {log.intensity}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                              onClick={async () => {
                                const { error } = await supabase.from('abc_logs').delete().eq('id', log.id);
                                if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
                                else { toast({ title: 'Log deleted' }); loadDataTab(); }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-3 text-xs">
                            <div className="flex items-start gap-1.5">
                              <Badge className="text-[9px] shrink-0 bg-warning/15 text-warning border-warning/25 hover:bg-warning/15">A</Badge>
                              <span className="text-foreground/80">{log.antecedent}</span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Badge className="text-[9px] shrink-0 bg-destructive/15 text-destructive border-destructive/25 hover:bg-destructive/15">B</Badge>
                              <span className="text-foreground/80">{log.behavior}</span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Badge className="text-[9px] shrink-0 bg-primary/15 text-primary border-primary/25 hover:bg-primary/15">C</Badge>
                              <span className="text-foreground/80">{log.consequence}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── IEP ── */}
        <TabsContent value="iep" className="animate-in fade-in-50 duration-300">
          <IEPTab client={client} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="space-y-0.5">
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium text-foreground">{value || '—'}</p>
  </div>
);

type StatColor = 'primary' | 'accent' | 'warning' | 'destructive';

const StatCard = ({
  label,
  value,
  icon,
  color,
  small,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: StatColor;
  small?: boolean;
}) => {
  const colorMap: Record<StatColor, string> = {
    primary: 'bg-primary/8 border-primary/20 text-primary',
    accent: 'bg-accent/8 border-accent/20 text-accent',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    destructive: 'bg-destructive/8 border-destructive/20 text-destructive',
  };

  const iconBgMap: Record<StatColor, string> = {
    primary: 'bg-primary/15',
    accent: 'bg-accent/15',
    warning: 'bg-warning/15',
    destructive: 'bg-destructive/15',
  };

  return (
    <Card className={`border shadow-sm ${colorMap[color]}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`rounded-md p-1 ${iconBgMap[color]}`}>
            {icon}
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">{label}</p>
        </div>
        <p className={`font-bold ${small ? 'text-sm truncate' : 'text-2xl'} text-foreground`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
};

export default StudentDetail;
