/**
 * ParentTeacherThread — Deeper parent-teacher messaging within parent portal.
 * Creates and reads from parent_actions with threaded teacher replies.
 * Works in both authenticated and token-based contexts.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Heart, Eye, HelpCircle, Home, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreadMessage {
  id: string;
  action_type: string;
  message: string | null;
  parent_name: string | null;
  staff_viewed: boolean;
  staff_reply: string | null;
  staff_reply_at: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, { icon: any; label: string; color: string }> = {
  praise_at_home: { icon: Heart, label: 'Praised at Home', color: 'text-rose-500' },
  noticed_too: { icon: Eye, label: 'We Noticed This Too', color: 'text-blue-500' },
  ask_question: { icon: HelpCircle, label: 'Question', color: 'text-amber-500' },
  home_followup: { icon: Home, label: 'Home Follow-Up', color: 'text-green-500' },
};

interface Props {
  studentId: string;
  agencyId: string;
  parentName?: string;
  isTeacherView?: boolean;
  className?: string;
}

export function ParentTeacherThread({ studentId, agencyId, parentName, isTeacherView = false, className }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    loadMessages();
  }, [studentId]);

  const loadMessages = async () => {
    const { data } = await cloudSupabase
      .from('parent_actions')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(20);
    setMessages((data || []) as any[]);
  };

  const handleTeacherReply = async (actionId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await cloudSupabase
        .from('parent_actions')
        .update({
          staff_viewed: true,
          staff_viewed_at: new Date().toISOString(),
          staff_reply: replyText.trim(),
          staff_reply_at: new Date().toISOString(),
        })
        .eq('id', actionId);
      setReplyText('');
      setReplyingTo(null);
      loadMessages();
    } catch { /* silent */ }
    setSending(false);
  };

  if (messages.length === 0) {
    return (
      <div className={cn('text-center py-4', className)}>
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No messages yet between parent and teacher.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="section-header">
        <MessageSquare className="h-3 w-3" /> {isTeacherView ? 'Parent Messages' : 'Message History'}
      </p>
      {messages.map(msg => {
        const config = ACTION_ICONS[msg.action_type] || ACTION_ICONS.praise_at_home;
        const Icon = config.icon;
        return (
          <Card key={msg.id} className={cn(
            'border-border/40',
            !msg.staff_viewed && isTeacherView && 'ring-1 ring-primary/20'
          )}>
            <CardContent className="p-3 space-y-2">
              {/* Parent message */}
              <div className="flex items-start gap-2">
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold">{config.label}</p>
                    <span className="text-[10px] text-muted-foreground">· {msg.parent_name || 'Parent'}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {msg.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 bg-muted/50 rounded-lg px-2.5 py-1.5">{msg.message}</p>
                  )}
                </div>
              </div>

              {/* Teacher reply */}
              {msg.staff_reply && (
                <div className="ml-6 bg-primary/5 rounded-lg px-3 py-2 border border-primary/10">
                  <p className="text-[10px] text-primary font-semibold mb-0.5">Teacher Reply</p>
                  <p className="text-xs text-foreground/80">{msg.staff_reply}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {msg.staff_reply_at && new Date(msg.staff_reply_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {/* Reply input for teachers */}
              {isTeacherView && !msg.staff_reply && (
                <>
                  {replyingTo === msg.id ? (
                    <div className="ml-6 flex gap-2">
                      <Textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Reply to parent…"
                        className="min-h-[60px] text-xs"
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleTeacherReply(msg.id)} disabled={sending}>
                          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setReplyingTo(null); setReplyText(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-6 h-6 text-[10px] gap-1 text-primary"
                      onClick={() => setReplyingTo(msg.id)}
                    >
                      <Send className="h-2.5 w-2.5" /> Reply
                    </Button>
                  )}
                </>
              )}

              {/* Read status */}
              {!isTeacherView && msg.staff_viewed && !msg.staff_reply && (
                <div className="ml-6">
                  <Badge variant="outline" className="text-[9px] gap-0.5">
                    <CheckCircle className="h-2 w-2" /> Seen by teacher
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
