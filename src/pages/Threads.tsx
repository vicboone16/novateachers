/**
 * Threads — Slack-style threaded messaging with responsive sidebar layout.
 * Uses local Cloud tables: threads, thread_messages, thread_members, thread_message_reactions.
 * Who's Here panel integrated at top. Auto-creates agency + classroom threads.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { WhosHerePanel } from '@/components/WhosHerePanel';
import {
  ensureAgencyThread, ensureAgencyFeedThread, backfillClassroomThreads, createDMThread,
  type ThreadRow, type ThreadMessageRow, type ThreadReactionRow,
} from '@/lib/thread-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  MessageCircle, Plus, ArrowLeft, Send, Hash, Lock,
  Users, User, Smile, Loader2, School, Heart, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const THREAD_TYPE_ICONS: Record<string, typeof Hash> = {
  agency: Hash, classroom: School, dm: User, group: Users, parent: Heart, team: Users,
};

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '👀', '✅', '🙏'];

const Threads = () => {
  const { user, session } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ThreadRow | null>(null);
  const [messages, setMessages] = useState<ThreadMessageRow[]>([]);
  const [reactions, setReactions] = useState<ThreadReactionRow[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('group');
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [initialized, setInitialized] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const agencyId = currentWorkspace?.agency_id || '';

  // ── Initialize: ensure agency thread + backfill classroom threads ──
  useEffect(() => {
    if (!user || !agencyId || initialized) return;
    const init = async () => {
      await ensureAgencyThread(agencyId, user.id);
      await backfillClassroomThreads(agencyId, user.id);
      setInitialized(true);
    };
    init();
  }, [user, agencyId, initialized]);

  // ── Load threads ──
  const loadThreads = useCallback(async () => {
    if (!user || !agencyId) return;
    setLoading(true);
    try {
      const { data, error } = await cloudSupabase
        .from('threads')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      setThreads((data || []) as ThreadRow[]);
    } catch (err: any) {
      console.warn('[Threads] load error:', err);
      setThreads([]);
    }
    setLoading(false);
  }, [user, agencyId]);

  useEffect(() => { if (initialized) loadThreads(); }, [initialized, loadThreads]);

  // ── Realtime on messages ──
  useEffect(() => {
    const channel = cloudSupabase
      .channel('thread-messages-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thread_messages' }, (payload) => {
        const newMsg = payload.new as ThreadMessageRow;
        if (activeThread && newMsg.thread_id === activeThread.id) {
          setMessages(prev => [...prev, newMsg]);
          resolveNames([newMsg.sender_id]);
          setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        loadThreads();
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [activeThread, loadThreads]);

  // ── Resolve user names ──
  const resolveNames = useCallback(async (ids: string[]) => {
    const unknown = ids.filter(id => !userNames.has(id));
    if (unknown.length === 0) return;
    try {
      const resolved = await resolveDisplayNames(unknown, session?.access_token);
      setUserNames(prev => {
        const m = new Map(prev);
        resolved.forEach((n, id) => m.set(id, n));
        return m;
      });
    } catch { /* silent */ }
  }, [userNames, session?.access_token]);

  // ── Load messages ──
  const loadMessages = async (threadId: string) => {
    try {
      const { data } = await cloudSupabase
        .from('thread_messages')
        .select('*')
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      const msgs = (data || []) as ThreadMessageRow[];
      setMessages(msgs);
      resolveNames(msgs.map(m => m.sender_id));

      // Load reactions
      const msgIds = msgs.map(m => m.id);
      if (msgIds.length > 0) {
        const { data: rxns } = await cloudSupabase
          .from('thread_message_reactions')
          .select('*')
          .in('message_id', msgIds);
        setReactions((rxns || []) as ThreadReactionRow[]);
      } else {
        setReactions([]);
      }

      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { /* silent */ }
  };

  const openThread = (thread: ThreadRow) => {
    setActiveThread(thread);
    loadMessages(thread.id);
  };

  // ── Send message ──
  const handleSend = async () => {
    if (!msgText.trim() || !activeThread || !user) return;
    setSending(true);
    try {
      const { error } = await cloudSupabase
        .from('thread_messages')
        .insert({
          thread_id: activeThread.id,
          sender_id: user.id,
          body: msgText.trim(),
          message_type: 'text',
          metadata: { app_source: 'beacon' },
        });
      if (error) throw error;
      setMsgText('');
      // Realtime will add the message
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // ── Create thread ──
  const handleCreateThread = async () => {
    if (!newTitle.trim() || !user) return;
    try {
      const { data, error } = await cloudSupabase
        .from('threads')
        .insert({
          agency_id: agencyId,
          thread_type: newType,
          title: newTitle.trim(),
          is_private: newType === 'dm' || newType === 'parent',
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Add creator as member
      if (data) {
        await cloudSupabase.from('thread_members').insert({
          thread_id: data.id,
          user_id: user.id,
          role: 'admin',
        });
      }

      setCreateOpen(false);
      setNewTitle('');
      setNewType('group');
      loadThreads();
      toast({ title: 'Thread created' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Toggle reaction ──
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await cloudSupabase.from('thread_message_reactions').delete().eq('id', existing.id);
      setReactions(prev => prev.filter(r => r.id !== existing.id));
    } else {
      const { data } = await cloudSupabase
        .from('thread_message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
        .select()
        .single();
      if (data) setReactions(prev => [...prev, data as ThreadReactionRow]);
    }
  };

  if (isSoloMode) {
    return (
      <div className="py-12 text-center">
        <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h3 className="mt-4 text-lg font-medium">Threads</h3>
        <p className="mt-1 text-sm text-muted-foreground">Threads are available when connected to an agency.</p>
      </div>
    );
  }

  // ── Group threads by type ──
  const agencyThreads = threads.filter(t => t.thread_type === 'agency');
  const classroomThreads = threads.filter(t => t.thread_type === 'classroom');
  const dmThreads = threads.filter(t => t.thread_type === 'dm');
  const groupThreads = threads.filter(t => t.thread_type === 'group' || t.thread_type === 'team');
  const parentThreads = threads.filter(t => t.thread_type === 'parent');

  // ── Sidebar ──
  const ThreadSidebar = () => (
    <div className={cn(
      'flex flex-col border-r border-border/40 bg-card/50',
      isMobile ? 'w-full' : 'w-64 shrink-0'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        <h2 className="text-sm font-bold font-heading">Threads</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Who's Here (compact) */}
      <div className="px-3 py-2 border-b border-border/40">
        <WhosHerePanel agencyId={agencyId} variant="strip" />
      </div>

      {/* Thread groups */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-1">
            <ThreadGroup label="Agency" threads={agencyThreads} onSelect={openThread} activeId={activeThread?.id} />
            <ThreadGroup label="Classrooms" threads={classroomThreads} onSelect={openThread} activeId={activeThread?.id} />
            <ThreadGroup label="Direct Messages" threads={dmThreads} onSelect={openThread} activeId={activeThread?.id} />
            <ThreadGroup label="Groups" threads={groupThreads} onSelect={openThread} activeId={activeThread?.id} />
            {parentThreads.length > 0 && (
              <ThreadGroup label="Parents" threads={parentThreads} onSelect={openThread} activeId={activeThread?.id} />
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Message view ──
  const MessageView = () => {
    if (!activeThread) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Select a thread to start messaging</p>
          </div>
        </div>
      );
    }

    const TypeIcon = THREAD_TYPE_ICONS[activeThread.thread_type] || Hash;

    return (
      <div className="flex-1 flex flex-col min-w-0">
        {/* Thread header */}
        <div className="px-4 py-3 border-b border-border/40 bg-card/30">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setActiveThread(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{activeThread.title || 'Untitled'}</h3>
              <p className="text-[10px] text-muted-foreground capitalize">{activeThread.thread_type} thread</p>
            </div>
            {activeThread.is_private && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          </div>

          {/* Who's Here strip in thread */}
          <WhosHerePanel
            agencyId={agencyId}
            classroomId={activeThread.classroom_id}
            variant="strip"
            onRequestHelp={(staffIds) => {
              setMsgText('🔔 Requesting support — anyone available?');
            }}
            onNotifyRoom={(staffIds) => {
              setMsgText(`📢 Room notification: `);
            }}
          />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.map(msg => {
            const isMine = msg.sender_id === user?.id;
            const isSystem = msg.message_type === 'system';
            const msgReactions = reactions.filter(r => r.message_id === msg.id);
            const reactionCounts = new Map<string, number>();
            msgReactions.forEach(r => reactionCounts.set(r.emoji, (reactionCounts.get(r.emoji) || 0) + 1));

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center py-1">
                  <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1">{msg.body}</p>
                </div>
              );
            }

            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5', isMine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {!isMine && (
                    <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                      {userNames.get(msg.sender_id) || 'Staff'}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <p className={cn('text-[10px] mt-1', isMine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </p>

                  {reactionCounts.size > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Array.from(reactionCounts.entries()).map(([emoji, count]) => (
                        <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                          className={cn(
                            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border transition-colors',
                            msgReactions.some(r => r.emoji === emoji && r.user_id === user?.id)
                              ? 'border-primary/50 bg-primary/10' : 'border-border/50 bg-background/50'
                          )}>
                          {emoji} {count > 1 && <span className="text-[10px]">{count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-0.5 mt-1 opacity-0 hover:opacity-100 transition-opacity">
                    {QUICK_EMOJIS.map(emoji => (
                      <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                        className="text-xs hover:scale-125 transition-transform p-0.5">
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>

        {/* Compose */}
        <div className="flex gap-2 px-4 py-3 border-t border-border/40 bg-card/30">
          <Textarea
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 min-h-[40px] resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button onClick={handleSend} disabled={sending || !msgText.trim()} size="icon" className="shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  };

  // ── Responsive layout ──
  // Mobile: show sidebar OR messages, not both
  // Desktop: sidebar + messages side by side
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-12rem)]">
        {activeThread ? <MessageView /> : <ThreadSidebar />}

        {/* Create Thread Dialog */}
        <CreateThreadDialog
          open={createOpen} onOpenChange={setCreateOpen}
          title={newTitle} onTitleChange={setNewTitle}
          type={newType} onTypeChange={setNewType}
          onCreate={handleCreateThread}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-xl border border-border/40 overflow-hidden bg-background">
      <ThreadSidebar />
      <MessageView />

      <CreateThreadDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title={newTitle} onTitleChange={setNewTitle}
        type={newType} onTypeChange={setNewType}
        onCreate={handleCreateThread}
      />
    </div>
  );
};

export default Threads;

// ── Thread Group Component ──
function ThreadGroup({ label, threads, onSelect, activeId }: {
  label: string;
  threads: ThreadRow[];
  onSelect: (t: ThreadRow) => void;
  activeId?: string;
}) {
  if (threads.length === 0) return null;

  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {threads.map(thread => {
        const Icon = THREAD_TYPE_ICONS[thread.thread_type] || Hash;
        const isActive = thread.id === activeId;
        return (
          <button key={thread.id} onClick={() => onSelect(thread)}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 text-left transition-colors text-sm',
              isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted/50'
            )}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-xs">{thread.title || 'Untitled'}</span>
            {thread.is_private && <Lock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
            {thread.last_message_preview && (
              <span className="text-[9px] text-muted-foreground truncate max-w-[60px] hidden sm:inline">
                {thread.last_message_preview}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Create Thread Dialog ──
function CreateThreadDialog({ open, onOpenChange, title, onTitleChange, type, onTypeChange, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; onTitleChange: (v: string) => void;
  type: string; onTypeChange: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">New Thread</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={title} onChange={e => onTitleChange(e.target.value)} placeholder="Thread name…" />
          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="group">Group</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="dm">Direct Message</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex justify-end">
            <Button onClick={onCreate} disabled={!title.trim()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Thread
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
