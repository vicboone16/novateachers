/**
 * StudentQuickActionModal — Full-featured modal opened on student card tap.
 * Sections: Behavior, Engagement, Points, Probe, ABC, Tools (with External Links), Prompt Status.
 * All writes go to Core-owned tables. Auto-save on action.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { generateStudentLoginCode, getActiveStudentCode } from '@/lib/game-data';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { writePointEntry } from '@/lib/beacon-points';
import { writeUnifiedEvent } from '@/lib/unified-events';
import { ExternalAccessSheet } from '@/components/ExternalAccessSheet';
import { BeaconTeacherSupportPanel } from '@/components/BeaconTeacherSupportPanel';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Star, Plus, Minus, Check, X, Play, ExternalLink,
  Hand, DoorOpen, Bomb, Megaphone, ShieldX,
  Timer, Clock, Pause, Square,
  Gift, KeyRound, Copy, Gamepad2, Camera, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BEHAVIORS = [
  { name: 'Aggression', icon: Hand, abbr: 'AGG' },
  { name: 'Elopement', icon: DoorOpen, abbr: 'ELP' },
  { name: 'Property Destruction', icon: Bomb, abbr: 'PD' },
  { name: 'Major Disruption', icon: Megaphone, abbr: 'DIS' },
  { name: 'Noncompliance', icon: ShieldX, abbr: 'NC' },
];

const POINT_PRESETS = [1, 5, 10];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  pointBalance: number;
  agencyId: string;
  responseCostEnabled?: boolean;
  onBehavior: (name: string) => void;
  onEngagement: (engaged: boolean) => void;
  onPointChange: (studentId: string, delta: number) => void;
}

export function StudentQuickActionModal({
  open, onOpenChange, studentId, studentName, pointBalance,
  agencyId, responseCostEnabled = true,
  onBehavior, onEngagement, onPointChange,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customPoints, setCustomPoints] = useState('');
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [externalSheetOpen, setExternalSheetOpen] = useState(false);
  const [supportPanelOpen, setSupportPanelOpen] = useState(false);

  // Duration timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ABC inline state
  const [abcAntecedent, setAbcAntecedent] = useState('');
  const [abcBehavior, setAbcBehavior] = useState('');
  const [abcConsequence, setAbcConsequence] = useState('');

  const awardPoints = async (amount: number) => {
    if (!user) return;
    onPointChange(studentId, amount);
    if ('vibrate' in navigator) navigator.vibrate(amount > 0 ? 10 : [10, 30, 10]);
    await writePointEntry({
      studentId, staffId: user.id, agencyId,
      points: amount,
      reason: amount > 0 ? 'Manual award' : 'Response cost',
      source: 'quick_action',
    });
    toast({ title: `${amount > 0 ? '+' : ''}${amount} pts → ${studentName}` });
  };

  const handleCustomAward = () => {
    const val = parseInt(customPoints);
    if (!val || val === 0) return;
    awardPoints(val);
    setCustomPoints('');
  };

  const handleBehavior = (name: string) => {
    onBehavior(name);
    toast({ title: `${name} logged` });
  };

  const handleEngagement = (engaged: boolean) => {
    onEngagement(engaged);
    onOpenChange(false);
  };

  // Duration timer
  const startTimer = () => {
    setTimerRunning(true);
    setTimerSeconds(0);
    timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
  };

  const stopTimer = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    if (!user || timerSeconds === 0) return;
    // Write duration entry
    try {
      await supabase.from('teacher_duration_entries').insert({
        agency_id: agencyId, client_id: studentId, user_id: user.id,
        behavior_name: 'Duration event', duration_seconds: timerSeconds,
      });
      toast({ title: `Duration: ${formatDuration(timerSeconds)} recorded` });
    } catch {}
    setTimerSeconds(0);
  };

  // ABC save
  const saveABC = async () => {
    if (!user || !abcBehavior.trim()) return;
    try {
      await supabase.from('abc_logs').insert({
        client_id: studentId, user_id: user.id,
        antecedent: abcAntecedent.trim() || 'Not specified',
        behavior: abcBehavior.trim(),
        consequence: abcConsequence.trim() || 'Not specified',
      });
      writeUnifiedEvent({
        studentId, staffId: user.id, agencyId,
        eventType: 'abc_event', eventSubtype: abcBehavior.trim(),
        eventValue: { antecedent: abcAntecedent, behavior: abcBehavior, consequence: abcConsequence },
        sourceModule: 'quick_action',
      });
      toast({ title: 'ABC entry saved' });
      setAbcAntecedent('');
      setAbcBehavior('');
      setAbcConsequence('');
    } catch (err: any) {
      toast({ title: 'Error saving ABC', description: err.message, variant: 'destructive' });
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  // Prompt snooze
  const snoozePrompt = (minutes: number) => {
    if (!user) return;
    writeUnifiedEvent({
      studentId, staffId: user.id, agencyId,
      eventType: 'snooze_event', eventSubtype: `snooze_${minutes}min`,
      eventValue: { snooze_minutes: minutes },
      sourceModule: 'quick_action',
    });
    toast({ title: `Prompt snoozed ${minutes} min` });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4">
        {/* Header */}
        <DialogHeader className="pb-2">
          <DialogTitle className="font-heading text-base flex items-center gap-2">
            {studentName}
            <Badge variant="outline" className="text-[10px] gap-1 ml-auto font-bold">
              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
              {pointBalance} pts
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* §1 BEHAVIOR */}
          <Section label="Behavior">
            <div className="flex flex-wrap gap-1">
              {BEHAVIORS.map(({ name, abbr, icon: Icon }) => (
                <button key={name} onClick={() => handleBehavior(name)} title={name}
                  className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive active:scale-95 transition-colors">
                  <Icon className="h-3 w-3" /> {abbr}
                </button>
              ))}
            </div>
            {/* Duration timer */}
            <div className="flex items-center gap-2 mt-1.5">
              {!timerRunning ? (
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={startTimer}>
                  <Timer className="h-3 w-3" /> Duration
                </Button>
              ) : (
                <>
                  <Badge className="gap-1 font-mono animate-pulse">
                    <Clock className="h-3 w-3" /> {formatDuration(timerSeconds)}
                  </Badge>
                  <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={stopTimer}>
                    <Square className="h-3 w-3" /> Stop
                  </Button>
                </>
              )}
            </div>
          </Section>

          {/* §2 ENGAGEMENT */}
          <Section label="Engagement">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 border-accent/40 hover:bg-accent/10 text-xs"
                onClick={() => handleEngagement(true)}>
                <Check className="h-3.5 w-3.5 text-accent" /> Engaged (+1⭐)
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 border-destructive/30 hover:bg-destructive/10 text-xs"
                onClick={() => handleEngagement(false)}>
                <X className="h-3.5 w-3.5 text-destructive" /> Not Engaged
              </Button>
            </div>
          </Section>

          {/* §3 POINTS */}
          <Section label="Points">
            <div className="flex gap-1.5">
              {POINT_PRESETS.map(n => (
                <Button key={n} size="sm" variant="outline" className="flex-1 gap-1 text-xs h-8"
                  onClick={() => awardPoints(n)}>
                  <Plus className="h-3 w-3 text-accent" /> {n}
                </Button>
              ))}
              <div className="flex gap-1">
                <Input type="number" placeholder="#" value={customPoints}
                  onChange={e => setCustomPoints(e.target.value)}
                  className="h-8 text-xs w-14" />
                <Button size="sm" variant="outline" onClick={handleCustomAward} className="h-8 px-2">
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {responseCostEnabled && (
              <div className="flex gap-1.5 mt-1">
                {POINT_PRESETS.map(n => (
                  <Button key={n} size="sm" variant="ghost"
                    className="flex-1 gap-1 text-xs text-destructive hover:bg-destructive/10 h-7"
                    onClick={() => awardPoints(-n)}>
                    <Minus className="h-3 w-3" /> {n}
                  </Button>
                ))}
              </div>
            )}
          </Section>

          {/* §4 PROBE */}
          <Section label="Skill Probe">
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs"
              onClick={() => { onOpenChange(false); navigate(`/collect?student=${studentId}`); }}>
              <Play className="h-3.5 w-3.5 text-primary" /> Start Probe Session
            </Button>
          </Section>

          {/* §5 ABC */}
          <Section label="ABC Entry">
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Antecedent" value={abcAntecedent}
                onChange={e => setAbcAntecedent(e.target.value)}
                className="text-xs h-8" />
              <Input placeholder="Behavior" value={abcBehavior}
                onChange={e => setAbcBehavior(e.target.value)}
                className="text-xs h-8" />
              <Input placeholder="Consequence" value={abcConsequence}
                onChange={e => setAbcConsequence(e.target.value)}
                className="text-xs h-8" />
            </div>
            <Button size="sm" variant="outline" className="w-full mt-1 text-xs h-7 gap-1" onClick={saveABC}
              disabled={!abcBehavior.trim()}>
              <Check className="h-3 w-3" /> Save ABC
            </Button>
          </Section>

          {/* §6 TOOLS: Rewards, Game, Portal, Code, External Links */}
          <Section label="Tools">
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                onClick={() => { onOpenChange(false); navigate('/rewards'); }}>
                <Gift className="h-3.5 w-3.5 text-amber-500" /> Rewards
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                onClick={() => { onOpenChange(false); navigate('/game-board'); }}>
                <Gamepad2 className="h-3.5 w-3.5 text-primary" /> Game Board
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                disabled={codeLoading}
                onClick={async () => {
                  setCodeLoading(true);
                  let code = await getActiveStudentCode(studentId);
                  if (!code) code = await generateStudentLoginCode(studentId, agencyId);
                  if (code) {
                    setStudentCode(code.login_code);
                    navigator.clipboard.writeText(`${window.location.origin}/portal/${code.login_code}`);
                    toast({ title: 'Portal link copied!', description: `Code: ${code.login_code}` });
                  } else {
                    toast({ title: 'Could not generate code', variant: 'destructive' });
                  }
                  setCodeLoading(false);
                }}>
                <KeyRound className="h-3.5 w-3.5" /> {codeLoading ? 'Loading…' : studentCode ? `Code: ${studentCode}` : 'Get Code'}
              </Button>
              {studentCode && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                  onClick={() => {
                    const url = `${window.location.origin}/portal/${studentCode}`;
                    window.open(url, '_blank');
                  }}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open Portal
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                onClick={() => { onOpenChange(false); navigate('/parent-reports'); }}>
                <Camera className="h-3.5 w-3.5 text-primary" /> Parent Snapshot
              </Button>
              <Button size="sm" variant="default" className="gap-1.5 text-xs h-8"
                onClick={() => setExternalSheetOpen(true)}>
                <Link2 className="h-3.5 w-3.5" /> Share Links
              </Button>
            </div>
          </Section>

          {/* §7 PROMPT SNOOZE */}
          <Section label="Prompt">
            <div className="flex gap-1.5">
              {[1, 3, 5].map(m => (
                <Button key={m} size="sm" variant="outline" className="flex-1 text-xs h-7"
                  onClick={() => snoozePrompt(m)}>
                  {m} min
                </Button>
              ))}
              <Button size="sm" variant="outline" className="flex-1 text-xs h-7"
                onClick={() => snoozePrompt(30)}>
                End of block
              </Button>
            </div>
          </Section>
        </div>
      </DialogContent>
    </Dialog>

    <ExternalAccessSheet
      open={externalSheetOpen}
      onOpenChange={setExternalSheetOpen}
      studentId={studentId}
      studentName={studentName}
      agencyId={agencyId}
    />
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}
