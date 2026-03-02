import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, Plus, Minus, Check, X, Timer, RotateCcw } from 'lucide-react';
import type { DataCollectionMode, TeacherTarget, TeacherDataSession } from '@/lib/types';

interface Props {
  clientId: string;
  targets: TeacherTarget[];
  onSessionEnd: () => void;
  onNavigateToTracker: () => void;
}

const MODE_OPTIONS: { value: DataCollectionMode; label: string; desc: string }[] = [
  { value: 'tally', label: 'Tally', desc: 'Count frequency with +1 button' },
  { value: 'mts', label: 'MTS', desc: 'Momentary time sampling: Yes/No each interval' },
  { value: 'partial_interval', label: 'Partial Interval', desc: 'Yes if behavior occurs at all during interval' },
  { value: 'whole_interval', label: 'Whole Interval', desc: 'Yes only if behavior occurs entire interval' },
  { value: 'duration', label: 'Duration', desc: 'Start/stop timer for total duration' },
  { value: 'latency', label: 'Latency', desc: 'Time from cue to behavior onset' },
  { value: 'rating', label: 'Rating (1–5)', desc: 'Rate engagement, mood, compliance' },
  { value: 'abc_narrative', label: 'ABC Narrative', desc: 'Link to Trigger Tracker for ABC log' },
];

export const DataCollectionSession = ({ clientId, targets, onSessionEnd, onNavigateToTracker }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [mode, setMode] = useState<DataCollectionMode | ''>('');
  const [targetId, setTargetId] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [session, setSession] = useState<TeacherDataSession | null>(null);
  const [running, setRunning] = useState(false);

  // Tally
  const [tallyCount, setTallyCount] = useState(0);

  // Interval-based (MTS, PI, WI)
  const [intervalIndex, setIntervalIndex] = useState(0);
  const [intervalResults, setIntervalResults] = useState<(boolean | null)[]>([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Duration / Latency
  const [elapsed, setElapsed] = useState(0);
  const [durationRunning, setDurationRunning] = useState(false);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rating
  const [rating, setRating] = useState(3);

  // Trial-by-trial (skill targets)
  const [trialResults, setTrialResults] = useState<boolean[]>([]);

  const selectedTarget = targets.find(t => t.id === targetId);
  const isSkillTarget = selectedTarget?.target_type === 'skill';

  const startSession = async () => {
    if (!mode || !currentWorkspace || !user) return;

    const sessionData: any = {
      agency_id: currentWorkspace.agency_id,
      client_id: clientId,
      user_id: user.id,
      target_id: targetId || null,
      mode,
      started_at: new Date().toISOString(),
      interval_seconds: ['mts', 'partial_interval', 'whole_interval'].includes(mode) ? intervalSeconds : null,
    };

    const { data, error } = await supabase
      .from('teacher_data_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error starting session', description: error.message, variant: 'destructive' });
      return;
    }

    setSession(data);
    setRunning(true);
    setTallyCount(0);
    setIntervalIndex(0);
    setIntervalResults([]);
    setElapsed(0);
    setRating(3);
    setTrialResults([]);

    if (['mts', 'partial_interval', 'whole_interval'].includes(mode)) {
      startIntervalTimer();
    }
  };

  const startIntervalTimer = useCallback(() => {
    setCountdown(intervalSeconds);
    setWaitingForResponse(false);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setWaitingForResponse(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [intervalSeconds]);

  const handleIntervalResponse = async (yes: boolean) => {
    if (!session) return;
    const idx = intervalIndex;

    await supabase.from('teacher_data_points').insert({
      session_id: session.id,
      value: yes ? 1 : 0,
      interval_index: idx,
      occurred_at: new Date().toISOString(),
    });

    setIntervalResults(prev => [...prev, yes]);
    setIntervalIndex(prev => prev + 1);
    setWaitingForResponse(false);
    startIntervalTimer();
  };

  const handleTallyTap = async (delta: number) => {
    if (!session) return;
    const newCount = Math.max(0, tallyCount + delta);
    setTallyCount(newCount);

    if (delta > 0) {
      await supabase.from('teacher_data_points').insert({
        session_id: session.id,
        value: 1,
        occurred_at: new Date().toISOString(),
      });
    }
  };

  const handleTrialResponse = async (correct: boolean) => {
    if (!session) return;
    setTrialResults(prev => [...prev, correct]);

    await supabase.from('teacher_data_points').insert({
      session_id: session.id,
      value: correct ? 1 : 0,
      occurred_at: new Date().toISOString(),
      label: correct ? 'correct' : 'incorrect',
    });
  };

  const toggleDuration = () => {
    if (durationRunning) {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setDurationRunning(false);
    } else {
      setDurationRunning(true);
      elapsedRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
  };

  const endSession = async () => {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);

    let summary: Record<string, any> = {};

    if (isSkillTarget && mode === 'tally') {
      const correct = trialResults.filter(r => r).length;
      const total = trialResults.length;
      summary = { trials: total, correct, incorrect: total - correct, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 };
    } else if (mode === 'tally') {
      summary = { count: tallyCount };
    } else if (['mts', 'partial_interval', 'whole_interval'].includes(mode as string)) {
      const yesCount = intervalResults.filter(r => r === true).length;
      const total = intervalResults.length;
      summary = { intervals: total, yes: yesCount, no: total - yesCount, percentage: total > 0 ? Math.round((yesCount / total) * 100) : 0 };
    } else if (mode === 'duration' || mode === 'latency') {
      summary = { total_seconds: elapsed };
      await supabase.from('teacher_data_points').insert({
        session_id: session.id,
        value: elapsed,
        occurred_at: new Date().toISOString(),
      });
    } else if (mode === 'rating') {
      summary = { rating };
      await supabase.from('teacher_data_points').insert({
        session_id: session.id,
        value: rating,
        occurred_at: new Date().toISOString(),
      });
    }

    await supabase
      .from('teacher_data_sessions')
      .update({ ended_at: new Date().toISOString(), summary_json: summary })
      .eq('id', session.id);

    toast({ title: 'Session ended', description: `Summary: ${JSON.stringify(summary)}` });
    setRunning(false);
    setSession(null);
    setDurationRunning(false);
    onSessionEnd();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Not running: show mode picker ──
  if (!running) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Start Data Collection Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {targets.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Target Behavior/Skill</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Select target (optional)" /></SelectTrigger>
                <SelectContent>
                  {targets.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.target_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Collection Mode</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (opt.value === 'abc_narrative') {
                      onNavigateToTracker();
                      return;
                    }
                    setMode(opt.value);
                  }}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    mode === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border/60 hover:border-primary/30'
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {mode && ['mts', 'partial_interval', 'whole_interval'].includes(mode) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Interval Length (seconds)</Label>
              <Input
                type="number"
                value={intervalSeconds}
                onChange={e => setIntervalSeconds(Math.max(5, parseInt(e.target.value) || 30))}
                className="max-w-[120px]"
              />
            </div>
          )}

          {mode && mode !== 'abc_narrative' && (
            <Button onClick={startSession} className="w-full gap-2 h-12 text-base">
              <Play className="h-4 w-4" />
              Start Session
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Running session ──
  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Session Active — {MODE_OPTIONS.find(o => o.value === mode)?.label}
            {selectedTarget && <Badge variant="outline" className="text-[10px] ml-1">{selectedTarget.name}</Badge>}
          </CardTitle>
          <Button variant="destructive" size="sm" onClick={endSession} className="gap-1.5">
            <Square className="h-3.5 w-3.5" />
            End Session
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* TALLY — with trial-by-trial for skill targets */}
        {mode === 'tally' && !isSkillTarget && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-6xl font-bold text-primary font-heading">{tallyCount}</p>
            <p className="text-sm text-muted-foreground">Tap to count</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => handleTallyTap(-1)}
                disabled={tallyCount === 0}
              >
                <Minus className="h-6 w-6" />
              </Button>
              <Button
                size="lg"
                className="h-20 w-20 rounded-full text-2xl font-bold"
                onClick={() => handleTallyTap(1)}
              >
                <Plus className="h-8 w-8" />
              </Button>
            </div>
          </div>
        )}

        {/* TRIAL-BY-TRIAL for skill targets */}
        {mode === 'tally' && isSkillTarget && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm font-semibold text-foreground">Trial {trialResults.length + 1}</p>
            <div className="flex gap-4">
              <Button
                size="lg"
                className="h-20 w-28 rounded-xl text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => handleTrialResponse(true)}
              >
                <Check className="mr-1.5 h-6 w-6" /> Correct
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 w-28 rounded-xl text-lg font-bold border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => handleTrialResponse(false)}
              >
                <X className="mr-1.5 h-6 w-6" /> Incorrect
              </Button>
            </div>
            {trialResults.length > 0 && (
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-primary">
                  {Math.round((trialResults.filter(r => r).length / trialResults.length) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {trialResults.filter(r => r).length}/{trialResults.length} correct
                </p>
                <div className="flex flex-wrap gap-1 justify-center mt-1">
                  {trialResults.map((r, i) => (
                    <Badge key={i} variant={r ? 'default' : 'outline'} className="text-[10px]">
                      {i + 1}: {r ? '✓' : '✗'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* INTERVAL-BASED (MTS, PI, WI) */}
        {['mts', 'partial_interval', 'whole_interval'].includes(mode as string) && (
          <div className="flex flex-col items-center gap-4 py-6">
            {waitingForResponse ? (
              <>
                <Timer className="h-8 w-8 text-primary animate-bounce" />
                <p className="text-lg font-semibold text-foreground">
                  Interval {intervalIndex + 1}: Was behavior occurring?
                </p>
                <div className="flex gap-4">
                  <Button
                    size="lg"
                    className="h-16 w-24 text-lg bg-accent hover:bg-accent/90"
                    onClick={() => handleIntervalResponse(true)}
                  >
                    <Check className="mr-1 h-5 w-5" /> Yes
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 w-24 text-lg"
                    onClick={() => handleIntervalResponse(false)}
                  >
                    <X className="mr-1 h-5 w-5" /> No
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-5xl font-bold text-foreground font-heading">{countdown}s</p>
                <p className="text-sm text-muted-foreground">Observing… interval {intervalIndex + 1}</p>
              </>
            )}
            {intervalResults.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {intervalResults.map((r, i) => (
                  <Badge key={i} variant={r ? 'default' : 'outline'} className="text-[10px]">
                    {i + 1}: {r ? 'Y' : 'N'}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DURATION */}
        {mode === 'duration' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-5xl font-bold text-foreground font-heading">{formatTime(elapsed)}</p>
            <p className="text-sm text-muted-foreground">
              {durationRunning ? 'Recording duration…' : 'Tap to start/stop'}
            </p>
            <Button
              size="lg"
              variant={durationRunning ? 'destructive' : 'default'}
              className="h-16 w-16 rounded-full"
              onClick={toggleDuration}
            >
              {durationRunning ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
          </div>
        )}

        {/* LATENCY */}
        {mode === 'latency' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-5xl font-bold text-foreground font-heading">{formatTime(elapsed)}</p>
            <p className="text-sm text-muted-foreground">
              {durationRunning ? 'Waiting for behavior onset…' : 'Give cue, then tap Start'}
            </p>
            <Button
              size="lg"
              variant={durationRunning ? 'destructive' : 'default'}
              className="h-16 px-8 rounded-full text-lg"
              onClick={toggleDuration}
            >
              {durationRunning ? 'Behavior Started' : 'Give Cue → Start'}
            </Button>
          </div>
        )}

        {/* RATING */}
        {mode === 'rating' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-5xl font-bold text-primary font-heading">{rating}</p>
            <p className="text-sm text-muted-foreground">Rate 1–5</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <Button
                  key={v}
                  variant={rating === v ? 'default' : 'outline'}
                  size="lg"
                  className="h-14 w-14 rounded-full text-lg font-bold"
                  onClick={() => setRating(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
