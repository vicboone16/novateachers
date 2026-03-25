import { useEffect, useRef, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  action_type: string;
  message: string | null;
  parent_name: string | null;
  staff_reply: string | null;
  staff_reply_at: string | null;
  created_at: string;
}

interface Props {
  studentId: string;
}

export function ParentMessageThread({ studentId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentId) return;
    cloudSupabase
      .from('parent_actions')
      .select('id, action_type, message, parent_name, staff_reply, staff_reply_at, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        setMessages((data || []) as Message[]);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
  }, [studentId]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  // Flatten into chat items
  const chatItems: { id: string; sender: 'parent' | 'teacher'; body: string; time: string }[] = [];
  messages.forEach(m => {
    if (m.message) {
      chatItems.push({ id: m.id + '-p', sender: 'parent', body: m.message, time: formatTime(m.created_at) });
    }
    if (m.staff_reply) {
      chatItems.push({ id: m.id + '-t', sender: 'teacher', body: m.staff_reply, time: formatTime(m.staff_reply_at || m.created_at) });
    }
  });

  if (loading) return null;

  if (chatItems.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground">No messages yet. Use the buttons above to start!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3" /> Messages
      </p>
      <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 scroll-smooth">
        {chatItems.map(item => (
          <div
            key={item.id}
            className={cn(
              'flex',
              item.sender === 'parent' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-3.5 py-2.5 space-y-0.5',
                item.sender === 'parent'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              )}
            >
              <p className={cn(
                'text-[10px] font-medium',
                item.sender === 'parent' ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}>
                {item.sender === 'parent' ? 'You' : 'Teacher'}
              </p>
              <p className="text-sm leading-relaxed">{item.body}</p>
              <p className={cn(
                'text-[9px]',
                item.sender === 'parent' ? 'text-primary-foreground/50' : 'text-muted-foreground/60'
              )}>
                {item.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
