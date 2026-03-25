/**
 * ParentInsightCards — Displays parent-friendly insight cards for a student.
 * Types: win, pattern, concern, home_note, teacher_note
 * Positive, supportive tone always.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Heart, MessageSquare, Star, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParentInsight {
  id: string;
  insight_type: string;
  title: string;
  body: string;
  tone: string;
  is_read: boolean;
  created_at: string;
}

const INSIGHT_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  win: { icon: Star, color: 'text-amber-500', label: '🌟 Win' },
  pattern: { icon: TrendingUp, color: 'text-blue-500', label: '📈 Pattern' },
  concern: { icon: Heart, color: 'text-rose-500', label: '💗 Heads Up' },
  home_note: { icon: MessageSquare, color: 'text-green-500', label: '🏠 From Home' },
  teacher_note: { icon: Sparkles, color: 'text-purple-500', label: '📝 From Teacher' },
};

interface Props {
  studentId: string;
  agencyId: string;
  maxItems?: number;
  className?: string;
}

export function ParentInsightCards({ studentId, agencyId, maxItems = 5, className }: Props) {
  const [insights, setInsights] = useState<ParentInsight[]>([]);

  useEffect(() => {
    if (!studentId) return;
    cloudSupabase
      .from('parent_insights')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(maxItems)
      .then(({ data }) => setInsights((data || []) as any[]));
  }, [studentId, maxItems]);

  if (insights.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="section-header">
        <Sparkles className="h-3 w-3" /> Updates for You
      </p>
      {insights.map(ins => {
        const config = INSIGHT_CONFIG[ins.insight_type] || INSIGHT_CONFIG.win;
        const Icon = config.icon;
        return (
          <Card key={ins.id} className={cn('border-border/40 hover-lift transition-all', !ins.is_read && 'ring-1 ring-primary/20')}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2.5">
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold">{ins.title}</p>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{config.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ins.body}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(ins.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
