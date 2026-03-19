/**
 * ClassroomFeed — Slack-like classroom communication feed.
 * Uses Core tables: classroom_feed_posts, post_student_tags.
 * Falls back to Cloud classroom_feed_posts if Core table unavailable.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Plus, Pin, Send, Loader2, Megaphone, Camera, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedPost {
  id: string;
  body: string;
  title: string | null;
  post_type: string;
  pinned: boolean;
  author_id: string;
  created_at: string;
}

const POST_TYPES = [
  { value: 'update', label: 'Update', icon: MessageSquare },
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
  { value: 'celebration', label: 'Celebration', icon: PartyPopper },
  { value: 'photo', label: 'Photo', icon: Camera },
];

const ClassroomFeed = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [newBody, setNewBody] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('update');
  const [sending, setSending] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ group_id: string; name: string }[]>([]);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  useEffect(() => {
    if (!user || !effectiveAgencyId) return;
    cloudSupabase
      .from('classroom_groups')
      .select('group_id, name')
      .eq('agency_id', effectiveAgencyId)
      .order('name')
      .then(({ data }) => {
        const g = data || [];
        setGroups(g);
        if (g.length > 0 && !activeGroupId) setActiveGroupId(g[0].group_id);
      });
  }, [user, effectiveAgencyId]);

  useEffect(() => {
    if (activeGroupId) loadPosts();
  }, [activeGroupId]);

  const loadPosts = async () => {
    if (!activeGroupId) return;
    setLoading(true);
    try {
      // Try Cloud table first (exists in schema)
      const { data, error } = await cloudSupabase
        .from('classroom_feed_posts')
        .select('*')
        .eq('group_id', activeGroupId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) setPosts((data || []) as FeedPost[]);
    } catch { /* silent */ }
    setLoading(false);
  };

  const createPost = async () => {
    if (!newBody.trim() || !user || !activeGroupId) return;
    setSending(true);
    try {
      const { error } = await cloudSupabase.from('classroom_feed_posts').insert({
        group_id: activeGroupId,
        agency_id: effectiveAgencyId,
        author_id: user.id,
        body: newBody.trim(),
        title: newTitle.trim() || null,
        post_type: newType,
      });
      if (error) throw error;
      setComposing(false);
      setNewBody('');
      setNewTitle('');
      toast({ title: 'Post published' });
      loadPosts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Classroom Feed
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Updates, celebrations, and announcements</p>
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 1 && (
            <Select value={activeGroupId || ''} onValueChange={setActiveGroupId}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {groups.map(g => <SelectItem key={g.group_id} value={g.group_id} className="text-xs">{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => setComposing(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Post
          </Button>
        </div>
      </div>

      {/* Compose */}
      {composing && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POST_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs gap-1">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Title (optional)"
              className="text-sm"
            />
            <Textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="What's happening in your classroom?"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
              <Button size="sm" onClick={createPost} disabled={!newBody.trim() || sending} className="gap-1.5">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No posts yet. Share an update!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const typeConfig = POST_TYPES.find(t => t.value === post.post_type);
            const TypeIcon = typeConfig?.icon || MessageSquare;
            return (
              <Card key={post.id} className={cn('border-border/40', post.pinned && 'border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/5')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <TypeIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {post.title && <p className="text-sm font-semibold">{post.title}</p>}
                        <Badge variant="outline" className="text-[9px]">{typeConfig?.label}</Badge>
                        {post.pinned && (
                          <Badge className="text-[9px] gap-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 border-amber-200">
                            <Pin className="h-2 w-2" /> Pinned
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{post.body}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(post.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
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

export default ClassroomFeed;
