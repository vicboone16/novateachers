/**
 * Skill Probe Session Component
 * Simple start/stop workflow with trial-by-trial +/- recording.
 * Writes results to unified event stream AND Core session tables.
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
import { Play, Square, Check, X, Target, RotateCcw } from 'lucide-react';

interface Props {
  studentId: string;
  studentName: string;
}

export const SkillProbe = ({ studentId, studentName }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();

  const [skillName, setSkillName] = useState('');
  const [running, setRunning] = useState(false);
  const [trials, setTrials] = useState<boolean[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const startProbe = async () => {
    if (!skillName.trim()) return;
    setRunning(true);
    setTrials([]);
    startTimeRef.current = new Date();

    // Create a session row on Core
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

    // Write trial as a data point on Core
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

    // Unified event stream
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

    // Core event stream RPC
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

    // Close session on Core
    if (sessionIdRef.current) {
      try {
        await (supabase.from('teacher_data_sessions') as any)
          .update({
            ended_at: endedAt.toISOString(),
            summary_json: {
              skill_name: skillName,
              trials: total,
              correct: correctCount,
              incorrect: total - correctCount,
              percentage: pct,
            },
          })
          .eq('id', sessionIdRef.current);
      } catch (e) { console.warn('[SkillProbe] session close failed (non-blocking):', e); }
    }

    // Write summary to unified events
    if (user) {
      writeUnifiedEvent({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        eventType: 'skill_probe',
        eventSubtype: 'session_summary',
        eventValue: {
          skill_name: skillName,
          trials: total,
          correct: correctCount,
          incorrect: total - correctCount,
          percentage: pct,
          started_at: startTimeRef.current?.toISOString(),
          ended_at: endedAt.toISOString(),
          session_id: sessionIdRef.current,
        },
        sourceModule: 'skill_probe',
      });
    }

    setRunning(false);
    sessionIdRef.current = null;
  };

  const resetProbe = () => {
    setRunning(false);
    setTrials([]);
    setSkillName('');
    startTimeRef.current = null;
    sessionIdRef.current = null;
  };

  const correctCount = trials.filter(t => t).length;
  const total = trials.length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Skill Probe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{skillName}</p>
                <p className="text-xs text-muted-foreground">Trial {total + 1}</p>
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

            {/* Large tap targets for +/- */}
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

            {/* Results display */}
            {total > 0 && (
              <div className="text-center space-y-2">
                <p className="text-3xl font-bold text-primary">{pct}%</p>
                <p className="text-xs text-muted-foreground">
                  {correctCount}/{total} correct
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
