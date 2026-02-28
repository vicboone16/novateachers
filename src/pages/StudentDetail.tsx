import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Activity, FileText, BarChart3 } from 'lucide-react';
import { normalizeClient, displayName } from '@/lib/student-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DataCollectionSession } from '@/components/DataCollectionSession';
import { TargetManager } from '@/components/TargetManager';
import { IEPTab } from '@/components/IEPTab';
import type { Client, ABCLog, TeacherTarget, TeacherDataSession } from '@/lib/types';

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSoloMode, permissions, currentWorkspace } = useWorkspace();
  const { user } = useAuth();
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/students')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading">{displayName(client)}</h2>
          <div className="flex items-center gap-2">
            {client.grade && <span className="text-sm text-muted-foreground">Grade {client.grade}</span>}
            {client.primary_setting && <Badge variant="outline" className="text-xs">{client.primary_setting}</Badge>}
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          {(isSoloMode || permissions.can_collect_data) && (
            <TabsTrigger value="data" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Data
            </TabsTrigger>
          )}
          <TabsTrigger value="iep" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> IEP
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview">
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-base">Student Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="First Name" value={client.first_name} />
                <InfoField label="Last Name" value={client.last_name} />
                <InfoField label="Grade" value={client.grade} />
                <InfoField label="School" value={client.school_name} />
                <InfoField label="District" value={client.district_name} />
                <InfoField label="Primary Setting" value={client.primary_setting} />
                {client.date_of_birth && (
                  <InfoField label="Date of Birth" value={new Date(client.date_of_birth).toLocaleDateString()} />
                )}
                {client.funding_mode && <InfoField label="Funding Mode" value={client.funding_mode} />}
              </div>
              {diagnoses.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-muted-foreground">Diagnoses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {diagnoses.map((d, i) => <Badge key={i} variant="secondary">{d}</Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DATA ── */}
        <TabsContent value="data">
          {loadingData ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Today" value={todayCount} />
                <StatCard label="This Week" value={weekCount} />
                <StatCard label="Top Antecedent" value={topAntecedents[0]?.[0] || '—'} small />
                <StatCard label="Top Consequence" value={topConsequences[0]?.[0] || '—'} small />
              </div>

              {/* Charts */}
              {chartData.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader><CardTitle className="text-sm">Frequency (Last 14 Days)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" className="stroke-primary" strokeWidth={2} dot={false} />
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

              {/* Recent Sessions */}
              {sessions.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader><CardTitle className="text-sm">Recent Sessions</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sessions.slice(0, 10).map(s => (
                        <div key={s.id} className="flex items-center justify-between rounded-md border border-border/60 p-2">
                          <div>
                            <Badge variant="outline" className="text-[10px] mr-2">{s.mode}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(s.started_at).toLocaleString()}
                            </span>
                          </div>
                          {s.summary_json && (
                            <span className="text-xs font-medium text-foreground">
                              {s.summary_json.count != null && `Count: ${s.summary_json.count}`}
                              {s.summary_json.percentage != null && `${s.summary_json.percentage}%`}
                              {s.summary_json.rating != null && `Rating: ${s.summary_json.rating}/5`}
                              {s.summary_json.total_seconds != null && `${Math.round(s.summary_json.total_seconds)}s`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ABC Log History */}
              {logs.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader><CardTitle className="text-sm">Recent ABC Logs</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {logs.slice(0, 10).map(log => (
                        <div key={log.id} className="rounded-md border border-border/60 p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">{new Date(log.logged_at).toLocaleString()}</span>
                            {log.intensity && <Badge variant="secondary" className="text-[10px]">I:{log.intensity}</Badge>}
                          </div>
                          <div className="grid gap-1 sm:grid-cols-3 text-xs">
                            <div><Badge variant="outline" className="text-[9px] mr-1">A</Badge>{log.antecedent}</div>
                            <div><Badge variant="destructive" className="text-[9px] mr-1">B</Badge>{log.behavior}</div>
                            <div><Badge variant="secondary" className="text-[9px] mr-1">C</Badge>{log.consequence}</div>
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
        <TabsContent value="iep">
          <IEPTab client={client} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoField = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium text-foreground">{value || '—'}</p>
  </div>
);

const StatCard = ({ label, value, small }: { label: string; value: string | number; small?: boolean }) => (
  <Card className="border-border/50">
    <CardContent className="p-3 text-center">
      <p className={`font-bold ${small ? 'text-sm truncate' : 'text-2xl'} text-foreground`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

export default StudentDetail;
