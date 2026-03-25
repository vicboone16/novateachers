/**
 * ParentEngagementSummary — Teacher-facing summary of parent activity for a student.
 * Shows latest parent actions and home reinforcement log entries.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Eye, HelpCircle, Home, CheckCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParentAction {
  id: string;
  action_type: string;
  message: string | null;
  parent_name: string | null;
  staff_viewed: boolean;
  created_at: string;
}

interface HomeReinforcement {
  id: string;
  activity: string;
  parent_name: string | null;
  staff_acknowledged: boolean;
  created_at: string;
}

const ACTION_ICONS: Record<string, { icon: any; label: string }> = {
  praise_at_home: { icon: Heart, label: 'Praised at Home' },
  noticed_too: { icon: Eye, label: 'Noticed Too' },
  ask_question: { icon: HelpCircle, label: 'Question' },
  home_followup: { icon: Home, label: 'Home Follow-Up' },
};

interface Props {
  studentId: string;
  agencyId: string;
  compact?: boolean;
  className?: string;
}

export function ParentEngagementSummary({ studentId, agencyId, compact = false, className }: Props) {
  const [actions, setActions] = useState<ParentAction[]>([]);
  const [homeLog, setHomeLog] = useState<HomeReinforcement[]>([]);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([
      cloudSupabase
        .from('parent_actions')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(r => r.data || []),
      cloudSupabase
        .from('home_reinforcement_log')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(3)
        .then(r => r.data || []),
    ]).then(([a, h]) => {
      setActions(a as any[]);
      setHomeLog(h as any[]);
    });
  }, [studentId]);

  const handleMarkViewed = async (id: string) => {
    await cloudSupabase.from('parent_actions').update({ staff_viewed: true, staff_viewed_at: new Date().toISOString() }).eq('id', id);
    setActions(prev => prev.map(a => a.id === id ? { ...a, staff_viewed: true } : a));
  };

  const totalEngagement = actions.length + homeLog.length;
  if (totalEngagement === 0 && compact) return null;

  if (compact) {
    const unviewed = actions.filter(a => !a.staff_viewed).length;
    return (
      <Badge variant="outline" className={cn('text-[10px] gap-1', unviewed > 0 && 'border-accent/50 text-accent-foreground', className)}>
        <Users className="h-2.5 w-2.5" /> {totalEngagement} parent action{totalEngagement !== 1 ? 's' : ''}
        {unviewed > 0 && <span className="font-bold text-accent">({unviewed} new)</span>}
      </Badge>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Parent Engagement
        </p>
        {actions.filter(a => !a.staff_viewed).length > 0 && (
          <Badge className="text-[9px] bg-accent/20 text-accent-foreground">
            {actions.filter(a => !a.staff_viewed).length} new
          </Badge>
        )}
      </div>

      {actions.length === 0 && homeLog.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No parent engagement yet for this student.</p>
      )}

      {actions.map(a => {
        const config = ACTION_ICONS[a.action_type] || ACTION_ICONS.praise_at_home;
        const Icon = config.icon;
        return (
          <Card key={a.id} className={cn('border-border/40', !a.staff_viewed && 'ring-1 ring-accent/20')}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold">{config.label}</p>
                    <span className="text-[10px] text-muted-foreground">· {a.parent_name || 'Parent'}</span>
                  </div>
                  {a.message && <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                {!a.staff_viewed && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleMarkViewed(a.id)}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Seen
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {homeLog.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground">🏠 Home Reinforcement Log</p>
          {homeLog.map(h => (
            <div key={h.id} className="flex items-center gap-2 rounded-lg border border-border/30 bg-accent/5 px-3 py-2">
              <Home className="h-3 w-3 text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs">{h.activity}</p>
                <p className="text-[10px] text-muted-foreground">{h.parent_name || 'Parent'} · {new Date(h.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
