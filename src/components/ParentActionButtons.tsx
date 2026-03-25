/**
 * ParentActionButtons — Quick parent engagement actions.
 * Actions: praise_at_home, noticed_too, ask_question, home_followup
 */
import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Heart, Eye, HelpCircle, Home, Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTIONS = [
  { type: 'praise_at_home', label: '👏 Praised at Home', icon: Heart, color: 'text-rose-500', description: 'Let the teacher know you reinforced at home!' },
  { type: 'noticed_too', label: '👀 We Noticed This Too', icon: Eye, color: 'text-blue-500', description: 'Share that you see the same pattern at home.' },
  { type: 'ask_question', label: '❓ Ask a Question', icon: HelpCircle, color: 'text-amber-500', description: 'Ask the teacher about something.' },
  { type: 'home_followup', label: '🏠 Home Follow-Up', icon: Home, color: 'text-green-500', description: 'Log what you did at home to support.' },
];

interface Props {
  studentId: string;
  agencyId: string;
  parentName?: string;
  parentUserId?: string;
  className?: string;
}

export function ParentActionButtons({ studentId, agencyId, parentName, parentUserId, className }: Props) {
  const { toast } = useToast();
  const [activeAction, setActiveAction] = useState<typeof ACTIONS[0] | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recentlySubmitted, setRecentlySubmitted] = useState<Set<string>>(new Set());

  const handleSubmit = async () => {
    if (!activeAction) return;
    setSubmitting(true);
    try {
      const { error } = await cloudSupabase.from('parent_actions').insert({
        student_id: studentId,
        agency_id: agencyId,
        action_type: activeAction.type,
        message: message.trim() || null,
        parent_user_id: parentUserId || null,
        parent_name: parentName || 'Parent',
      });
      if (error) throw error;

      // If it's a home followup, also log to home_reinforcement_log
      if (activeAction.type === 'home_followup' && message.trim()) {
        await cloudSupabase.from('home_reinforcement_log').insert({
          student_id: studentId,
          agency_id: agencyId,
          activity: message.trim(),
          parent_user_id: parentUserId || null,
          parent_name: parentName || 'Parent',
        });
      }

      // Award bonus points for parent engagement (reinforcement feedback loop)
      const bonusPoints = activeAction.type === 'praise_at_home' ? 2
        : activeAction.type === 'home_followup' ? 3
        : activeAction.type === 'noticed_too' ? 1
        : 0;

      if (bonusPoints > 0) {
        // Log parent reinforcement event
        await cloudSupabase.from('parent_reinforcement_events').insert({
          student_id: studentId,
          agency_id: agencyId,
          action_type: activeAction.type,
          bonus_points_awarded: bonusPoints,
          momentum_boost: activeAction.type === 'praise_at_home',
        });
      }

      setRecentlySubmitted(prev => new Set(prev).add(activeAction.type));
      const bonusMsg = bonusPoints > 0 ? ` (+${bonusPoints} bonus points for your child!)` : '';
      toast({ title: '✨ Sent!', description: `Your teacher will see this.${bonusMsg}` });
      setActiveAction(null);
      setMessage('');
    } catch (err: any) {
      toast({ title: 'Could not send', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        💬 Share with Teacher
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(action => {
          const Icon = action.icon;
          const done = recentlySubmitted.has(action.type);
          return (
            <Button
              key={action.type}
              variant="outline"
              className={cn(
                'h-auto py-3 px-3 flex flex-col items-center gap-1.5 text-xs font-medium',
                done && 'border-accent/50 bg-accent/5'
              )}
              onClick={() => { setActiveAction(action); setMessage(''); }}
              disabled={done}
            >
              {done ? <CheckCircle className="h-5 w-5 text-accent" /> : <Icon className={cn('h-5 w-5', action.color)} />}
              <span className="text-center leading-tight">{done ? 'Sent ✓' : action.label}</span>
            </Button>
          );
        })}
      </div>

      <Dialog open={!!activeAction} onOpenChange={open => !open && setActiveAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{activeAction?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{activeAction?.description}</p>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Add a note (optional)…"
            className="min-h-[80px] text-sm"
          />
          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            <Send className="h-4 w-4" /> {submitting ? 'Sending…' : 'Send to Teacher'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
