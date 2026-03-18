/**
 * ClassroomFeed — Brightwheel-style classroom updates, celebrations,
 * and announcements visible to classroom team members.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquare, PartyPopper, Megaphone, Camera,
  Send, Pin, PinOff, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { resolveDisplayNames } from '@/lib/resolve-names';

interface FeedPost {
  id: string;
  group_id: string;
  agency_id: string;
  author_id: string;
  post_type: string;
  title: string | null;
  body: string;
  media_url: string | null;
  pinned: boolean;
  created_at: string;
}

const POST_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  update: { label: 'Update', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  celebration: { label: 'Celebration', icon: PartyPopper, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  photo: { label: 'Photo', icon: Camera, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

interface Props {
  groupId: string;
  agencyId: string;
}

export default function ClassroomFeed({ groupId, agencyId }: Props) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [newType, setNewType] = useState('update');
  const [posting, setPosting] = useState(false);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('classroom_feed_posts' as any)
      .select('*')
      .eq('group_id', groupId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    const feedPosts = (data || []) as any as FeedPost[];
    setPosts(feedPosts);

    // Resolve names
    const ids = new Set(feedPosts.map(p => p.author_id));
    if (ids.size > 0) {
      const resolved = await resolveDisplayNames(Array.from(ids), session?.access_token);
      setUserNames(prev => {
        const m = new Map(prev);
        resolved.forEach((n, id) => m.set(id, n));
        return m;
      });
    }
    setLoading(false);
  }, [groupId, session?.access_token]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`feed-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classroom_feed_posts', filter: `group_id=eq.${groupId}` }, () => {
        loadPosts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, loadPosts]);

  const handlePost = async () => {
    if (!newBody.trim() || !user) return;
    setPosting(true);
    try {
      const { error } = await supabase
        .from('classroom_feed_posts' as any)
        .insert({
          group_id: groupId,
          agency_id: agencyId,
          author_id: user.id,
          post_type: newType,
          body: newBody.trim(),
        });
      if (error) throw error;
      setNewBody('');
      toast({ title: 'Posted to classroom feed' });
    } catch (err: any) {
      toast({ title: 'Error posting', description: err.message, variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const togglePin = async (post: FeedPost) => {
    const { error } = await supabase
      .from('classroom_feed_posts' as any)
      .update({ pinned: !post.pinned })
      .eq('id', post.id);
    if (!error) loadPosts();
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase
      .from('classroom_feed_posts' as any)
      .delete()
      .eq('id', postId);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: 'Post deleted' });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold font-heading flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        Classroom Feed
      </h3>

      {/* Compose */}
      <Card className="border-border/50">
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(POST_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Share a classroom update, celebration, or announcement…"
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handlePost} disabled={posting || !newBody.trim()} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {posting ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No posts yet. Be the first to share!</p>
      ) : (
        <div className="space-y-2">
          {posts.map(post => {
            const cfg = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.update;
            const Icon = cfg.icon;
            const isAuthor = post.author_id === user?.id;

            return (
              <Card key={post.id} className={cn('border-border/40', post.pinned && 'border-primary/30 bg-primary/5')}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className={cn('text-[9px] shrink-0', cfg.color)}>
                        <Icon className="h-2.5 w-2.5 mr-0.5" />
                        {cfg.label}
                      </Badge>
                      {post.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      <span className="text-xs text-muted-foreground truncate">
                        {userNames.get(post.author_id) || 'Staff'} · {format(new Date(post.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    {isAuthor && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => togglePin(post)}
                          className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                          title={post.pinned ? 'Unpin' : 'Pin'}
                        >
                          {post.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => deletePost(post.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-1.5">{post.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
