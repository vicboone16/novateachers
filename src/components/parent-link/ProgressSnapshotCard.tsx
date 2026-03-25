import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Star, Gift, TrendingUp } from 'lucide-react';

interface Reward {
  name: string;
  emoji: string;
  cost: number;
}

interface Props {
  pointsBalance: number;
  rewards: Reward[];
}

export function ProgressSnapshotCard({ pointsBalance, rewards }: Props) {
  const nextReward = rewards.find(r => r.cost > pointsBalance) || rewards[0];
  const pointsToNext = nextReward ? Math.max(0, nextReward.cost - pointsBalance) : 0;
  const pctToNext = nextReward ? Math.min(100, Math.round((pointsBalance / nextReward.cost) * 100)) : 100;

  return (
    <Card className="border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-900/10 dark:to-orange-900/5 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto mb-2">
              <Star className="h-6 w-6 text-amber-500" />
            </div>
            <p className="text-4xl font-black text-amber-600 dark:text-amber-400 tabular-nums leading-none">
              {pointsBalance}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Points Earned</p>
          </div>
        </div>

        {nextReward && pointsToNext > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Gift className="h-3 w-3" /> Next reward
              </span>
              <span className="font-semibold text-foreground/80">
                {nextReward.emoji} {nextReward.name}
              </span>
            </div>
            <Progress value={pctToNext} className="h-2.5 [&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-orange-400" />
            <p className="text-center text-xs text-muted-foreground">
              <span className="font-bold text-amber-600 dark:text-amber-400">{pointsToNext}</span> points to go — keep it up! 🎉
            </p>
          </div>
        )}

        {nextReward && pointsToNext === 0 && (
          <div className="mt-4 text-center">
            <Badge className="bg-accent text-accent-foreground text-xs px-3 py-1">
              🎁 Ready to redeem: {nextReward.name}!
            </Badge>
          </div>
        )}

        {rewards.length > 1 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {rewards.slice(0, 4).map((r, i) => {
              const canRedeem = pointsBalance >= r.cost;
              return (
                <span
                  key={i}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    canRedeem
                      ? 'bg-accent/10 border-accent/30 text-accent-foreground'
                      : 'bg-muted/50 border-border/40 text-muted-foreground'
                  }`}
                >
                  {r.emoji} {r.name} · {r.cost}pts
                </span>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
