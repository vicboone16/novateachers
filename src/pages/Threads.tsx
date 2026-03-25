/**
 * Threads — Slack-style threaded messaging with responsive sidebar layout.
 * Thread types: Channel (public/private), DM, Parent.
 * Who's Here panel pinned at top. Status update available.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { WhosHerePanel } from '@/components/WhosHerePanel';
import { StaffActionSheet } from '@/components/StaffActionSheet';
import { PRESENCE_STATUS_MAP, type PresenceStatus } from '@/components/StaffPresencePanel';
import {
  ensureAgencyThread, ensureAgencyFeedThread, backfillClassroomThreads, createDMThread,
  type ThreadRow, type ThreadMessageRow, type ThreadReactionRow,
} from '@/lib/thread-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  MessageCircle, Plus, ArrowLeft, Send, Hash, Lock,
  Users, User, Smile, Loader2, Heart, ChevronRight, ChevronDown, ChevronUp,
  MapPin, MoreVertical, Pencil, Globe, LockKeyhole, Users2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const THREAD_TYPE_ICONS: Record<string, typeof Hash> = {
  agency: Hash, classroom: Hash, dm: User, group: Hash, parent: Heart, team: Hash, channel: Hash,
};

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '👀', '✅', '🙏'];

/** Map old types to display categories */
function getThreadCategory(t: ThreadRow): 'channel' | 'dm' | 'parent' {
  if (t.thread_type === 'dm') return 'dm';
  if (t.thread_type === 'parent') return 'parent';
  return 'channel';
}

/** Display label for threads */
function getThreadDisplayTitle(t: ThreadRow): string {
  if (t.thread_type === 'agency') return '📢 Staff Feed';
  if (t.title === '#staff-feed') return '📢 Staff Feed';
  return t.title || 'Untitled';
}

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
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({}); // threadId -> last_read_at
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({}); // threadId -> count
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [initialized, setInitialized] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [myPresence, setMyPresence] = useState<any>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [whosHereExpanded, setWhosHereExpanded] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const agencyId = currentWorkspace?.agency_id || '';

  // ── Load my presence for status button ──
  const loadMyPresence = useCallback(async () => {
    if (!user || !agencyId) return;
    const { data } = await cloudSupabase
      .from('staff_presence')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .maybeSingle();
    setMyPresence(data);
  }, [user, agencyId]);

  // ── Initialize: ensure agency thread + backfill classroom threads ──
  useEffect(() => {
    if (!user || !agencyId || initialized) return;
    const init = async () => {
      await ensureAgencyThread(agencyId, user.id);
      await ensureAgencyFeedThread(agencyId, user.id);
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

  useEffect(() => {
    if (initialized) {
      loadThreads();
      loadMyPresence();
    }
  }, [initialized, loadThreads, loadMyPresence]);

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
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
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

  // ── Rename thread ──
  const handleRename = async () => {
    if (!activeThread || !renameValue.trim()) return;
    await cloudSupabase.from('threads').update({ title: renameValue.trim() }).eq('id', activeThread.id);
    setActiveThread(prev => prev ? { ...prev, title: renameValue.trim() } : null);
    setRenameOpen(false);
    loadThreads();
    toast({ title: 'Thread renamed' });
  };

  // ── Toggle privacy ──
  const togglePrivacy = async () => {
    if (!activeThread) return;
    const newPrivacy = !activeThread.is_private;
    await cloudSupabase.from('threads').update({ is_private: newPrivacy }).eq('id', activeThread.id);
    setActiveThread(prev => prev ? { ...prev, is_private: newPrivacy } : null);
    loadThreads();
    toast({ title: newPrivacy ? 'Thread set to private' : 'Thread set to public' });
  };

  // ── Delete thread (owner only) ──
  const handleDeleteThread = async () => {
    if (!activeThread || !user) return;
    if (activeThread.created_by !== user.id) {
      toast({ title: 'Only the thread creator can delete it', variant: 'destructive' });
      return;
    }
    if (!confirm(`Delete "${activeThread.title || 'this thread'}"? This cannot be undone.`)) return;
    // Delete messages, members, reactions first
    await cloudSupabase.from('thread_messages').delete().eq('thread_id', activeThread.id);
    await cloudSupabase.from('thread_members').delete().eq('thread_id', activeThread.id);
    await cloudSupabase.from('thread_message_reactions').delete().eq('message_id', activeThread.id); // best effort
    await cloudSupabase.from('threads').delete().eq('id', activeThread.id);
    setActiveThread(null);
    loadThreads();
    toast({ title: 'Thread deleted' });
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

  // ── Group threads by categories ──
  // Staff Feed: agency-type thread only (deduplicate — ignore group-type #staff-feed)
  const staffFeedThreads = threads.filter(t => t.thread_type === 'agency');
  const groupThreads = threads.filter(t => getThreadCategory(t) === 'channel' && t.thread_type !== 'agency');
  const dmThreads = threads.filter(t => getThreadCategory(t) === 'dm');
  const parentThreads = threads.filter(t => getThreadCategory(t) === 'parent');

  const myStatusLabel = myPresence
    ? PRESENCE_STATUS_MAP[myPresence.status as PresenceStatus]?.label || 'Set Status'
    : 'Set Status';
  const myStatusDot = myPresence
    ? PRESENCE_STATUS_MAP[myPresence.status as PresenceStatus]?.dot || 'bg-muted-foreground'
    : 'bg-muted-foreground';

  // ── Sidebar ──
  const ThreadSidebar = () => (
    <div className={cn(
      'flex flex-col border-r border-border/40 bg-card/50',
      isMobile ? 'w-full' : 'w-64 shrink-0'
    )}>
      {/* Header with Set Status */}
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        <h2 className="text-sm font-bold font-heading">Threads</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => setStatusSheetOpen(true)}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', myStatusDot)} />
            {myStatusLabel}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Who's Here (expandable panel) */}
      <div className="border-b border-border/40">
        <button
          onClick={() => setWhosHereExpanded(!whosHereExpanded)}
          className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Users2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Who's Here</span>
          </div>
          {whosHereExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </button>
        {whosHereExpanded ? (
          <div className="px-3 pb-3">
            <WhosHerePanel
              agencyId={agencyId}
              variant="full"
              onMessageStaff={(uid) => {
                // Find or create DM with this person
                toast({ title: 'Opening DM...' });
              }}
              onRequestHelp={(ids) => setMsgText('🔔 Requesting support — anyone available?')}
            />
            {/* Update own status button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 h-7 text-[10px] gap-1.5"
              onClick={() => setStatusSheetOpen(true)}
            >
              <MapPin className="h-3 w-3" />
              Update My Status
            </Button>
          </div>
        ) : (
          <div className="px-3 pb-2">
            <WhosHerePanel agencyId={agencyId} variant="strip" />
          </div>
        )}
      </div>

      {/* Thread groups */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-1">
            {/* Staff Feed section */}
            {staffFeedThreads.length > 0 && (
              <ThreadGroup label="Staff Feed" threads={staffFeedThreads} onSelect={openThread} activeId={activeThread?.id} />
            )}
            {/* Groups / Channels */}
            <ThreadGroup label="Channels" threads={groupThreads} onSelect={openThread} activeId={activeThread?.id} showAddButton onAdd={() => setCreateOpen(true)} />
            <ThreadGroup label="Direct Messages" threads={dmThreads} onSelect={openThread} activeId={activeThread?.id} />
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
    const category = getThreadCategory(activeThread);
    const canManage = activeThread.thread_type !== 'agency'; // Staff Feed can't be renamed

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
            {activeThread.is_private ? (
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{getThreadDisplayTitle(activeThread)}</h3>
              <p className="text-[10px] text-muted-foreground">
                {activeThread.is_private ? '🔒 Private' : '🌐 Public'} · {category}
              </p>
            </div>

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setRenameValue(activeThread.title || ''); setRenameOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={togglePrivacy}>
                    {activeThread.is_private ? (
                      <><Globe className="h-3.5 w-3.5 mr-2" /> Make Public</>
                    ) : (
                      <><LockKeyhole className="h-3.5 w-3.5 mr-2" /> Make Private</>
                    )}
                  </DropdownMenuItem>
                  {activeThread.created_by === user?.id && (
                    <DropdownMenuItem onClick={handleDeleteThread} className="text-destructive focus:text-destructive">
                      <span className="h-3.5 w-3.5 mr-2">🗑</span> Delete Thread
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Who's Here strip in thread */}
          <WhosHerePanel
            agencyId={agencyId}
            classroomId={activeThread.classroom_id}
            variant="strip"
            onRequestHelp={() => setMsgText('🔔 Requesting support — anyone available?')}
            onNotifyRoom={() => setMsgText('📢 Room notification: ')}
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

  const content = isMobile ? (
    <div className="h-[calc(100vh-12rem)]">
      {activeThread ? <MessageView /> : <ThreadSidebar />}
    </div>
  ) : (
    <div className="flex h-[calc(100vh-12rem)] rounded-xl border border-border/40 overflow-hidden bg-background">
      <ThreadSidebar />
      <MessageView />
    </div>
  );

  return (
    <>
      {content}

      {/* Create Thread Dialog */}
      <CreateThreadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agencyId={agencyId}
        userId={user?.id || ''}
        sessionToken={session?.access_token}
        onCreated={(thread) => {
          loadThreads();
          if (thread) openThread(thread);
          setCreateOpen(false);
        }}
      />

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm">Rename Thread</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder="Thread name…" />
          <div className="flex justify-end">
            <Button onClick={handleRename} disabled={!renameValue.trim()} size="sm">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Sheet — safe render with fallback presence */}
      {user && statusSheetOpen && (
        <StaffActionSheet
          open={statusSheetOpen}
          onOpenChange={setStatusSheetOpen}
          userId={user.id}
          agencyId={agencyId}
          currentPresence={myPresence || {
            status: 'in_room' as PresenceStatus,
            location_type: 'classroom',
            location_label: null,
            availability_status: 'available',
            available_for_support: true,
            assigned_student_id: null,
            note: null,
            classroom_group_id: null,
          }}
          onUpdated={() => { loadMyPresence(); }}
        />
      )}
    </>
  );
};

export default Threads;

// ── Thread Group Component ──
function ThreadGroup({ label, threads, onSelect, activeId, showAddButton, onAdd }: {
  label: string;
  threads: ThreadRow[];
  onSelect: (t: ThreadRow) => void;
  activeId?: string;
  showAddButton?: boolean;
  onAdd?: () => void;
}) {
  if (threads.length === 0 && !showAddButton) return null;

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-3 py-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {showAddButton && onAdd && (
          <button onClick={onAdd} className="text-muted-foreground hover:text-primary transition-colors">
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      {threads.map(thread => {
        const isActive = thread.id === activeId;
        return (
          <button key={thread.id} onClick={() => onSelect(thread)}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 text-left transition-colors text-sm',
              isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted/50'
            )}>
            {thread.is_private ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 truncate text-xs">{getThreadDisplayTitle(thread)}</span>
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
function CreateThreadDialog({ open, onOpenChange, agencyId, userId, sessionToken, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  agencyId: string; userId: string; sessionToken?: string;
  onCreated: (thread?: ThreadRow) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [threadCategory, setThreadCategory] = useState<'channel' | 'dm' | 'parent'>('channel');
  const [isPrivate, setIsPrivate] = useState(false);
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [parentContact, setParentContact] = useState({ name: '', email: '', phone: '' });
  const [creating, setCreating] = useState(false);

  // Load recipients for DM / parent
  useEffect(() => {
    if (!open || threadCategory === 'channel') return;
    (async () => {
      try {
        const { data } = await cloudSupabase
          .from('classroom_group_teachers')
          .select('user_id')
          .limit(50);
        const ids = [...new Set((data || []).map(r => r.user_id).filter(id => id !== userId))];
        if (ids.length > 0) {
          const names = await resolveDisplayNames(ids, sessionToken);
          setRecipients(ids.map(id => ({ id, name: names.get(id) || id.slice(0, 8) })));
        }
      } catch { /* silent */ }
    })();
  }, [open, threadCategory, userId, sessionToken]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      if (threadCategory === 'dm') {
        if (!selectedRecipient) { toast({ title: 'Select a person' }); setCreating(false); return; }
        const recipName = recipients.find(r => r.id === selectedRecipient)?.name || 'DM';
        const threadId = await createDMThread(agencyId, userId, selectedRecipient, recipName);
        if (threadId) {
          const { data: t } = await cloudSupabase.from('threads').select('*').eq('id', threadId).single();
          onCreated(t as ThreadRow);
          toast({ title: 'DM opened' });
        }
      } else if (threadCategory === 'parent') {
        const { data, error } = await cloudSupabase
          .from('threads')
          .insert({
            agency_id: agencyId,
            thread_type: 'parent',
            title: parentContact.name || title || 'Parent',
            is_private: true,
            created_by: userId,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          await cloudSupabase.from('thread_members').insert({ thread_id: data.id, user_id: userId, role: 'admin' });
          const contactInfo = [parentContact.email, parentContact.phone].filter(Boolean).join(', ');
          if (contactInfo) {
            await cloudSupabase.from('thread_messages').insert({
              thread_id: data.id, sender_id: userId,
              body: `Parent contact: ${contactInfo}`,
              message_type: 'system',
            });
          }
          onCreated(data as ThreadRow);
          toast({ title: 'Parent thread created' });
        }
      } else {
        // Channel / Group
        if (!title.trim()) { toast({ title: 'Enter a channel name' }); setCreating(false); return; }
        const { data, error } = await cloudSupabase
          .from('threads')
          .insert({
            agency_id: agencyId,
            thread_type: 'group',
            title: title.trim().startsWith('#') ? title.trim() : `#${title.trim()}`,
            is_private: isPrivate,
            created_by: userId,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          await cloudSupabase.from('thread_members').insert({ thread_id: data.id, user_id: userId, role: 'admin' });
          onCreated(data as ThreadRow);
          toast({ title: 'Channel created' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
      setTitle('');
      setSelectedRecipient('');
      setParentContact({ name: '', email: '', phone: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">New Thread</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Category picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={threadCategory} onValueChange={(v: any) => setThreadCategory(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="channel">Channel</SelectItem>
                <SelectItem value="dm">Direct Message</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Channel-specific */}
          {threadCategory === 'channel' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Channel Name</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="#channel-name" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} id="private-toggle" />
                <Label htmlFor="private-toggle" className="text-xs flex items-center gap-1.5">
                  {isPrivate ? <><Lock className="h-3 w-3" /> Private</> : <><Globe className="h-3 w-3" /> Public</>}
                </Label>
              </div>
            </>
          )}

          {/* DM-specific */}
          {threadCategory === 'dm' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Select Person</Label>
              <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                <SelectTrigger><SelectValue placeholder="Choose team member…" /></SelectTrigger>
                <SelectContent>
                  {recipients.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                  {recipients.length === 0 && (
                    <SelectItem value="__none" disabled>No team members found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Parent-specific */}
          {threadCategory === 'parent' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Parent Name</Label>
                <Input value={parentContact.name} onChange={e => setParentContact(p => ({ ...p, name: e.target.value }))} placeholder="Parent name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email (for notifications)</Label>
                <Input type="email" value={parentContact.email} onChange={e => setParentContact(p => ({ ...p, email: e.target.value }))} placeholder="parent@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone (for SMS)</Label>
                <Input type="tel" value={parentContact.phone} onChange={e => setParentContact(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555-123-4567" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Messages will be sent via email/SMS if the parent isn't on the app yet.
              </p>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {threadCategory === 'dm' ? 'Open DM' : threadCategory === 'parent' ? 'Create Parent Thread' : 'Create Channel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
