/**
 * Threads — Slack-like threaded messaging page.
 * Reads/writes to Core-owned threads, messages, reactions, mentions tables.
 * Falls back to local teacher_messages if Core tables unavailable.
 * Shows presence context in thread header via ThreadPresenceHeader.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { useToast } from '@/hooks/use-toast';
import { ThreadPresenceHeader } from '@/components/ThreadPresenceHeader';
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
  Users, User, Smile, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Thread {
  id: string;
  agency_id: string;
  classroom_id: string | null;
  thread_type: string;
  title: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  parent_id: string | null;
  body: string;
  message_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

const THREAD_TYPES: { value: string; label: string; icon: typeof Hash }[] = [
  { value: 'team', label: 'Team', icon: Users },
  { value: 'teacher_only', label: 'Teacher Only', icon: Lock },
  { value: 'aide', label: 'Aide / Coverage', icon: Users },
  { value: 'student', label: 'Student-Specific', icon: User },
  { value: 'one_to_one', label: 'Direct Message', icon: MessageCircle },
  { value: 'announcement', label: 'Announcement', icon: Hash },
];

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '👀', '✅', '🙏'];

const Threads = () => {
  const { user, session } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { toast } = useToast();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('team');
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [useLocalMode, setUseLocalMode] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const agencyId = currentWorkspace?.agency_id || '';

  // ── Load threads ──
  const loadThreads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('threads' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setThreads((data || []) as any as Thread[]);
    } catch {
      // Fallback: use teacher_messages as thread source
      console.log('[Threads] Core threads unavailable, using local message threads');
      setUseLocalMode(true);
      try {
        const { data: msgs } = await cloudSupabase
          .from('teacher_messages')
          .select('*')
          .eq('agency_id', agencyId)
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(50);
        // Group messages by thread_id or subject into virtual threads
        const threadMap = new Map<string, Thread>();
        for (const m of (msgs || []) as any[]) {
          const tid = m.thread_id || m.id;
          if (!threadMap.has(tid)) {
            threadMap.set(tid, {
              id: tid,
              agency_id: agencyId,
              classroom_id: null,
              thread_type: 'team',
              title: m.subject || 'Conversation',
              is_private: false,
              created_by: m.sender_id,
              created_at: m.created_at,
              updated_at: m.created_at,
            });
          }
        }
        setThreads(Array.from(threadMap.values()));
      } catch { setThreads([]); }
    }
    setLoading(false);
  }, [user, agencyId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // ── Realtime on messages ──
  useEffect(() => {
    const table = useLocalMode ? 'teacher_messages' : 'messages';
    const client = useLocalMode ? cloudSupabase : supabase;
    const channel = client
      .channel('thread-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, () => {
        if (activeThread) loadMessages(activeThread.id);
        loadThreads();
      })
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [activeThread, loadThreads, useLocalMode]);

  // ── Resolve user names ──
  const resolveNames = useCallback(async (ids: string[]) => {
    const unknown = ids.filter(id => !userNames.has(id));
    if (unknown.length === 0) return;
    const resolved = await resolveDisplayNames(unknown, session?.access_token);
    setUserNames(prev => {
      const m = new Map(prev);
      resolved.forEach((n, id) => m.set(id, n));
      return m;
    });
  }, [userNames, session?.access_token]);

  // ── Load messages for a thread ──
  const loadMessages = async (threadId: string) => {
    try {
      if (useLocalMode) {
        // Load from teacher_messages
        const { data } = await cloudSupabase
          .from('teacher_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });
        const msgs = (data || []).map((m: any) => ({
          id: m.id,
          thread_id: m.thread_id || threadId,
          sender_id: m.sender_id,
          parent_id: m.parent_id,
          body: m.body,
          message_type: m.message_type || 'text',
          metadata: m.metadata || {},
          created_at: m.created_at,
        })) as Message[];
        setMessages(msgs);
        resolveNames(msgs.map(m => m.sender_id));
        setReactions([]);
      } else {
        const { data } = await supabase
          .from('messages' as any)
          .select('*')
          .eq('thread_id', threadId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });
        const msgs = (data || []) as any as Message[];
        setMessages(msgs);
        resolveNames(msgs.map(m => m.sender_id));

        const msgIds = msgs.map(m => m.id);
        if (msgIds.length > 0) {
          const { data: rxns } = await supabase
            .from('message_reactions' as any)
            .select('*')
            .in('message_id', msgIds);
          setReactions((rxns || []) as any as Reaction[]);
        }
      }
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { /* silent */ }
  };

  const openThread = (thread: Thread) => {
    setActiveThread(thread);
    loadMessages(thread.id);
  };

  // ── Send message ──
  const handleSend = async () => {
    if (!msgText.trim() || !activeThread || !user) return;
    setSending(true);
    try {
      if (useLocalMode) {
        const { error } = await cloudSupabase
          .from('teacher_messages')
          .insert({
            agency_id: agencyId,
            sender_id: user.id,
            recipient_id: user.id, // self-thread for now
            body: msgText.trim(),
            thread_id: activeThread.id,
            message_type: 'note',
            subject: activeThread.title,
            metadata: { app_source: 'beacon_thread' },
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('messages' as any)
          .insert({
            thread_id: activeThread.id,
            sender_id: user.id,
            body: msgText.trim(),
            message_type: 'text',
            metadata: { app_source: 'beacon' },
          });
        if (error) throw error;
      }
      setMsgText('');
      loadMessages(activeThread.id);
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
      if (useLocalMode) {
        // Create a "thread" via teacher_messages with a thread_id = new uuid
        const threadId = crypto.randomUUID();
        const { error } = await cloudSupabase
          .from('teacher_messages')
          .insert({
            id: threadId,
            agency_id: agencyId,
            sender_id: user.id,
            recipient_id: user.id,
            body: `Thread created: ${newTitle.trim()}`,
            thread_id: threadId,
            message_type: 'note',
            subject: newTitle.trim(),
            metadata: { app_source: 'beacon_thread', thread_type: newType },
          });
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('threads' as any)
          .insert({
            agency_id: agencyId,
            thread_type: newType,
            title: newTitle.trim(),
            is_private: newType === 'teacher_only' || newType === 'one_to_one',
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;

        await supabase
          .from('thread_members' as any)
          .insert({ thread_id: (data as any).id, user_id: user.id, role: 'admin' });
      }

      setCreateOpen(false);
      setNewTitle('');
      setNewType('team');
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
      await supabase.from('message_reactions' as any).delete().eq('id', existing.id);
      setReactions(prev => prev.filter(r => r.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('message_reactions' as any)
        .insert({ message_id: messageId, user_id: user.id, emoji })
        .select()
        .single();
      if (data) setReactions(prev => [...prev, data as any as Reaction]);
    }
  };

  if (isSoloMode) {
    return (
      <div className="py-12 text-center">
        <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h3 className="mt-4 text-lg font-medium">Threads</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Threads are available when connected to an agency.
        </p>
      </div>
    );
  }

  // ── Thread detail view ──
  if (activeThread) {
    const typeConfig = THREAD_TYPES.find(t => t.value === activeThread.thread_type);
    const TypeIcon = typeConfig?.icon || Hash;

    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border/40">
          <Button variant="ghost" size="icon" onClick={() => { setActiveThread(null); setMessages([]); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <TypeIcon className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{activeThread.title || 'Untitled'}</h3>
            <p className="text-xs text-muted-foreground">{typeConfig?.label} thread</p>
          </div>
          {activeThread.is_private && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {messages.map(msg => {
            const isMine = msg.sender_id === user?.id;
            const msgReactions = reactions.filter(r => r.message_id === msg.id);
            const reactionCounts = new Map<string, number>();
            msgReactions.forEach(r => reactionCounts.set(r.emoji, (reactionCounts.get(r.emoji) || 0) + 1));

            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5', isMine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {!isMine && (
                    <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                      {userNames.get(msg.sender_id) || msg.sender_id.slice(0, 8)}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <p className={cn('text-[10px] mt-1', isMine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </p>

                  {/* Reactions */}
                  {reactionCounts.size > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Array.from(reactionCounts.entries()).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={cn(
                            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border transition-colors',
                            msgReactions.some(r => r.emoji === emoji && r.user_id === user?.id)
                              ? 'border-primary/50 bg-primary/10'
                              : 'border-border/50 bg-background/50'
                          )}
                        >
                          {emoji} {count > 1 && <span className="text-[10px]">{count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick react row */}
                  <div className="flex gap-0.5 mt-1 opacity-0 hover:opacity-100 transition-opacity">
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className="text-xs hover:scale-125 transition-transform p-0.5"
                      >
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
        <div className="flex gap-2 pt-3 border-t border-border/40">
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
  }

  // ── Thread list ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight font-heading">Threads</h2>
          <p className="text-xs text-muted-foreground">Classroom team conversations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New Thread
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : threads.length === 0 ? (
        <div className="py-12 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No threads yet. Start one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(thread => {
            const tc = THREAD_TYPES.find(t => t.value === thread.thread_type);
            const TIcon = tc?.icon || Hash;
            return (
              <Card
                key={thread.id}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => openThread(thread)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <TIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{thread.title || 'Untitled'}</p>
                      {thread.is_private && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tc?.label} · {format(new Date(thread.updated_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Thread Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">New Thread</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Thread name…"
            />
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THREAD_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <Button onClick={handleCreateThread} disabled={!newTitle.trim()} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create Thread
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Threads;
