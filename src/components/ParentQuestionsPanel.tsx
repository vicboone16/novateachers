/**
 * ParentQuestionsPanel — View and reply to parent questions.
 * Reads from Core: parent_questions, parent_question_replies.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  HelpCircle, MessageCircle, Send, CheckCircle, Clock, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  student_id: string;
  question_text: string;
  status: string;
  created_at: string;
  reply_count?: number;
}

interface Reply {
  id: string;
  body: string;
  author_type: string;
  created_at: string;
}

interface Props {
  studentId: string;
  agencyId: string;
}

export function ParentQuestionsPanel({ studentId, agencyId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('parent_questions' as any)
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(20);
      setQuestions((data || []) as any[]);
    } catch { /* silent */ }
    setLoading(false);
  }, [studentId]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const loadReplies = async (questionId: string) => {
    try {
      const { data } = await supabase
        .from('parent_question_replies' as any)
        .select('*')
        .eq('question_id', questionId)
        .order('created_at', { ascending: true });
      setReplies((data || []) as any[]);
    } catch { /* silent */ }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadReplies(id);
    }
  };

  const sendReply = async () => {
    if (!expandedId || !replyText.trim() || !user) return;
    setSending(true);
    try {
      await supabase
        .from('parent_question_replies' as any)
        .insert({
          question_id: expandedId,
          author_id: user.id,
          author_type: 'staff',
          body: replyText.trim(),
        });

      // Mark as resolved if desired
      await supabase
        .from('parent_questions' as any)
        .update({ status: 'answered', resolved_by: user.id, resolved_at: new Date().toISOString() })
        .eq('id', expandedId);

      toast({ title: 'Reply sent' });
      setReplyText('');
      loadReplies(expandedId);
      loadQuestions();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  if (loading) return null;
  if (questions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold font-heading flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-amber-500" />
        Parent Questions
        <Badge variant="outline" className="text-[9px]">{questions.filter(q => q.status === 'open').length} open</Badge>
      </h3>

      <div className="space-y-2">
        {questions.map(q => (
          <Card key={q.id} className={cn('border-border/40 cursor-pointer transition-all', expandedId === q.id && 'ring-1 ring-primary/30')}>
            <CardContent className="p-3" onClick={() => toggleExpand(q.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm">{q.question_text}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDate(q.created_at)}</p>
                </div>
                <Badge className={cn('text-[9px] shrink-0',
                  q.status === 'open' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-accent/20 text-accent-foreground'
                )}>
                  {q.status === 'open' ? <Clock className="h-2.5 w-2.5 mr-0.5" /> : <CheckCircle className="h-2.5 w-2.5 mr-0.5" />}
                  {q.status}
                </Badge>
              </div>

              {expandedId === q.id && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-3" onClick={e => e.stopPropagation()}>
                  {replies.map(r => (
                    <div key={r.id} className={cn(
                      'rounded-lg px-3 py-2 text-xs',
                      r.author_type === 'staff' ? 'bg-primary/5 ml-4' : 'bg-muted mr-4'
                    )}>
                      <p className="text-[9px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wide">
                        {r.author_type === 'staff' ? 'You' : 'Parent'}
                      </p>
                      <p>{r.body}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type a reply…"
                      className="h-8 text-xs"
                      onKeyDown={e => e.key === 'Enter' && sendReply()}
                    />
                    <Button size="sm" className="h-8 gap-1" onClick={sendReply} disabled={sending || !replyText.trim()}>
                      {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
