/**
 * BeaconThreadView — iMessage-style conversation view for parent SMS threads.
 * Staff messages right-aligned, parent SMS replies left-aligned.
 * Shows delivery status, severity indicators, and "via SMS" labels.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Send, Loader2, Phone, MessageCircle, CheckCheck, Check, X,
  AlertTriangle, ShieldAlert, Clock, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface BeaconMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  message_type: string;
  channel: string;
  direction: string;
  severity: string | null;
  delivery_status: string | null;
  sms_from_number: string | null;
  sms_to_number: string | null;
  pingram_tracking_id: string | null;
  created_at: string;
  metadata: Record<string, any>;
  parent_id: string | null;
}

interface ThreadInfo {
  id: string;
  title: string | null;
  severity: string | null;
  sms_enabled: boolean;
  parent_phone: string | null;
  parent_sms_opted_in: boolean;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  low: { label: 'Low', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: MessageCircle },
  medium: { label: 'Medium', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: AlertTriangle },
  high: { label: 'High', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: AlertTriangle },
  critical: { label: 'Critical', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: ShieldAlert },
};

const DELIVERY_ICONS: Record<string, { icon: typeof Check; label: string; className: string }> = {
  pending: { icon: Clock, label: 'Sending…', className: 'text-muted-foreground' },
  sent: { icon: Check, label: 'Sent', className: 'text-muted-foreground' },
  delivered: { icon: CheckCheck, label: 'Delivered', className: 'text-primary' },
  failed: { icon: X, label: 'Failed', className: 'text-destructive' },
};

interface Props {
  thread: ThreadInfo;
  onBack?: () => void;
  className?: string;
}

export function BeaconThreadView({ thread, onBack, className }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<BeaconMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendViaSms, setSendViaSms] = useState(false);
  const [severity, setSeverity] = useState<string>(thread.severity || '');
  const msgEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  // Load messages
  const loadMessages = useCallback(async () => {
    const { data } = await cloudSupabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', thread.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    setMessages((data || []) as BeaconMessage[]);
    setLoading(false);
    scrollToBottom();
  }, [thread.id, scrollToBottom]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = cloudSupabase
      .channel(`beacon-thread-${thread.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'thread_messages',
        filter: `thread_id=eq.${thread.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new as BeaconMessage]);
          scrollToBottom();
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m =>
            m.id === (payload.new as BeaconMessage).id ? (payload.new as BeaconMessage) : m
          ));
        }
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [thread.id, scrollToBottom]);

  // Send message
  const handleSend = async () => {
    if (!msgText.trim() || !user) return;
    setSending(true);

    try {
      if (sendViaSms && thread.parent_phone && thread.parent_sms_opted_in) {
        // Send via SMS edge function
        const { data, error } = await cloudSupabase.functions.invoke('send-beacon-sms', {
          body: {
            thread_id: thread.id,
            message_text: msgText.trim(),
            phone_number: thread.parent_phone,
            severity: severity || null,
            notification_type: 'beacon_sms',
          },
        });
        if (error) throw error;
        if (data && !data.ok) throw new Error(data.error);
      } else {
        // Save as in-app message
        const { error } = await cloudSupabase
          .from('thread_messages')
          .insert({
            thread_id: thread.id,
            sender_id: user.id,
            body: msgText.trim(),
            message_type: 'text',
            channel: 'in_app',
            direction: 'outbound',
            severity: severity || null,
            metadata: { app_source: 'beacon' },
          });
        if (error) throw error;
      }
      setMsgText('');
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const severityConfig = thread.severity ? SEVERITY_CONFIG[thread.severity] : null;
  const SeverityIcon = severityConfig?.icon || MessageCircle;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Thread header with severity */}
      <div className="px-4 py-3 border-b border-border/40 bg-card/30">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{thread.title || 'Conversation'}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {thread.parent_phone && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Phone className="h-2.5 w-2.5" /> {thread.parent_phone}
                </span>
              )}
              {thread.parent_sms_opted_in && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">SMS Active</Badge>
              )}
            </div>
          </div>
          {severityConfig && (
            <Badge className={cn('text-[10px] gap-1', severityConfig.color)}>
              <SeverityIcon className="h-3 w-3" />
              {severityConfig.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages — iMessage layout */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No messages yet.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isInbound = msg.direction === 'inbound';
            const isSystem = msg.message_type === 'system';
            const isSms = msg.channel === 'sms';
            const deliveryInfo = msg.delivery_status ? DELIVERY_ICONS[msg.delivery_status] : null;
            const DeliveryIcon = deliveryInfo?.icon;
            const msgSeverity = msg.severity ? SEVERITY_CONFIG[msg.severity] : null;

            // Show date separator
            const showDate = i === 0 || (
              format(new Date(msg.created_at), 'yyyy-MM-dd') !==
              format(new Date(messages[i - 1].created_at), 'yyyy-MM-dd')
            );

            if (isSystem) {
              return (
                <div key={msg.id}>
                  {showDate && <DateSeparator date={msg.created_at} />}
                  <div className="flex justify-center py-1">
                    <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
                      {msg.body}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id}>
                {showDate && <DateSeparator date={msg.created_at} />}
                <div className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 relative',
                    isInbound
                      ? 'bg-muted rounded-bl-md'
                      : isSms
                        ? 'bg-green-600 text-white rounded-br-md'
                        : 'bg-primary text-primary-foreground rounded-br-md',
                    msgSeverity && !isInbound && 'ring-1 ring-offset-1',
                    msg.severity === 'critical' && !isInbound && 'ring-destructive',
                    msg.severity === 'high' && !isInbound && 'ring-orange-500',
                  )}>
                    {/* Sender label for inbound */}
                    {isInbound && (
                      <p className="text-[10px] font-semibold mb-0.5 text-foreground/70">
                        {msg.sms_from_number ? `Parent (${msg.sms_from_number})` : 'Parent'}
                      </p>
                    )}

                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>

                    {/* Footer: time + channel + delivery */}
                    <div className={cn(
                      'flex items-center gap-1.5 mt-1',
                      isInbound ? 'text-muted-foreground' : isSms ? 'text-white/60' : 'text-primary-foreground/60'
                    )}>
                      <span className="text-[10px]">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </span>
                      {isSms && (
                        <Badge variant="outline" className={cn(
                          'text-[8px] h-3.5 px-1 border-current/20',
                          isInbound ? '' : isSms ? 'text-white/70 border-white/20' : ''
                        )}>
                          {isInbound ? 'via SMS' : 'SMS'}
                        </Badge>
                      )}
                      {!isInbound && deliveryInfo && DeliveryIcon && (
                        <DeliveryIcon className={cn('h-3 w-3', 
                          msg.delivery_status === 'failed' ? 'text-red-300' :
                          msg.delivery_status === 'delivered' ? (isSms ? 'text-white/80' : 'text-primary-foreground/80') :
                          'opacity-50'
                        )} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={msgEndRef} />
      </div>

      {/* Compose area */}
      <div className="border-t border-border/40 bg-card/30 p-3 space-y-2">
        {/* SMS toggle + severity selector */}
        {thread.parent_phone && thread.parent_sms_opted_in && (
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => setSendViaSms(!sendViaSms)}
              className={cn(
                'flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors',
                sendViaSms
                  ? 'bg-green-600/10 text-green-600 border-green-600/20'
                  : 'bg-muted text-muted-foreground border-border/40'
              )}
            >
              <Phone className="h-3 w-3" />
              {sendViaSms ? 'Sending as SMS' : 'Send as SMS'}
            </button>

            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-6 w-28 text-[10px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">No severity</SelectItem>
                <SelectItem value="low" className="text-xs">🔵 Low</SelectItem>
                <SelectItem value="medium" className="text-xs">🟡 Medium</SelectItem>
                <SelectItem value="high" className="text-xs">🟠 High</SelectItem>
                <SelectItem value="critical" className="text-xs">🔴 Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder={sendViaSms ? 'Type SMS message…' : 'Type a message…'}
            rows={1}
            className="flex-1 min-h-[40px] resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !msgText.trim()}
            size="icon"
            className={cn('shrink-0', sendViaSms && 'bg-green-600 hover:bg-green-700')}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border/40" />
      <span className="text-[10px] text-muted-foreground font-medium">
        {format(new Date(date), 'MMM d, yyyy')}
      </span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}
