import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { fetchAccessibleClients } from '@/lib/client-access';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Plus, Clock, TrendingUp, ListChecks, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import type { Client, ABCLog, BehaviorCategory } from '@/lib/types';

// Default quick-select tags
const DEFAULT_ANTECEDENT_TAGS = ['Transition', 'Demand', 'Denied access', 'Peer conflict', 'Noise', 'Unstructured time'];
const DEFAULT_BEHAVIOR_TAGS = ['Elopement', 'Verbal outburst', 'Physical aggression', 'Non-compliance', 'Self-injury', 'Off-task'];
const DEFAULT_CONSEQUENCE_TAGS = ['Redirected', 'Break given', 'Verbal prompt', 'Removed from situation', 'Ignored', 'Peer mediation'];

const TriggerTracker = () => {
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [logs, setLogs] = useState<ABCLog[]>([]);
  const [categories, setCategories] = useState<BehaviorCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick log
  const [antecedent, setAntecedent] = useState('');
  const [behavior, setBehavior] = useState('');
  const [consequence, setConsequence] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [saving, setSaving] = useState(false);

  // Detailed log toggle
  const [showDetailed, setShowDetailed] = useState(false);
  const [notes, setNotes] = useState('');
  const [setting, setSetting] = useState('');
  const [duration, setDuration] = useState('');
  const [staffInitials, setStaffInitials] = useState('');
  const [location, setLocation] = useState('');

  // Category config
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryTriggers, setNewCategoryTriggers] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Custom tags (solo mode)
  const [customAntecedents, setCustomAntecedents] = useState<string[]>([]);
  const [customBehaviors, setCustomBehaviors] = useState<string[]>([]);
  const [customConsequences, setCustomConsequences] = useState<string[]>([]);

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (!selectedClientId) return;
    loadLogs();
    loadCategories();
  }, [selectedClientId]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await fetchAccessibleClients({
        currentWorkspace,
        isSoloMode,
        userId: user?.id,
        permission: 'can_collect_data',
      });
      setClients(normalizeClients(data));
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
      .limit(200);
    setLogs(data || []);
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('behavior_categories')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('name');
    setCategories(data || []);

    // Build custom tags from categories' triggers
    if (data) {
      const triggers = data.flatMap((c: BehaviorCategory) => c.triggers || []);
      setCustomAntecedents(triggers);
    }
  };

  const antecedentTags = [...DEFAULT_ANTECEDENT_TAGS, ...customAntecedents.filter((t) => !DEFAULT_ANTECEDENT_TAGS.includes(t))];
  const behaviorTags = [...DEFAULT_BEHAVIOR_TAGS, ...categories.map((c) => c.name).filter((n) => !DEFAULT_BEHAVIOR_TAGS.includes(n))];
  const consequenceTags = DEFAULT_CONSEQUENCE_TAGS;

  const handleLog = async () => {
    if (!selectedClientId || !antecedent || !behavior || !consequence) {
      toast({ title: 'Tap an A, B, and C tag to log', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const notesParts = [notes.trim()];
      if (staffInitials) notesParts.push(`Staff: ${staffInitials}`);
      if (location) notesParts.push(`Location: ${location}`);
      if (setting) notesParts.push(`Setting: ${setting}`);

      const { error } = await supabase.from('abc_logs').insert({
        client_id: selectedClientId,
        user_id: user?.id,
        antecedent,
        behavior,
        consequence,
        intensity,
        duration_seconds: duration ? parseInt(duration) * 60 : null,
        notes: notesParts.filter(Boolean).join(' • ') || null,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ title: '✓ Logged', description: `${behavior} recorded` });
      setAntecedent('');
      setBehavior('');
      setConsequence('');
      setIntensity(3);
      setNotes('');
      setSetting('');
      setDuration('');
      setStaffInitials('');
      setLocation('');
      loadLogs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!selectedClientId || !newCategoryName.trim()) return;
    setSavingCategory(true);

    const parsedTriggers = Array.from(
      new Set(newCategoryTriggers.split(',').map((t) => t.trim()).filter(Boolean))
    );

    const { error } = await supabase.from('behavior_categories').insert({
      client_id: selectedClientId,
      name: newCategoryName.trim(),
      description: newCategoryDescription.trim() || null,
      triggers: parsedTriggers,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Category saved' });
      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryTriggers('');
      await loadCategories();
    }
    setSavingCategory(false);
  };

  // Stats
  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter((l) => new Date(l.logged_at).toDateString() === today).length;
  }, [logs]);

  const weekCount = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return logs.filter((l) => new Date(l.logged_at) >= weekAgo).length;
  }, [logs]);

  const topAntecedents = useMemo(() => {
    const freq: Record<string, number> = {};
    logs.forEach((l) => { freq[l.antecedent] = (freq[l.antecedent] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);

  const topConsequences = useMemo(() => {
    const freq: Record<string, number> = {};
    logs.forEach((l) => { freq[l.consequence] = (freq[l.consequence] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);

  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {};
    logs.forEach((l) => {
      const day = new Date(l.logged_at).toLocaleDateString();
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return Object.entries(byDay).map(([date, count]) => ({ date, count })).reverse().slice(-14);
  }, [logs]);

  const behaviorChartData = useMemo(() => {
    const freq: Record<string, number> = {};
    logs.forEach((l) => { freq[l.behavior] = (freq[l.behavior] || 0) + 1; });
    return Object.entries(freq).map(([behavior, count]) => ({ behavior, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [logs]);

  const TagSelector = ({
    label,
    tags,
    selected,
    onSelect,
    color,
  }: {
    label: string;
    tags: string[];
    selected: string;
    onSelect: (v: string) => void;
    color: string;
  }) => (
    <div className="space-y-2">
      <Label className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Button
            key={tag}
            type="button"
            variant={selected === tag ? 'default' : 'outline'}
            size="sm"
            className="h-9 text-xs px-3 rounded-full"
            onClick={() => onSelect(selected === tag ? '' : tag)}
          >
            {tag}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-heading">Trigger Tracker</h2>
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
              <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClientId && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{todayCount}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{weekCount}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium text-foreground truncate">{topAntecedents[0]?.[0] || '—'}</p>
                <p className="text-xs text-muted-foreground">Top Antecedent</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium text-foreground truncate">{topConsequences[0]?.[0] || '—'}</p>
                <p className="text-xs text-muted-foreground">Top Consequence</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="log" className="space-y-4">
            <TabsList>
              <TabsTrigger value="log" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Quick Log
              </TabsTrigger>
              {isSoloMode && (
                <TabsTrigger value="categories" className="gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" />
                  Behavior Setup
                </TabsTrigger>
              )}
              <TabsTrigger value="history" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
              <TabsTrigger value="charts" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Charts
              </TabsTrigger>
            </TabsList>

            {/* QUICK LOG TAB */}
            <TabsContent value="log">
              <Card className="border-border/50">
                <CardContent className="space-y-5 p-5">
                  <TagSelector
                    label="A — Antecedent (what happened before)"
                    tags={antecedentTags}
                    selected={antecedent}
                    onSelect={setAntecedent}
                    color="text-primary"
                  />
                  <TagSelector
                    label="B — Behavior (what the student did)"
                    tags={behaviorTags}
                    selected={behavior}
                    onSelect={setBehavior}
                    color="text-destructive"
                  />
                  <TagSelector
                    label="C — Consequence (what happened after)"
                    tags={consequenceTags}
                    selected={consequence}
                    onSelect={setConsequence}
                    color="text-accent-foreground"
                  />

                  {/* Intensity */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Intensity: <span className="font-semibold text-foreground">{intensity}</span>/5
                    </Label>
                    <Slider
                      value={[intensity]}
                      onValueChange={([v]) => setIntensity(v)}
                      min={1}
                      max={5}
                      step={1}
                      className="max-w-xs"
                    />
                  </div>

                  {/* Detailed toggle */}
                  <div className="flex items-center gap-2">
                    <Switch checked={showDetailed} onCheckedChange={setShowDetailed} />
                    <Label className="text-xs text-muted-foreground cursor-pointer" onClick={() => setShowDetailed(!showDetailed)}>
                      Detailed log
                    </Label>
                    {showDetailed ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                  </div>

                  {showDetailed && (
                    <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border/60 bg-muted/20 p-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Setting</Label>
                        <Input value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="e.g. Math class" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Duration (minutes)</Label>
                        <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 5" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Staff Initials</Label>
                        <Input value={staffInitials} onChange={(e) => setStaffInitials(e.target.value)} placeholder="e.g. JD" maxLength={4} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Location</Label>
                        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Cafeteria" />
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label className="text-xs">Notes</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context…" className="min-h-[60px]" />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleLog}
                    disabled={saving || !antecedent || !behavior || !consequence}
                    size="lg"
                    className="w-full text-base h-14 rounded-xl font-semibold"
                  >
                    {saving ? 'Saving…' : '⚡ Save Log'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BEHAVIOR SETUP (solo only) */}
            {isSoloMode && (
              <TabsContent value="categories">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base">Add Behavior Category</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input placeholder="e.g. Off-task behavior" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description (optional)</Label>
                        <Textarea placeholder="Describe this behavior" value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} className="min-h-[80px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Triggers (comma-separated)</Label>
                        <Input placeholder="Noise, transition, denied access" value={newCategoryTriggers} onChange={(e) => setNewCategoryTriggers(e.target.value)} />
                      </div>
                      <Button onClick={handleAddCategory} disabled={savingCategory} className="w-full">
                        {savingCategory ? 'Saving…' : 'Save Category'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base">Current Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {categories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No categories configured yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {categories.map((cat) => (
                            <div key={cat.id} className="rounded-md border border-border/60 p-3">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{cat.name}</p>
                                <Badge variant="outline">{(cat.triggers || []).length} triggers</Badge>
                              </div>
                              {cat.description && (
                                <p className="mb-2 text-xs text-muted-foreground">{cat.description}</p>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                {(cat.triggers || []).length > 0 ? (
                                  cat.triggers?.map((t) => (
                                    <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">No triggers</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* HISTORY */}
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
                <div className="space-y-2">
                  {logs.map((log) => (
                    <Card key={log.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="mb-1.5 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.logged_at).toLocaleString()}
                          </span>
                          {log.behavior_category && <Badge variant="outline" className="text-[10px]">{log.behavior_category}</Badge>}
                          {log.intensity && (
                            <Badge variant="secondary" className="text-[10px]">
                              Intensity: {log.intensity}/5
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <Badge variant="outline" className="mb-0.5 text-[10px]">A</Badge>
                            <p className="text-sm">{log.antecedent}</p>
                          </div>
                          <div>
                            <Badge variant="destructive" className="mb-0.5 text-[10px]">B</Badge>
                            <p className="text-sm">{log.behavior}</p>
                          </div>
                          <div>
                            <Badge variant="secondary" className="mb-0.5 text-[10px]">C</Badge>
                            <p className="text-sm">{log.consequence}</p>
                          </div>
                        </div>
                        {log.notes && (
                          <p className="mt-1.5 text-xs text-muted-foreground">{log.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* CHARTS */}
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

                {/* Top Antecedents & Consequences */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-sm">Top Antecedents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topAntecedents.length > 0 ? (
                      <div className="space-y-2">
                        {topAntecedents.map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between">
                            <span className="text-sm truncate">{name}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">No data yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-sm">Top Consequences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topConsequences.length > 0 ? (
                      <div className="space-y-2">
                        {topConsequences.map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between">
                            <span className="text-sm truncate">{name}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">No data yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default TriggerTracker;
