/**
 * StudentLevelBadge — Compact level indicator with XP progress.
 * Shows level number and a thin XP progress bar.
 */
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { xpProgressPct, xpForNextLevel, levelLabel, levelColor, levelBgColor } from '@/lib/level-utils';
import { cn } from '@/lib/utils';

interface Props {
  level: number;
  xp: number;
  /** Show XP bar below the badge */
  showXpBar?: boolean;
  /** Compact mode: smaller text */
  compact?: boolean;
}

export function StudentLevelBadge({ level, xp, showXpBar = false, compact = false }: Props) {
  const pct = xpProgressPct(xp, level);
  const needed = xpForNextLevel(level);
  const isMax = needed === Infinity;

  return (
    <div className="flex flex-col gap-0.5">
      <Badge
        variant="outline"
        className={cn(
          'gap-0.5 font-bold border shrink-0',
          levelBgColor(level),
          levelColor(level),
          compact ? 'text-[9px] px-1 py-0 h-4' : 'text-[10px] px-1.5 py-0 h-5'
        )}
      >
        {levelLabel(level)}
      </Badge>
      {showXpBar && !isMax && (
        <div className="flex items-center gap-1">
          <Progress value={pct} className="h-1 flex-1" />
          <span className="text-[8px] text-muted-foreground tabular-nums shrink-0">
            {xp}/{needed}
          </span>
        </div>
      )}
    </div>
  );
}
