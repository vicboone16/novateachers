/**
 * Beacon Points inline controls for student cards.
 * Shows balance + quick award/remove buttons.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { writePointEntry, type PointSource } from '@/lib/beacon-points';
import { Star, Plus, Minus, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  studentId: string;
  staffId: string;
  agencyId: string;
  balance: number;
  onPointChange: (studentId: string, delta: number) => void;
  responseCostEnabled?: boolean;
}

const AWARD_OPTIONS = [
  { points: 1, label: '+1' },
  { points: 2, label: '+2' },
  { points: 3, label: '+3' },
  { points: 5, label: '+5' },
];

const COST_OPTIONS = [
  { points: -1, label: '-1' },
  { points: -2, label: '-2' },
  { points: -3, label: '-3' },
];

export const BeaconPointsControls = ({
  studentId,
  staffId,
  agencyId,
  balance,
  onPointChange,
  responseCostEnabled = true,
}: Props) => {
  const [awarding, setAwarding] = useState(false);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  const handleAward = async (points: number, source: PointSource = 'manual', reason?: string) => {
    setAwarding(true);
    setFlash(points > 0 ? 'up' : 'down');
    
    // Optimistic update
    onPointChange(studentId, points);

    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(points > 0 ? 10 : [10, 30, 10]);

    await writePointEntry({
      studentId,
      staffId,
      agencyId,
      points,
      reason: reason || (points > 0 ? 'Teacher award' : 'Response cost'),
      source,
    });

    setTimeout(() => {
      setFlash(null);
      setAwarding(false);
    }, 400);
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Balance badge */}
      <Badge
        variant="outline"
        className={cn(
          "gap-1 text-[10px] font-bold transition-all duration-300 shrink-0",
          flash === 'up' && "bg-accent/20 border-accent/50 scale-110",
          flash === 'down' && "bg-destructive/20 border-destructive/50 scale-110",
          !flash && "border-primary/30"
        )}
      >
        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
        {balance}
      </Badge>

      {/* Quick +1 button */}
      <button
        onClick={() => handleAward(1)}
        disabled={awarding}
        title="Award 1 point"
        className="flex items-center justify-center h-6 w-6 rounded-md border border-accent/40 bg-accent/10 text-accent-foreground transition-colors hover:bg-accent/20 active:scale-90 disabled:opacity-50"
      >
        <Plus className="h-3 w-3" />
      </button>

      {/* More options popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            title="Point options"
            className="flex items-center justify-center h-6 w-6 rounded-md border border-border/50 bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60 active:scale-90"
          >
            <Star className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2 space-y-2" align="end" side="top">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Award Points
          </p>
          <div className="flex gap-1">
            {AWARD_OPTIONS.map(opt => (
              <Button
                key={opt.points}
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs font-bold text-accent-foreground border-accent/30 hover:bg-accent/10"
                onClick={() => handleAward(opt.points)}
                disabled={awarding}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {responseCostEnabled && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">
                Response Cost
              </p>
              <div className="flex gap-1">
                {COST_OPTIONS.map(opt => (
                  <Button
                    key={opt.points}
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleAward(opt.points, 'response_cost', 'Response cost')}
                    disabled={awarding}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
