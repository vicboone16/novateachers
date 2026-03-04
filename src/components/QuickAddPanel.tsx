import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  Play,
  Square,
  Pause,
  Hash,
  Timer,
  StickyNote,
  Zap,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client } from '@/lib/types';

interface StudentBehavior {
  id: string;
  name: string;
  type?: string;
}

const DEFAULT_ANTECEDENT_TAGS = ['Transition', 'Demand', 'Denied access', 'Peer conflict', 'Noise', 'Unstructured time'];
const DEFAULT_CONSEQUENCE_TAGS = ['Redirected', 'Break given', 'Verbal prompt', 'Removed from situation', 'Ignored', 'Peer mediation'];

export const QuickAddPanel = () => {
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [behaviors, setBehaviors] = useState<StudentBehavior[]>([]);
  const [selectedBehavior, setSelectedBehavior] = useState('');
  const [tab, setTab] = useState('frequency');

  // Frequency
  const [freqCount, setFreqCount] = useState(0);
  const [freqSaving, setFreqSaving] = useState(false);

  // Duration
  const [durationRunning, setDurationRunning] = useState(false);
  const [durationPaused, setDurationPaused] = useState(false);
  const [durationElapsed, setDurationElapsed] = useState(0);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [durationSaving, setDurationSaving] = useState(false);

  // Quick Note
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // ABC Quick
  const [abcAntecedent, setAbcAntecedent] = useState('');
  const [abcBehavior, setAbcBehavior] = useState('');
  const [abcConsequence, setAbcConsequence] = useState('');
  const [abcSaving, setAbcSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (selectedClientId) loadBehaviors();
  }, [selectedClientId]);

  // Auto-save frequency on student switch
  useEffect(() => {
    return () => {
      // cleanup duration timer
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, []);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      setClients(normalizeClients(data));
    } catch { /* silent */ }
  };

  const loadBehaviors = async () => {
    const { data } = await supabase
      .from('students')
      .select('behaviors')
      .eq('id', selectedClientId)
      .single();
    setBehaviors((data?.behaviors as StudentBehavior[]) || []);
  };

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  // ── Frequency ──
  const saveFrequency = async () => {
    if (!selectedClientId || !selectedBehavior || freqCount === 0) {
      toast({ title: 'Select student & behavior, and count > 0', variant: 'destructive' });
      return;
    }
    setFreqSaving(true);
    try {
      const { error } = await supabase.from('teacher_frequency_entries').insert({
        agency_id: effectiveAgencyId,
        client_id: selectedClientId,
        user_id: user?.id,
        behavior_name: selectedBehavior,
        count: freqCount,
        logged_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      toast({ title: `✓ ${freqCount}× ${selectedBehavior} saved` });
      setFreqCount(0);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setFreqSaving(false);
    }
  };

  // ── Duration ──
  const startDuration = () => {
    setDurationRunning(true);
    setDurationPaused(false);
    durationRef.current = setInterval(() => {
      setDurationElapsed(prev => prev + 1);
    }, 1000);
  };

  const pauseDuration = () => {
    setDurationPaused(true);
    if (durationRef.current) clearInterval(durationRef.current);
  };

  const resumeDuration = () => {
    setDurationPaused(false);
    durationRef.current = setInterval(() => {
      setDurationElapsed(prev => prev + 1);
    }, 1000);
  };

  const stopAndSaveDuration = async () => {
    if (durationRef.current) clearInterval(durationRef.current);
    setDurationRunning(false);
    setDurationPaused(false);

    if (!selectedClientId || !selectedBehavior || durationElapsed === 0) {
      toast({ title: 'Select student & behavior first', variant: 'destructive' });
      return;
    }

    setDurationSaving(true);
    try {
      const { error } = await supabase.from('teacher_duration_entries').insert({
        agency_id: effectiveAgencyId,
        client_id: selectedClientId,
        user_id: user?.id,
        behavior_name: selectedBehavior,
        duration_seconds: durationElapsed,
        logged_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      const mins = Math.floor(durationElapsed / 60);
      const secs = durationElapsed % 60;
      toast({ title: `✓ ${mins}m ${secs}s saved for ${selectedBehavior}` });
      setDurationElapsed(0);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDurationSaving(false);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Quick Note ──
  const saveNote = async () => {
    if (!selectedClientId || !noteText.trim()) {
      toast({ title: 'Select student and enter a note', variant: 'destructive' });
      return;
    }
    setNoteSaving(true);
    try {
      const { error } = await supabase.from('teacher_quick_notes').insert({
        agency_id: effectiveAgencyId,
        client_id: selectedClientId,
        user_id: user?.id,
        behavior_name: selectedBehavior || null,
        note: noteText.trim(),
      });
      if (error) throw error;
      toast({ title: '✓ Note saved' });
      setNoteText('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setNoteSaving(false);
    }
  };

  // ── ABC Quick Log ──
  const saveABC = async () => {
    if (!selectedClientId || !abcAntecedent || !abcBehavior || !abcConsequence) {
      toast({ title: 'Select A, B, and C', variant: 'destructive' });
      return;
    }
    setAbcSaving(true);
    try {
      const { error } = await supabase.from('abc_logs').insert({
        client_id: selectedClientId,
        user_id: user?.id,
        antecedent: abcAntecedent,
        behavior: abcBehavior,
        consequence: abcConsequence,
        intensity: 3,
        logged_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: '✓ ABC logged' });
      setAbcAntecedent('');
      setAbcBehavior('');
      setAbcConsequence('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAbcSaving(false);
    }
  };

  const behaviorNames = useMemo(() => behaviors.map(b => b.name), [behaviors]);

  const TagRow = ({ tags, selected, onSelect, color }: {
    tags: string[];
    selected: string;
    onSelect: (v: string) => void;
    color: string;
  }) => (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(selected === tag ? '' : tag)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
            selected === tag
              ? `bg-primary text-primary-foreground border-primary`
              : `bg-muted/50 text-muted-foreground border-border hover:bg-accent`
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  );

  if (!currentWorkspace) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50">
      {/* Toggle button */}
      <div className="mx-auto max-w-6xl px-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 rounded-t-lg bg-primary px-4 py-2 text-primary-foreground text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Zap className="h-4 w-4" />
          Quick Add
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {/* Panel */}
      {expanded && (
        <div className="border-t border-border bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
          <div className="mx-auto max-w-6xl px-4 py-4 space-y-3">
            {/* Student + Behavior selectors */}
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[180px] flex-1 max-w-xs">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select student…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClientId && behaviorNames.length > 0 && (
                <div className="min-w-[180px] flex-1 max-w-xs">
                  <Select value={selectedBehavior} onValueChange={setSelectedBehavior}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select behavior…" />
                    </SelectTrigger>
                    <SelectContent>
                      {behaviorNames.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedClientId && (
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="h-8">
                  <TabsTrigger value="frequency" className="gap-1 text-xs h-7 px-3">
                    <Hash className="h-3 w-3" /> Frequency
                  </TabsTrigger>
                  <TabsTrigger value="duration" className="gap-1 text-xs h-7 px-3">
                    <Timer className="h-3 w-3" /> Duration
                  </TabsTrigger>
                  <TabsTrigger value="note" className="gap-1 text-xs h-7 px-3">
                    <StickyNote className="h-3 w-3" /> Note
                  </TabsTrigger>
                  <TabsTrigger value="abc" className="gap-1 text-xs h-7 px-3">
                    <Zap className="h-3 w-3" /> ABC
                  </TabsTrigger>
                </TabsList>

                {/* Frequency Tab */}
                <TabsContent value="frequency" className="mt-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-12 w-12 rounded-full text-lg"
                        onClick={() => setFreqCount(Math.max(0, freqCount - 1))}
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <span className="text-4xl font-bold tabular-nums min-w-[3ch] text-center text-foreground">
                        {freqCount}
                      </span>
                      <Button
                        size="icon"
                        className="h-16 w-16 rounded-full text-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                        onClick={() => setFreqCount(freqCount + 1)}
                      >
                        <Plus className="h-6 w-6" />
                      </Button>
                    </div>
                    <Button
                      onClick={saveFrequency}
                      disabled={freqSaving || freqCount === 0}
                      size="sm"
                      className="ml-auto gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Save
                    </Button>
                  </div>
                </TabsContent>

                {/* Duration Tab */}
                <TabsContent value="duration" className="mt-3">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-mono font-bold text-foreground min-w-[5ch]">
                      {formatDuration(durationElapsed)}
                    </span>
                    <div className="flex gap-2">
                      {!durationRunning ? (
                        <Button size="sm" onClick={startDuration} className="gap-1.5">
                          <Play className="h-3.5 w-3.5" /> Start
                        </Button>
                      ) : durationPaused ? (
                        <Button size="sm" onClick={resumeDuration} variant="outline" className="gap-1.5">
                          <Play className="h-3.5 w-3.5" /> Resume
                        </Button>
                      ) : (
                        <Button size="sm" onClick={pauseDuration} variant="outline" className="gap-1.5">
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </Button>
                      )}
                      {durationRunning && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={stopAndSaveDuration}
                          disabled={durationSaving}
                          className="gap-1.5"
                        >
                          <Square className="h-3.5 w-3.5" /> Stop & Save
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Note Tab */}
                <TabsContent value="note" className="mt-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Quick observation…"
                      className="min-h-[60px] text-sm flex-1 resize-none"
                      rows={2}
                    />
                    <Button
                      onClick={saveNote}
                      disabled={noteSaving || !noteText.trim()}
                      size="sm"
                      className="self-end gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Save
                    </Button>
                  </div>
                </TabsContent>

                {/* ABC Tab */}
                <TabsContent value="abc" className="mt-3 space-y-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-500">Antecedent</span>
                    <TagRow tags={DEFAULT_ANTECEDENT_TAGS} selected={abcAntecedent} onSelect={setAbcAntecedent} color="orange" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500">Behavior</span>
                    <TagRow tags={behaviorNames.length > 0 ? behaviorNames : ['Elopement', 'Verbal outburst', 'Aggression', 'Non-compliance']} selected={abcBehavior} onSelect={setAbcBehavior} color="red" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Consequence</span>
                    <TagRow tags={DEFAULT_CONSEQUENCE_TAGS} selected={abcConsequence} onSelect={setAbcConsequence} color="blue" />
                  </div>
                  <Button
                    onClick={saveABC}
                    disabled={abcSaving || !abcAntecedent || !abcBehavior || !abcConsequence}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Log ABC
                  </Button>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
