import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
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
import { Plus, Clock, TrendingUp, ListChecks, Zap, ChevronDown, ChevronUp, X, Trash2, Pencil, Check, AlertTriangle, Wand2 } from 'lucide-react';
import { logEvent, createSignal, trackBehaviorForEscalation } from '@/lib/supervisorSignals';
import { NotifySupervisorModal } from '@/components/NotifySupervisorModal';
import { BehaviorCaptureModal } from '@/components/BehaviorCaptureModal';
import type { Client, ABCLog, BehaviorCategory } from '@/lib/types';

interface StudentBehavior {
  id: string;
  name: string;
  type?: string;
  methods?: string[];
  category?: string;
  operationalDefinition?: string;
}

// Default quick-select tags
const DEFAULT_ANTECEDENT_TAGS = ['Transition', 'Demand', 'Denied access', 'Peer conflict', 'Noise', 'Unstructured time'];
const DEFAULT_BEHAVIOR_TAGS = ['Elopement', 'Verbal outburst', 'Physical aggression', 'Non-compliance', 'Self-injury', 'Off-task'];
const DEFAULT_CONSEQUENCE_TAGS = ['Redirected', 'Break given', 'Verbal prompt', 'Removed from situation', 'Ignored', 'Peer mediation'];

const TriggerTracker = () => {
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { user } = useAuth();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [logs, setLogs] = useState<ABCLog[]>([]);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);

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

  // Custom tags (session-only fallback)
  const [customAntecedents, setCustomAntecedents] = useState<string[]>([]);
  const [customBehaviors, setCustomBehaviors] = useState<string[]>([]);
  const [customConsequences, setCustomConsequences] = useState<string[]>([]);

  // Student-persisted behaviors
  const [studentBehaviors, setStudentBehaviors] = useState<StudentBehavior[]>([]);
  const [newBehaviorInput, setNewBehaviorInput] = useState('');
  const [editingBehaviorId, setEditingBehaviorId] = useState<string | null>(null);
  const [editingBehaviorName, setEditingBehaviorName] = useState('');

  // Persisted custom antecedent/consequence tags (stored on student record)
  const [persistedAntecedents, setPersistedAntecedents] = useState<string[]>([]);
  const [persistedConsequences, setPersistedConsequences] = useState<string[]>([]);
  const [newAntecedentInput, setNewAntecedentInput] = useState('');
  const [newConsequenceInput, setNewConsequenceInput] = useState('');

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (!selectedClientId) return;
    loadLogs();
    loadCategories();
    loadStudentBehaviors();
  }, [selectedClientId]);

  const loadStudentBehaviors = async () => {
    const { data } = await supabase
      .from('students')
      .select('behaviors, custom_antecedents, custom_consequences')
      .eq('id', selectedClientId)
      .single();
    if (data?.behaviors) {
      setStudentBehaviors(data.behaviors as StudentBehavior[]);
    } else {
      setStudentBehaviors([]);
    }
    setPersistedAntecedents((data as any)?.custom_antecedents || []);
    setPersistedConsequences((data as any)?.custom_consequences || []);
  };

  const saveStudentBehaviors = async (updated: StudentBehavior[]) => {
    const { error } = await supabase
      .from('students')
      .update({ behaviors: updated as any })
      .eq('id', selectedClientId);
    if (error) {
      toast({ title: 'Error saving behaviors', description: error.message, variant: 'destructive' });
    } else {
      setStudentBehaviors(updated);
    }
  };

  const addBehaviorToStudent = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !selectedClientId) return;
    if (studentBehaviors.some((b) => b.name === trimmed)) {
      setBehavior(trimmed);
      return;
    }
    const newBehavior: StudentBehavior = {
      id: crypto.randomUUID(),
      name: trimmed,
      type: 'frequency',
      methods: ['frequency'],
    };
    const updated = [...studentBehaviors, newBehavior];
    await saveStudentBehaviors(updated);
    setBehavior(trimmed);
    setNewBehaviorInput('');
    toast({ title: 'Behavior saved', description: `"${trimmed}" added to student profile` });
  };

  const deleteBehaviorFromStudent = async (behaviorId: string) => {
    const updated = studentBehaviors.filter((b) => b.id !== behaviorId);
    await saveStudentBehaviors(updated);
    toast({ title: 'Behavior removed' });
  };

  const renameBehavior = async (behaviorId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const updated = studentBehaviors.map((b) =>
      b.id === behaviorId ? { ...b, name: trimmed } : b
    );
    await saveStudentBehaviors(updated);
    setEditingBehaviorId(null);
    setEditingBehaviorName('');
    toast({ title: 'Behavior renamed' });
  };

  const addPersistedAntecedent = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || persistedAntecedents.includes(trimmed)) return;
    const updated = [...persistedAntecedents, trimmed];
    const { error } = await supabase
      .from('students')
      .update({ custom_antecedents: updated } as any)
      .eq('id', selectedClientId);
    if (!error) {
      setPersistedAntecedents(updated);
      setNewAntecedentInput('');
      toast({ title: 'Antecedent saved' });
    }
  };

  const removePersistedAntecedent = async (tag: string) => {
    const updated = persistedAntecedents.filter((t) => t !== tag);
    await supabase.from('students').update({ custom_antecedents: updated } as any).eq('id', selectedClientId);
    setPersistedAntecedents(updated);
  };

  const addPersistedConsequence = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || persistedConsequences.includes(trimmed)) return;
    const updated = [...persistedConsequences, trimmed];
    const { error } = await supabase
      .from('students')
      .update({ custom_consequences: updated } as any)
      .eq('id', selectedClientId);
    if (!error) {
      setPersistedConsequences(updated);
      setNewConsequenceInput('');
      toast({ title: 'Consequence saved' });
    }
  };

  const removePersistedConsequence = async (tag: string) => {
    const updated = persistedConsequences.filter((t) => t !== tag);
    await supabase.from('students').update({ custom_consequences: updated } as any).eq('id', selectedClientId);
    setPersistedConsequences(updated);
  };

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

  const antecedentTags = [
    ...DEFAULT_ANTECEDENT_TAGS,
    ...persistedAntecedents,
    ...customAntecedents,
  ].filter((tag, index, arr) => arr.indexOf(tag) === index);
  const behaviorTags = [
    ...DEFAULT_BEHAVIOR_TAGS,
    ...studentBehaviors.map((b) => b.name),
    ...categories.map((c) => c.name),
    ...customBehaviors,
  ].filter((tag, index, arr) => arr.indexOf(tag) === index);
  const consequenceTags = [
    ...DEFAULT_CONSEQUENCE_TAGS,
    ...persistedConsequences,
  ].filter((tag, index, arr) => arr.indexOf(tag) === index);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

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

      // ── Event stream wiring ──
      try {
        await logEvent({
          clientId: selectedClientId,
          agencyId: effectiveAgencyId,
          eventType: 'behavior',
          eventName: behavior,
          intensity,
          metadata: { antecedent, consequence, notes: notesParts.filter(Boolean).join(' • ') },
        });
      } catch (e) { console.warn('[Beacon] logEvent failed (non-blocking):', e); }

      // ── Incident severity >= 3 → signal ──
      if (intensity >= 3) {
        try {
          await createSignal({
            clientId: selectedClientId,
            agencyId: effectiveAgencyId,
            signalType: 'incident',
            severity: intensity >= 4 ? 'critical' : 'action',
            title: 'High-intensity incident logged',
            message: `${behavior} logged at intensity ${intensity}`,
            drivers: { behavior, intensity, antecedent, consequence },
            source: { app: 'beacon', trigger: 'auto_severity' },
          });
          toast({ title: '⚠ Supervisor signal sent', description: `Intensity ${intensity} triggered alert` });
        } catch (e) { console.warn('[Beacon] createSignal failed (non-blocking):', e); }
      }

      // ── Escalation detection ──
      const esc = trackBehaviorForEscalation(behavior);
      if (esc?.escalated) {
        try {
          await createSignal({
            clientId: selectedClientId,
            agencyId: effectiveAgencyId,
            signalType: 'escalation',
            severity: 'action',
            title: 'Escalation detected',
            message: `${esc.count} ${esc.behavior} events within 10 minutes`,
            drivers: { behavior: esc.behavior, count: esc.count, window_minutes: 10 },
            source: { app: 'beacon', trigger: 'escalation_rule' },
          });
          await logEvent({
            clientId: selectedClientId,
            agencyId: effectiveAgencyId,
            eventType: 'ai',
            eventName: 'escalation_flagged',
            metadata: { behavior: esc.behavior, count: esc.count, window_minutes: 10 },
          });
          toast({ title: '🚨 Escalation alert sent', description: `${esc.count}× ${esc.behavior} in 10 min` });
        } catch (e) { console.warn('[Beacon] escalation signal failed:', e); }
      }

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

  const addCustomBehaviorTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBehavior(trimmed);
    setCustomBehaviors((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
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
              <TabsTrigger value="behaviors" className="gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Behaviors
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

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Or type a new behavior (saves to student profile)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newBehaviorInput}
                        onChange={(e) => setNewBehaviorInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBehaviorToStudent(newBehaviorInput); } }}
                        placeholder="Type custom behavior..."
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addBehaviorToStudent(newBehaviorInput)}
                        disabled={!newBehaviorInput.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <TagSelector
                    label="C — Consequence (what happened after)"
                    tags={consequenceTags}
                    selected={consequence}
                    onSelect={setConsequence}
                    color="text-foreground"
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

            {/* BEHAVIORS TAB */}
            <TabsContent value="behaviors">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_1fr]">
                {/* Add behavior */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Add Behavior</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Behavior Name</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. Vocal Protest"
                          value={newBehaviorInput}
                          onChange={(e) => setNewBehaviorInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBehaviorToStudent(newBehaviorInput); } }}
                        />
                        <Button onClick={() => addBehaviorToStudent(newBehaviorInput)} disabled={!newBehaviorInput.trim()}>
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                    {isSoloMode && (
                      <>
                        <div className="border-t border-border/50 pt-3 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Or add a behavior category with triggers</Label>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Category Name</Label>
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
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Current behaviors list with rename & delete */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Student Behaviors ({studentBehaviors.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {studentBehaviors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No behaviors configured for this student.</p>
                    ) : (
                      <div className="space-y-2">
                        {studentBehaviors.map((b) => (
                          <div key={b.id} className="flex items-center justify-between rounded-md border border-border/60 p-2.5 gap-2">
                            <div className="min-w-0 flex-1">
                              {editingBehaviorId === b.id ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    value={editingBehaviorName}
                                    onChange={(e) => setEditingBehaviorName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') renameBehavior(b.id, editingBehaviorName); if (e.key === 'Escape') setEditingBehaviorId(null); }}
                                    className="h-7 text-sm"
                                    autoFocus
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => renameBehavior(b.id, editingBehaviorName)}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingBehaviorId(null)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm font-medium truncate">{b.name}</p>
                                  {b.operationalDefinition && (
                                    <p className="text-xs text-muted-foreground truncate">{b.operationalDefinition}</p>
                                  )}
                                  <div className="flex gap-1 mt-1">
                                    {b.methods?.map((m) => (
                                      <Badge key={m} variant="secondary" className="text-[10px] font-normal">{m}</Badge>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                            {editingBehaviorId !== b.id && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => { setEditingBehaviorId(b.id); setEditingBehaviorName(b.name); }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteBehaviorFromStudent(b.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Custom Antecedent Tags */}
                    <div className="pt-3 border-t border-border/40 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Antecedent Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {persistedAntecedents.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
                            {tag}
                            <button onClick={() => removePersistedAntecedent(tag)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                        {persistedAntecedents.length === 0 && <span className="text-xs text-muted-foreground">None added</span>}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add antecedent tag…"
                          value={newAntecedentInput}
                          onChange={(e) => setNewAntecedentInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPersistedAntecedent(newAntecedentInput); } }}
                          className="h-8 text-sm"
                        />
                        <Button size="sm" variant="outline" onClick={() => addPersistedAntecedent(newAntecedentInput)} disabled={!newAntecedentInput.trim()}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Custom Consequence Tags */}
                    <div className="pt-3 border-t border-border/40 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Consequence Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {persistedConsequences.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
                            {tag}
                            <button onClick={() => removePersistedConsequence(tag)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                        {persistedConsequences.length === 0 && <span className="text-xs text-muted-foreground">None added</span>}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add consequence tag…"
                          value={newConsequenceInput}
                          onChange={(e) => setNewConsequenceInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPersistedConsequence(newConsequenceInput); } }}
                          className="h-8 text-sm"
                        />
                        <Button size="sm" variant="outline" onClick={() => addPersistedConsequence(newConsequenceInput)} disabled={!newConsequenceInput.trim()}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Category list (solo mode) */}
                    {isSoloMode && categories.length > 0 && (
                      <div className="pt-3 border-t border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Behavior Categories</p>
                        <div className="space-y-2">
                          {categories.map((cat) => (
                            <div key={cat.id} className="rounded-md border border-border/60 p-2.5">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{cat.name}</p>
                                <Badge variant="outline">{(cat.triggers || []).length} triggers</Badge>
                              </div>
                              {cat.description && (
                                <p className="mb-1 text-xs text-muted-foreground">{cat.description}</p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {(cat.triggers || []).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

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
