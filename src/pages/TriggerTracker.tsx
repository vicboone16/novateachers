import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Plus, Clock, TrendingUp } from 'lucide-react';
import type { Client, ABCLog } from '@/lib/types';

const TriggerTracker = () => {
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [logs, setLogs] = useState<ABCLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Fast-log fields
  const [antecedent, setAntecedent] = useState('');
  const [behavior, setBehavior] = useState('');
  const [consequence, setConsequence] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (selectedClientId) loadLogs();
  }, [selectedClientId]);

  const loadClients = async () => {
    if (!currentWorkspace) return;

    try {
      if (isSoloMode) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('agency_id', currentWorkspace.agency_id)
          .order('last_name');
        setClients(normalizeClients(data));
      } else {
        // Two-step fetch to avoid relation-embed issues
        const { data: accessRows } = await supabase
          .from('user_client_access')
          .select('client_id, can_collect_data')
          .eq('user_id', user?.id)
          .eq('can_collect_data', true);

        const clientIds = (accessRows || []).map((r: any) => r.client_id).filter(Boolean);

        if (clientIds.length === 0) {
          setClients([]);
          return;
        }

        let result = await supabase.from('students').select('*').in('id', clientIds).order('last_name');
        if (result.error) {
          result = await supabase.from('clients').select('*').in('id', clientIds).order('last_name');
        }
        setClients(normalizeClients(result.data));
      }
    } catch (err: any) {
      console.error('Failed to load clients for tracker:', err);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('abc_logs')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('logged_at', { ascending: false })
      .limit(100);

    setLogs(data || []);
    setLoading(false);
  };

  const handleLog = async () => {
    if (!selectedClientId || !antecedent.trim() || !behavior.trim() || !consequence.trim()) {
      toast({ title: 'Please fill in A, B, and C fields', variant: 'destructive' });
      return;
    }
    setSaving(true);

    try {
      const { error } = await supabase.from('abc_logs').insert({
        client_id: selectedClientId,
        user_id: user?.id,
        antecedent: antecedent.trim(),
        behavior: behavior.trim(),
        consequence: consequence.trim(),
        notes: notes.trim() || null,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ title: 'ABC log recorded' });
      setAntecedent('');
      setBehavior('');
      setConsequence('');
      setNotes('');
      loadLogs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const freqByDay = logs.reduce<Record<string, number>>((acc, log) => {
    const day = new Date(log.logged_at).toLocaleDateString();
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(freqByDay)
    .map(([date, count]) => ({ date, count }))
    .reverse()
    .slice(-14);

  const behaviorFreq = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.behavior] = (acc[log.behavior] || 0) + 1;
    return acc;
  }, {});

  const behaviorChartData = Object.entries(behaviorFreq)
    .map(([behavior, count]) => ({ behavior, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Trigger Tracker
        </h2>
        <p className="text-sm text-muted-foreground">Fast ABC logging and behavior analysis</p>
      </div>

      <div className="max-w-sm">
        <Label className="mb-2 block text-xs text-muted-foreground">Select Student</Label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a student…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {displayName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClientId && (
        <Tabs defaultValue="log" className="space-y-4">
          <TabsList>
            <TabsTrigger value="log" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Fast Log
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Charts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="log">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Quick ABC Entry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-primary">
                      A — Antecedent
                    </Label>
                    <Textarea
                      placeholder="What happened before?"
                      value={antecedent}
                      onChange={(e) => setAntecedent(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-destructive">
                      B — Behavior
                    </Label>
                    <Textarea
                      placeholder="What did the student do?"
                      value={behavior}
                      onChange={(e) => setBehavior(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">
                      C — Consequence
                    </Label>
                    <Textarea
                      placeholder="What happened after?"
                      value={consequence}
                      onChange={(e) => setConsequence(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                  <Input
                    placeholder="Additional context…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button onClick={handleLog} disabled={saving} className="w-full sm:w-auto">
                  {saving ? 'Saving…' : 'Record ABC Log'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : logs.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No ABC logs yet for this student.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <Card key={log.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.logged_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <Badge variant="outline" className="mb-1 text-xs">A</Badge>
                          <p className="text-sm">{log.antecedent}</p>
                        </div>
                        <div>
                          <Badge variant="destructive" className="mb-1 text-xs">B</Badge>
                          <p className="text-sm">{log.behavior}</p>
                        </div>
                        <div>
                          <Badge variant="secondary" className="mb-1 text-xs">C</Badge>
                          <p className="text-sm">{log.consequence}</p>
                        </div>
                      </div>
                      {log.notes && (
                        <p className="mt-2 text-xs text-muted-foreground">{log.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="charts">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm">Daily Frequency (Last 14 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" className="stroke-primary" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm">Top Behaviors</CardTitle>
                </CardHeader>
                <CardContent>
                  {behaviorChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={behaviorChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis dataKey="behavior" type="category" tick={{ fontSize: 10 }} width={100} className="fill-muted-foreground" />
                        <Tooltip />
                        <Bar dataKey="count" className="fill-primary" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default TriggerTracker;
