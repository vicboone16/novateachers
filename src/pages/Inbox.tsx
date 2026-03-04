import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  CheckCircle2,
  Send,
  ArrowLeft,
  FileText,
  MessageSquare,
  ClipboardCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AttachmentUploader, AttachmentList, uploadAttachments } from '@/components/inbox/InboxAttachments';
import ComposeMessage from '@/components/inbox/ComposeMessage';

interface TeacherMessage {
  id: string;
  agency_id: string;
  thread_id: string;
  parent_id: string | null;
  sender_id: string;
  recipient_id: string;
  message_type: 'note' | 'bip' | 'action_item' | 'document';
  subject: string | null;
  body: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  reviewed_at: string | null;
  status: string;
  client_id: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  note: { label: 'Note', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  bip: { label: 'BIP', icon: FileText, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  action_item: { label: 'Action Item', icon: ClipboardCheck, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  document: { label: 'Document', icon: FileText, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

const STATUS_LABELS: Record<string, string> = {
  sent: 'New',
  read: 'Read',
  reviewed: 'Reviewed',
  action_required: 'Action Required',
  completed: 'Completed',
};

const Inbox = () => {
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { toast } = useToast();

  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<TeacherMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [composeOpen, setComposeOpen] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teacher_messages')
        .select('*')
        .or(tab === 'inbox' ? `recipient_id.eq.${user.id}` : `sender_id.eq.${user.id}`)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const msgs = (data || []) as TeacherMessage[];
      setMessages(msgs);

      // Resolve all user names (senders + recipients)
      const userIds = new Set<string>();
      msgs.forEach(m => { userIds.add(m.sender_id); userIds.add(m.recipient_id); });
      if (userIds.size > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, display_name, email')
            .in('id', Array.from(userIds));
          if (profiles) {
            const map = new Map<string, string>(userNames);
            for (const p of profiles as any[]) {
              map.set(p.id, p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id.slice(0, 8));
            }
            setUserNames(map);
          }
        } catch { /* profiles may not exist */ }
      }
    } catch (err: any) {
      toast({ title: 'Error loading messages', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teacher_messages' }, (payload) => {
        const msg = payload.new as TeacherMessage;
        if (msg.recipient_id === user.id || msg.sender_id === user.id) {
          loadMessages();
          if (selectedThread && msg.thread_id === selectedThread) {
            loadThread(selectedThread);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedThread]);

  const loadThread = async (threadId: string) => {
    setSelectedThread(threadId);
    const { data, error } = await supabase
      .from('teacher_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const threadMsgs = data as TeacherMessage[];
      setThreadMessages(threadMsgs);

      // Resolve names for thread participants
      const threadUserIds = new Set<string>();
      threadMsgs.forEach(m => { threadUserIds.add(m.sender_id); threadUserIds.add(m.recipient_id); });
      const unknownIds = Array.from(threadUserIds).filter(id => !userNames.has(id));
      if (unknownIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, display_name, email')
            .in('id', unknownIds);
          if (profiles) {
            const map = new Map<string, string>(userNames);
            for (const p of profiles as any[]) {
              map.set(p.id, p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id.slice(0, 8));
            }
            setUserNames(map);
          }
        } catch { /* profiles may not exist */ }
      }

      // Mark unread messages as read
      const unread = threadMsgs.filter(m => !m.is_read && m.recipient_id === user?.id);
      if (unread.length > 0) {
        await supabase
          .from('teacher_messages')
          .update({ is_read: true, read_at: new Date().toISOString(), status: 'read' })
          .in('id', unread.map(m => m.id));
        loadMessages();
      }
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedThread || !user || !currentWorkspace) return;
    setSending(true);
    try {
      const rootMsg = threadMessages[0];
      const recipientId = rootMsg.sender_id === user.id ? rootMsg.recipient_id : rootMsg.sender_id;
      const { data: inserted, error } = await supabase.from('teacher_messages').insert({
        agency_id: currentWorkspace.agency_id,
        thread_id: selectedThread,
        parent_id: threadMessages[threadMessages.length - 1].id,
        sender_id: user.id,
        recipient_id: recipientId,
        message_type: 'note',
        subject: rootMsg.subject ? `Re: ${rootMsg.subject}` : null,
        body: replyText.trim(),
      }).select('id').single();
      if (error) throw error;

      // Upload attachments if any
      if (replyFiles.length > 0 && inserted) {
        await uploadAttachments(inserted.id, user.id, replyFiles);
      }

      setReplyText('');
      setReplyFiles([]);
      loadThread(selectedThread);
    } catch (err: any) {
      toast({ title: 'Error sending reply', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleMarkReviewed = async (msgId: string) => {
    try {
      await supabase.from('teacher_messages').update({
        status: 'reviewed',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      }).eq('id', msgId);
      toast({ title: 'Marked as reviewed' });
      if (selectedThread) loadThread(selectedThread);
      loadMessages();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkCompleted = async (msgId: string) => {
    try {
      await supabase.from('teacher_messages').update({ status: 'completed' }).eq('id', msgId);
      toast({ title: 'Marked as completed' });
      if (selectedThread) loadThread(selectedThread);
      loadMessages();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const unreadCount = messages.filter(m => !m.is_read && tab === 'inbox').length;

  if (isSoloMode) {
    return (
      <div className="py-12 text-center">
        <InboxIcon className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h3 className="mt-4 text-lg font-medium">Inbox</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The inbox is available when you're connected to an agency.
        </p>
      </div>
    );
  }

  // Thread detail view
  if (selectedThread) {
    const rootMsg = threadMessages[0];
    const typeConfig = TYPE_CONFIG[rootMsg?.message_type || 'note'];
    const TypeIcon = typeConfig?.icon || Mail;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedThread(null); setThreadMessages([]); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge className={cn('text-xs', typeConfig?.color)}>{typeConfig?.label}</Badge>
              <h3 className="font-semibold">{rootMsg?.subject || 'No subject'}</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {userNames.get(rootMsg?.sender_id) || rootMsg?.sender_id.slice(0, 8)} · {rootMsg && format(new Date(rootMsg.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
          {rootMsg && rootMsg.recipient_id === user?.id && rootMsg.status !== 'reviewed' && rootMsg.status !== 'completed' && (
            <Button size="sm" variant="outline" onClick={() => handleMarkReviewed(rootMsg.id)} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Reviewed
            </Button>
          )}
          {rootMsg && rootMsg.message_type === 'action_item' && rootMsg.status !== 'completed' && (
            <Button size="sm" onClick={() => handleMarkCompleted(rootMsg.id)} className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Complete
            </Button>
          )}
        </div>

        {/* Messages in thread */}
        <div className="space-y-3">
          {threadMessages.map(msg => {
            const parentMsg = msg.parent_id ? threadMessages.find(m => m.id === msg.parent_id) : null;

            const scrollToParent = () => {
              if (!parentMsg) return;
              const el = messageRefs.current.get(parentMsg.id);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHighlightedMsgId(parentMsg.id);
                setTimeout(() => setHighlightedMsgId(null), 1500);
              }
            };

            return (
              <div
                key={msg.id}
                ref={el => { if (el) messageRefs.current.set(msg.id, el); else messageRefs.current.delete(msg.id); }}
              >
                <Card className={cn(
                  msg.sender_id === user?.id ? 'ml-8' : 'mr-8',
                  'transition-all duration-300',
                  highlightedMsgId === msg.id && 'ring-2 ring-primary/50 bg-primary/5'
                )}>
                  <CardContent className="p-4">
                    {parentMsg && (
                      <button
                        type="button"
                        onClick={scrollToParent}
                        className="mb-2 flex w-full items-start gap-2 rounded-md bg-muted/50 p-2 border-l-2 border-muted-foreground/30 hover:bg-muted/80 hover:border-primary/50 transition-colors cursor-pointer text-left"
                      >
                        <ArrowLeft className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground rotate-[135deg]" />
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Replying to {parentMsg.sender_id === user?.id ? 'You' : userNames.get(parentMsg.sender_id) || parentMsg.sender_id.slice(0, 8)}
                          </span>
                          <p className="text-xs text-muted-foreground/70 truncate">{parentMsg.body.slice(0, 100)}</p>
                        </div>
                      </button>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {msg.sender_id === user?.id ? 'You' : userNames.get(msg.sender_id) || msg.sender_id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    <AttachmentList messageId={msg.id} />
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Reply box */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              className="flex-1"
            />
            <Button onClick={handleReply} disabled={sending || !replyText.trim()} className="self-end gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Sending…' : 'Reply'}
            </Button>
          </div>
          <AttachmentUploader files={replyFiles} onFilesChange={setReplyFiles} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading">Inbox</h2>
          <p className="text-sm text-muted-foreground">
            Messages from your supervisors and team
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unreadCount} unread</Badge>
          )}
          <Button onClick={() => setComposeOpen(true)} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Compose
          </Button>
        </div>
      </div>

      <ComposeMessage open={composeOpen} onOpenChange={setComposeOpen} onSent={loadMessages} />

      <Tabs value={tab} onValueChange={v => setTab(v as 'inbox' | 'sent')}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <InboxIcon className="h-3.5 w-3.5" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Sent
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : messages.length === 0 ? (
        <div className="py-12 text-center">
          <MailOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {tab === 'inbox' ? 'No messages yet' : 'No sent messages'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const config = TYPE_CONFIG[msg.message_type] || TYPE_CONFIG.note;
            const Icon = config.icon;
            return (
              <Card
                key={msg.id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-accent/50',
                  !msg.is_read && tab === 'inbox' && 'border-primary/30 bg-primary/5'
                )}
                onClick={() => loadThread(msg.thread_id)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!msg.is_read && tab === 'inbox' && (
                        <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <span className={cn('text-sm truncate', !msg.is_read && tab === 'inbox' && 'font-semibold')}>
                        {msg.subject || 'No subject'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {tab === 'inbox' ? `From: ${userNames.get(msg.sender_id) || msg.sender_id.slice(0, 8)}` : `To: ${userNames.get(msg.recipient_id) || msg.recipient_id.slice(0, 8)}`}
                      {' · '}
                      {msg.body.slice(0, 80)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(msg.created_at), 'MMM d')}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABELS[msg.status] || msg.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Inbox;
