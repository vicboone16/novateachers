/**
 * StudentIdentityBadge — Displays student identity title (e.g., "Comeback Kid", "Focus Master").
 * Also shows momentum state (rising/stable/dropping).
 */
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Flame, Zap, Target, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MomentumState = 'rising' | 'stable' | 'dropping';

interface Props {
  identityTitle?: string | null;
  identityEmoji?: string | null;
  momentumState?: MomentumState | null;
  comebackActive?: boolean;
  compact?: boolean;
  className?: string;
}

const MOMENTUM_CONFIG: Record<MomentumState, { icon: any; label: string; color: string }> = {
  rising: { icon: TrendingUp, label: 'Rising', color: 'text-emerald-600 dark:text-emerald-400' },
  stable: { icon: Minus, label: 'Stable', color: 'text-muted-foreground' },
  dropping: { icon: TrendingDown, label: 'Dropping', color: 'text-destructive' },
};

const IDENTITY_ICONS: Record<string, any> = {
  'Comeback Kid': Zap,
  'Momentum Rider': Flame,
  'Focus Master': Target,
  'Goal Crusher': Shield,
  'Team Player': Users,
};

export function StudentIdentityBadge({
  identityTitle, identityEmoji, momentumState, comebackActive, compact, className,
}: Props) {
  if (!identityTitle && !momentumState && !comebackActive) return null;

  const mConfig = momentumState ? MOMENTUM_CONFIG[momentumState] : null;
  const MIcon = mConfig?.icon;

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {identityTitle && (
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5 font-semibold bg-primary/10 text-primary border-primary/20">
          {identityEmoji && <span className="text-[10px]">{identityEmoji}</span>}
          {compact ? identityTitle.split(' ')[0] : identityTitle}
        </Badge>
      )}
      {momentumState && momentumState !== 'stable' && mConfig && MIcon && (
        <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 gap-0.5 font-medium', mConfig.color)}>
          <MIcon className="h-2.5 w-2.5" />
          {!compact && mConfig.label}
        </Badge>
      )}
      {comebackActive && (
        <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5 font-medium text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
          💪 {!compact && 'Comeback'}
        </Badge>
      )}
    </div>
  );
}

/**
 * Auto-assign identity based on behavior patterns.
 * Call this after loading student data to derive identity.
 */
export function deriveStudentIdentity(data: {
  streakCount: number;
  comebackEvents: number;
  totalPositive: number;
  totalNegative: number;
  focusImprovement: boolean;
  socialBehaviors: number;
}): { title: string; emoji: string } | null {
  if (data.comebackEvents >= 2) return { title: 'Comeback Kid', emoji: '💪' };
  if (data.streakCount >= 5) return { title: 'Momentum Rider', emoji: '🔥' };
  if (data.focusImprovement) return { title: 'Focus Master', emoji: '🎯' };
  if (data.socialBehaviors >= 3) return { title: 'Team Player', emoji: '🤝' };
  if (data.totalPositive >= 10 && data.totalNegative <= 1) return { title: 'Goal Crusher', emoji: '🏆' };
  return null;
}

/**
 * Derive momentum state from recent performance.
 */
export function deriveMomentumState(recentPoints: number[]): MomentumState {
  if (recentPoints.length < 2) return 'stable';
  const recent = recentPoints.slice(-3);
  const older = recentPoints.slice(-6, -3);
  if (older.length === 0) return 'stable';
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  if (recentAvg > olderAvg * 1.15) return 'rising';
  if (recentAvg < olderAvg * 0.85) return 'dropping';
  return 'stable';
}
