/**
 * Skill Probe Session Component
 * Simple start/stop workflow with trial-by-trial +/- recording.
 * Writes results to unified event stream.
 */
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { writeUnifiedEvent } from '@/lib/unified-events';
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

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const startProbe = () => {
    if (!skillName.trim()) return;
    setRunning(true);
    setTrials([]);
    startTimeRef.current = new Date();
  };

  const recordTrial = (correct: boolean) => {
    setTrials(prev => [...prev, correct]);

    // Write each trial as an event
    if (user) {
      writeUnifiedEvent({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        eventType: 'skill_probe',
        eventSubtype: correct ? 'correct' : 'incorrect',
        eventValue: {
          skill_name: skillName,
          trial_number: trials.length + 1,
          correct,
        },
        sourceModule: 'skill_probe',
      });
    }
  };

  const endProbe = () => {
    const correct = trials.filter(t => t).length;
    const total = trials.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Write summary event
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
          correct,
          incorrect: total - correct,
          percentage: pct,
          started_at: startTimeRef.current?.toISOString(),
          ended_at: new Date().toISOString(),
        },
        sourceModule: 'skill_probe',
      });
    }

    setRunning(false);
  };

  const resetProbe = () => {
    setRunning(false);
    setTrials([]);
    setSkillName('');
    startTimeRef.current = null;
  };

  const correct = trials.filter(t => t).length;
  const total = trials.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

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
                  {correct}/{total} correct
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
