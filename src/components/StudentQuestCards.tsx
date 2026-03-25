/**
 * StudentQuestCards — Advanced quest cards with progress bars, completion state.
 * Shows quests from student_quests table.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Scroll, Trophy, Star, CheckCircle, Target, Flame, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentQuest {
  id: string;
  title: string;
  description: string | null;
  quest_type: string;
  quest_category: string;
  target_value: number;
  current_value: number;
  reward_points: number;
  status: string;
  completed_at: string | null;
  expires_at: string | null;
}

const QUEST_TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  daily: { icon: Star, color: 'text-amber-500', label: 'Daily' },
  weekly: { icon: Target, color: 'text-blue-500', label: 'Weekly' },
  challenge: { icon: Flame, color: 'text-orange-500', label: 'Challenge' },
  social: { icon: Users, color: 'text-purple-500', label: 'Social' },
};

interface Props {
  studentId: string;
  agencyId?: string;
  groupId?: string;
  compact?: boolean;
  className?: string;
}

export function StudentQuestCards({ studentId, agencyId, groupId, compact = false, className }: Props) {
  const [quests, setQuests] = useState<StudentQuest[]>([]);

  useEffect(() => {
    if (!studentId) return;
    let query = cloudSupabase
      .from('student_quests')
      .select('*')
      .eq('student_id', studentId)
      .in('status', ['active', 'completed'])
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(10);
    query.then(({ data }) => setQuests((data || []) as any[]));
  }, [studentId]);

  if (quests.length === 0) return null;

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Scroll className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          {activeQuests.length} quest{activeQuests.length !== 1 ? 's' : ''} active
        </span>
        {completedQuests.length > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 border-accent/50">
            <CheckCircle className="h-2 w-2" /> {completedQuests.length}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Scroll className="h-3 w-3" /> Quests & Missions
      </p>
      {activeQuests.map(q => {
        const config = QUEST_TYPE_CONFIG[q.quest_type] || QUEST_TYPE_CONFIG.daily;
        const Icon = config.icon;
        const pct = Math.min(100, Math.round((q.current_value / q.target_value) * 100));
        return (
          <Card key={q.id} className="border-border/40">
            <CardContent className="p-3">
              <div className="flex items-start gap-2.5">
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold">{q.title}</p>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{config.label}</Badge>
                  </div>
                  {q.description && <p className="text-xs text-muted-foreground mb-1.5">{q.description}</p>}
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-[10px] text-muted-foreground tabular-nums">{q.current_value}/{q.target_value}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Trophy className="h-2.5 w-2.5 text-amber-500" />
                    <span className="text-[10px] text-muted-foreground">+{q.reward_points} pts</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {completedQuests.map(q => (
        <Card key={q.id} className="border-accent/30 bg-accent/5">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-accent shrink-0" />
            <p className="text-sm font-medium text-accent-foreground flex-1">{q.title}</p>
            <Badge className="text-[9px] bg-accent/20 text-accent-foreground">Complete ✓</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
