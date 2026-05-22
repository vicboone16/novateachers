/**
 * Skill Probe Session Component
 * Trial-by-trial +/- recording with configurable mastery criteria.
 * After each session, checks historical sessions to determine if the
 * skill has been mastered (threshold % across N consecutive sessions).
 */
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { writePointEntry } from '@/lib/beacon-points';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { writeUnifiedEvent } from '@/lib/unified-events';
import { logEvent } from '@/lib/supervisorSignals';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { Play, Square, Check, X, Target, RotateCcw, Award, TrendingUp, Settings2 } from 'lucide-react';

interface Props {
  studentId: string;
  studentName: string;
}

interface SessionResult {
  sessionId: string;
  percentage: number;
  date: string;
  trials: number;
}

type MasteryStatus = 'mastered' | 'approaching' | 'in_progress' | null;

const DEFAULT_THRESHOLD = 80;
const DEFAULT_CONSECUTIVE = 3;

export const SkillProbe = ({ studentId, studentName }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();

  const [skillName, setSkillName] = useState('');
  const [running, setRunning] = useState(false);
  const [trials, setTrials] = useState<boolean[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [masteryThreshold, setMasteryThreshold] = useState(DEFAULT_THRESHOLD);
  const [consecutiveSessions, setConsecutiveSessions] = useState(DEFAULT_CONSECUTIVE);
  const [masteryStatus, setMasteryStatus] = useState<MasteryStatus>(null);
  const [recentSessions, setRecentSessions] = useState<SessionResult[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const startProbe = async () => {
    if (!skillName.trim()) return;
    setRunning(true);
    setTrials([]);
    setMasteryStatus(null);
    setRecentSessions([]);
    startTimeRef.current = new Date();

    if (user) {
      const sessionId = crypto.randomUUID();
      sessionIdRef.current = sessionId;
      try {
        await (supabase.from('teacher_data_sessions') as any).insert({
          id: sessionId,
          agency_id: effectiveAgencyId,
          client_id: studentId,
          user_id: user.id,
          mode: 'tally',
          started_at: startTimeRef.current.toISOString(),
          notes: `Skill probe: ${skillName}`,
        });
      } catch (e) { console.warn('[SkillProbe] session create failed (non-blocking):', e); }
    }
  };

  const recordTrial = async (correct: boolean) => {
    const trialIndex = trials.length;
    setTrials(prev => [...prev, correct]);

    if (!user) return;

    if (sessionIdRef.current) {
      try {
        await (supabase.from('teacher_data_points') as any).insert({
          session_id: sessionIdRef.current,
          value: correct ? 1 : 0,
          interval_index: trialIndex,
          occurred_at: new Date().toISOString(),
          label: correct ? '+' : '-',
        });
      } catch (e) { console.warn('[SkillProbe] data point insert failed (non-blocking):', e); }
    }

    writeUnifiedEvent({
      studentId,
      staffId: user.id,
      agencyId: effectiveAgencyId,
      eventType: 'skill_probe',
      eventSubtype: correct ? 'correct' : 'incorrect',
      eventValue: {
        skill_name: skillName,
        trial_number: trialIndex + 1,
        correct,
      },
      sourceModule: 'skill_probe',
    });

    if (correct) {
      writePointEntry({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        points: 2,
        reason: `Probe correct — ${skillName}`,
        source: 'probe_success',
      });
    }

    try {
      await logEvent({
        clientId: studentId,
        agencyId: effectiveAgencyId,
        eventType: 'skill_trial',
        eventName: skillName,
        value: correct ? 1 : 0,
        correctness: correct ? '+' : '-',
        metadata: { trial_number: trialIndex + 1, session_id: sessionIdRef.current },
      });
    } catch (e) { console.warn('[SkillProbe] logEvent trial failed:', e); }
  };

  const endProbe = async () => {
    const correctCount = trials.filter(t => t).length;
    const total = trials.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const endedAt = new Date();

    const summaryJson = {
      skill_name: skillName,
      trials: total,
      correct: correctCount,
      incorrect: total - correctCount,
      percentage: pct,
      mastery_threshold: masteryThreshold,
      consecutive_required: consecutiveSessions,
    };

    if (sessionIdRef.current) {
      try {
        await (supabase.from('teacher_data_sessions') as any)
          .update({
            ended_at: endedAt.toISOString(),
            summary_json: summaryJson,
          })
          .eq('id', sessionIdRef.current);
      } catch (e) { console.warn('[SkillProbe] session close failed (non-blocking):', e); }
    }

    if (user) {
      writeUnifiedEvent({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        eventType: 'skill_probe',
        eventSubtype: 'session_summary',
        eventValue: {
          ...summaryJson,
          started_at: startTimeRef.current?.toISOString(),
          ended_at: endedAt.toISOString(),
          session_id: sessionIdRef.current,
        },
        sourceModule: 'skill_probe',
      });
    }

    setRunning(false);

    // Check mastery across recent sessions
    if (total > 0 && user) {
      await checkMastery(sessionIdRef.current!, pct);
    }

    sessionIdRef.current = null;
  };

  /**
   * Query the N most recent probe sessions for this student+skill and
   * determine whether mastery criteria have been met.
   */
  const checkMastery = async (currentSessionId: string, currentPct: number) => {
    try {
      const { data: sessions } = await (supabase.from('teacher_data_sessions') as any)
        .select('id, summary_json, ended_at')
        .eq('client_id', studentId)
        .ilike('notes', `Skill probe: ${skillName}`)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(consecutiveSessions + 5);

      if (!sessions?.length) return;

      // Include current session (may not be in DB yet when we query)
      const results: SessionResult[] = sessions.map((s: any) => ({
        sessionId: s.id,
        percentage: s.summary_json?.percentage ?? 0,
        date: s.ended_at,
        trials: s.summary_json?.trials ?? 0,
      }));

      // If current session isn't in results yet, prepend it
      if (!results.find(r => r.sessionId === currentSessionId)) {
        results.unshift({
          sessionId: currentSessionId,
          percentage: currentPct,
          date: new Date().toISOString(),
          trials: trials.length,
        });
      }

      const recent = results.slice(0, consecutiveSessions);
      setRecentSessions(recent);

      if (recent.length < consecutiveSessions) {
        setMasteryStatus('in_progress');
        return;
      }

      const allMet = recent.every(r => r.percentage >= masteryThreshold);
      const anyMet = recent.some(r => r.percentage >= masteryThreshold);

      if (allMet) {
        setMasteryStatus('mastered');
        // Write mastery event
        writeUnifiedEvent({
          studentId,
          staffId: user!.id,
          agencyId: effectiveAgencyId,
          eventType: 'skill_probe',
          eventSubtype: 'mastery_achieved',
          eventValue: {
            skill_name: skillName,
            threshold: masteryThreshold,
            consecutive_sessions: consecutiveSessions,
            session_percentages: recent.map(r => r.percentage),
          },
          sourceModule: 'skill_probe',
        });
      } else if (anyMet) {
        setMasteryStatus('approaching');
      } else {
        setMasteryStatus('in_progress');
      }
    } catch (e) {
      console.warn('[SkillProbe] mastery check failed (non-blocking):', e);
    }
  };

  const resetProbe = () => {
    setRunning(false);
    setTrials([]);
    setSkillName('');
    setMasteryStatus(null);
    setRecentSessions([]);
    startTimeRef.current = null;
    sessionIdRef.current = null;
  };

  const correctCount = trials.filter(t => t).length;
  const total = trials.length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const masteryBadge = {
    mastered: { label: 'Mastered', className: 'bg-green-100 text-green-700 border-green-400' },
    approaching: { label: 'Approaching Mastery', className: 'bg-amber-100 text-amber-700 border-amber-400' },
    in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 border-blue-400' },
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Skill Probe
          </span>
          {!running && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowSettings(s => !s)}
              title="Mastery criteria"
            >
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Mastery criteria settings */}
        {showSettings && !running && (
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Mastery Criteria</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Threshold (%)</Label>
                <Input
                  type="number"
                  min={50} max={100}
                  value={masteryThreshold}
                  onChange={e => setMasteryThreshold(Number(e.target.value))}
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Consecutive Sessions</Label>
                <Input
                  type="number"
                  min={1} max={10}
                  value={consecutiveSessions}
                  onChange={e => setConsecutiveSessions(Number(e.target.value))}
                  className="h-8 text-sm mt-1"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Mastery = {masteryThreshold}% correct across {consecutiveSessions} consecutive sessions
            </p>
          </div>
        )}

        {!running ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Skill / Target Name</Label>
              <Input
                value={skillName}
                onChange={e => setSkillName(e.target.value)}
                placeholder="e.g. Identify colors, Count to 10…"
                className="h-9 text-sm"
              />
            </div>
            <Button
              onClick={startProbe}
              disabled={!skillName.trim()}
              className="w-full gap-2 h-11"
            >
              <Play className="h-4 w-4" /> Start Probe
            </Button>

            {/* Mastery result after session ends */}
            {masteryStatus && (
              <div className="space-y-2 pt-1">
                <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${masteryBadge[masteryStatus].className}`}>
                  <Award className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{masteryBadge[masteryStatus].label}</p>
                    <p className="text-xs">
                      {masteryStatus === 'mastered'
                        ? `${skillName} — met ${masteryThreshold}% for ${consecutiveSessions} consecutive sessions`
                        : masteryStatus === 'approaching'
                        ? `Some sessions met ${masteryThreshold}% — keep going`
                        : `Need ${consecutiveSessions} sessions at ${masteryThreshold}%+`}
                    </p>
                  </div>
                </div>

                {recentSessions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Recent Sessions
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {recentSessions.map((s, i) => (
                        <Badge
                          key={s.sessionId}
                          variant="outline"
                          className={`text-[10px] ${s.percentage >= masteryThreshold ? 'border-green-400 text-green-700' : 'border-muted-foreground/40'}`}
                        >
                          S{i + 1}: {s.percentage}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{skillName}</p>
                <p className="text-xs text-muted-foreground">
                  Trial {total + 1} · Mastery: {masteryThreshold}% × {consecutiveSessions} sessions
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={resetProbe} className="gap-1 text-xs">
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
                <Button variant="destructive" size="sm" onClick={endProbe} className="gap-1">
                  <Square className="h-3 w-3" /> End
                </Button>
              </div>
            </div>

            {/* Large tap targets */}
            <div className="flex gap-3 justify-center">
              <Button
                size="lg"
                className="h-20 w-32 rounded-xl text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-md"
                onClick={() => recordTrial(true)}
              >
                <Check className="mr-1.5 h-6 w-6" /> +
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 w-32 rounded-xl text-lg font-bold border-destructive/40 text-destructive hover:bg-destructive/10 shadow-md"
                onClick={() => recordTrial(false)}
              >
                <X className="mr-1.5 h-6 w-6" /> −
              </Button>
            </div>

            {/* Live results */}
            {total > 0 && (
              <div className="text-center space-y-2">
                <p className={`text-3xl font-bold ${pct >= masteryThreshold ? 'text-green-600' : 'text-primary'}`}>
                  {pct}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {correctCount}/{total} correct
                  {pct >= masteryThreshold && ' · above threshold'}
                </p>
                <div className="flex flex-wrap gap-1 justify-center">
                  {trials.map((t, i) => (
                    <Badge
                      key={i}
                      variant={t ? 'default' : 'outline'}
                      className="text-[10px] h-5 w-7 justify-center"
                    >
                      {t ? '✓' : '✗'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
