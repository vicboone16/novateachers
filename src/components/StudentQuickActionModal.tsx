/**
 * StudentQuickActionModal — Opened when a student card is tapped.
 * Provides fast access to points, engagement, probe, behavior, and ABC.
 * All writes go to Core-owned tables.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { writePointEntry } from '@/lib/beacon-points';
import { writeUnifiedEvent } from '@/lib/unified-events';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Star, Plus, Minus, Check, X, Play, ExternalLink,
  Hand, DoorOpen, Bomb, Megaphone, ShieldX,
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

  const awardPoints = async (amount: number) => {
    if (!user) return;
    onPointChange(studentId, amount);
    await writePointEntry({
      studentId,
      staffId: user.id,
      agencyId,
      points: amount,
      reason: amount > 0 ? 'Manual award' : 'Response cost',
      source: 'quick_action',
    });
    toast({ title: `${amount > 0 ? '+' : ''}${amount} points for ${studentName}` });
  };

  const handleCustomAward = () => {
    const val = parseInt(customPoints);
    if (!val || val === 0) return;
    awardPoints(val);
    setCustomPoints('');
  };

  const handleBehavior = (name: string) => {
    onBehavior(name);
    onOpenChange(false);
  };

  const handleEngagement = (engaged: boolean) => {
    onEngagement(engaged);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-base flex items-center gap-2">
            {studentName}
            <Badge variant="outline" className="text-[10px] gap-1 ml-auto">
              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
              {pointBalance} pts
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Points Section */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Give Points</p>
            <div className="flex gap-1.5">
              {POINT_PRESETS.map(n => (
                <Button key={n} size="sm" variant="outline" className="flex-1 gap-1 text-xs"
                  onClick={() => awardPoints(n)}>
                  <Plus className="h-3 w-3 text-accent" /> {n}
                </Button>
              ))}
              <div className="flex gap-1 flex-1">
                <Input
                  type="number"
                  placeholder="Custom"
                  value={customPoints}
                  onChange={e => setCustomPoints(e.target.value)}
                  className="h-8 text-xs w-16"
                />
                <Button size="sm" variant="outline" onClick={handleCustomAward} className="h-8 px-2">
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {responseCostEnabled && (
              <div className="flex gap-1.5">
                {POINT_PRESETS.map(n => (
                  <Button key={n} size="sm" variant="ghost"
                    className="flex-1 gap-1 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => awardPoints(-n)}>
                    <Minus className="h-3 w-3" /> {n}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Engagement */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Engagement Check</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 border-accent/40 hover:bg-accent/10"
                onClick={() => handleEngagement(true)}>
                <Check className="h-3.5 w-3.5 text-accent" /> Yes (+1⭐)
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 border-destructive/30 hover:bg-destructive/10"
                onClick={() => handleEngagement(false)}>
                <X className="h-3.5 w-3.5 text-destructive" /> No
              </Button>
            </div>
          </div>

          {/* Behavior Quick Entry */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Behavior</p>
            <div className="flex flex-wrap gap-1.5">
              {BEHAVIORS.map(({ name, abbr, icon: Icon }) => (
                <button key={name} onClick={() => handleBehavior(name)} title={name}
                  className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive active:scale-95">
                  <Icon className="h-3.5 w-3.5" /> {abbr}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
              onClick={() => { onOpenChange(false); navigate(`/collect?student=${studentId}`); }}>
              <Play className="h-3.5 w-3.5 text-primary" /> Start Probe
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
              onClick={() => { onOpenChange(false); navigate('/tracker'); }}>
              <ExternalLink className="h-3.5 w-3.5" /> ABC Tracker
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
