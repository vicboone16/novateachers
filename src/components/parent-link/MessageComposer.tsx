import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  studentId: string;
  agencyId: string;
  parentName?: string;
  onSent?: () => void;
}

export function MessageComposer({ studentId, agencyId, parentName, onSent }: Props) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const { error } = await cloudSupabase.from('parent_actions').insert({
        student_id: studentId,
        agency_id: agencyId,
        action_type: 'message',
        message: body.trim(),
        parent_name: parentName || 'Parent',
      });
      if (error) throw error;
      setBody('');
      toast({ title: 'Message sent!' });
      onSent?.();
    } catch (err: any) {
      toast({ title: 'Could not send', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <div className="flex gap-2 items-end">
      <Textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Send a quick update or question…"
        className="min-h-[44px] max-h-[120px] text-sm rounded-2xl resize-none flex-1"
        rows={1}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        }}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={sending || !body.trim()}
        className="h-11 w-11 rounded-full shrink-0"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
