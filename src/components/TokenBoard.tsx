/**
 * TokenBoard — Per-student visual star/token progress with auto-reset on redemption.
 * Reads from Core: token_boards, beacon_points_ledger.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { writePointEntry } from '@/lib/beacon-points';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, RotateCcw, Gift, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TokenBoardConfig {
  id: string;
  student_id: string;
  token_target: number;
  current_tokens: number;
  reward_name: string;
  reward_emoji: string;
  skin: string; // 'stars' | 'points' | 'xp' | 'credits'
  auto_reset: boolean;
}

interface Props {
  studentId: string;
  studentName: string;
  agencyId: string;
  classroomId: string;
  balance: number;
  onPointChange?: (studentId: string, delta: number) => void;
}

const SKIN_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  stars: { icon: '⭐', label: 'Stars', color: 'text-amber-500' },
  points: { icon: '💎', label: 'Points', color: 'text-blue-500' },
  xp: { icon: '⚡', label: 'XP', color: 'text-purple-500' },
  credits: { icon: '🪙', label: 'Credits', color: 'text-emerald-500' },
};

export function TokenBoard({ studentId, studentName, agencyId, classroomId, balance, onPointChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [board, setBoard] = useState<TokenBoardConfig | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('token_boards' as any)
        .select('*')
        .eq('student_id', studentId)
        .eq('classroom_id', classroomId)
        .maybeSingle();
      if (data) setBoard(data as any);
    } catch { /* silent */ }
  }, [studentId, classroomId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const addToken = async () => {
    if (!board || !user) return;
    const newTokens = board.current_tokens + 1;

    // Check if target reached
    if (newTokens >= board.token_target) {
      setCelebrating(true);
      toast({ title: `🎉 ${studentName} earned: ${board.reward_emoji} ${board.reward_name}!` });

      // Auto-reset
      if (board.auto_reset) {
        await supabase
          .from('token_boards' as any)
          .update({ current_tokens: 0 })
          .eq('id', board.id);
        setBoard(prev => prev ? { ...prev, current_tokens: 0 } : null);
      } else {
        await supabase
          .from('token_boards' as any)
          .update({ current_tokens: newTokens })
          .eq('id', board.id);
        setBoard(prev => prev ? { ...prev, current_tokens: newTokens } : null);
      }
      setTimeout(() => setCelebrating(false), 2000);
    } else {
      await supabase
        .from('token_boards' as any)
        .update({ current_tokens: newTokens })
        .eq('id', board.id);
      setBoard(prev => prev ? { ...prev, current_tokens: newTokens } : null);
    }
  };

  const resetBoard = async () => {
    if (!board) return;
    await supabase
      .from('token_boards' as any)
      .update({ current_tokens: 0 })
      .eq('id', board.id);
    setBoard(prev => prev ? { ...prev, current_tokens: 0 } : null);
    toast({ title: 'Token board reset' });
  };

  if (!board) return null;

  const skin = SKIN_CONFIG[board.skin] || SKIN_CONFIG.stars;
  const pct = board.token_target > 0 ? Math.min(100, Math.round((board.current_tokens / board.token_target) * 100)) : 0;
  const tokensArray = Array.from({ length: board.token_target }, (_, i) => i < board.current_tokens);

  return (
    <Card className={cn(
      'border-border/40 transition-all duration-300',
      celebrating && 'ring-2 ring-amber-400/50 scale-[1.02]',
    )}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{skin.icon}</span>
            <div>
              <p className="text-xs font-semibold">{studentName}</p>
              <p className="text-[10px] text-muted-foreground">
                {board.current_tokens}/{board.token_target} {skin.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={resetBoard} title="Reset">
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Visual token grid */}
        <div className="flex flex-wrap gap-1">
          {tokensArray.map((filled, i) => (
            <button
              key={i}
              onClick={!filled ? addToken : undefined}
              className={cn(
                'h-7 w-7 rounded-lg flex items-center justify-center text-sm transition-all duration-200',
                filled
                  ? 'bg-amber-100 dark:bg-amber-900/30 scale-100'
                  : 'bg-muted/50 hover:bg-muted cursor-pointer hover:scale-105',
              )}
            >
              {filled ? skin.icon : <span className="text-muted-foreground/30 text-xs">{i + 1}</span>}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <Progress value={pct} className="h-1.5" />

        {/* Reward target */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Gift className="h-3 w-3 text-primary" />
          Goal: <strong className="text-foreground">{board.reward_emoji} {board.reward_name}</strong>
          {pct >= 100 && (
            <Badge className="ml-auto text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Earned!
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
