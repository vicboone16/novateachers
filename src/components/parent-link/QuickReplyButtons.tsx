import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPLIES = [
  { type: 'noticed_too', emoji: '👍', label: 'We noticed this too' },
  { type: 'home_followup', emoji: '🏡', label: "We'll reinforce at home" },
  { type: 'ask_question', emoji: '❓', label: 'Can you tell me more?' },
  { type: 'praise_at_home', emoji: '🎉', label: 'Great job!' },
];

interface Props {
  studentId: string;
  agencyId: string;
  parentName?: string;
}

export function QuickReplyButtons({ studentId, agencyId, parentName }: Props) {
  const { toast } = useToast();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const handleSend = async (type: string, label: string) => {
    setSending(type);
    try {
      const { error } = await cloudSupabase.from('parent_actions').insert({
        student_id: studentId,
        agency_id: agencyId,
        action_type: type,
        message: label,
        parent_name: parentName || 'Parent',
      });
      if (error) throw error;
      setSent(prev => new Set(prev).add(type));
      toast({ title: '✨ Sent!', description: 'Your teacher will see this.' });
    } catch (err: any) {
      toast({ title: 'Could not send', description: err.message, variant: 'destructive' });
    }
    setSending(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        💬 Want to respond quickly?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {REPLIES.map(r => {
          const isSent = sent.has(r.type);
          const isLoading = sending === r.type;
          return (
            <Button
              key={r.type}
              variant="outline"
              disabled={isSent || isLoading}
              onClick={() => handleSend(r.type, r.label)}
              className={cn(
                'h-auto py-3 px-3 rounded-2xl text-xs font-medium flex flex-col items-center gap-1.5 transition-all',
                isSent && 'border-accent/40 bg-accent/5 text-accent-foreground',
                !isSent && 'hover:bg-primary/5 hover:border-primary/30'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isSent ? (
                <CheckCircle className="h-5 w-5 text-accent" />
              ) : (
                <span className="text-lg">{r.emoji}</span>
              )}
              <span className="text-center leading-tight">
                {isSent ? 'Sent ✓' : r.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
