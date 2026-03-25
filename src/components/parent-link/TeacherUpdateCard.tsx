import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Lightbulb } from 'lucide-react';

interface FeedPost {
  id: string;
  body: string;
  title: string | null;
  created_at: string;
}

interface Props {
  posts: FeedPost[];
  insightBadge?: string | null;
}

export function TeacherUpdateCard({ posts, insightBadge }: Props) {
  if (posts.length === 0) return null;

  const latest = posts[0];
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Today at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3" /> Teacher Updates
      </p>

      {/* Latest — highlighted */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent ring-1 ring-primary/10">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Latest Update</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(latest.created_at)}</span>
          </div>
          {latest.title && (
            <p className="text-sm font-semibold text-foreground">{latest.title}</p>
          )}
          <p className="text-sm text-foreground/80 leading-relaxed">{latest.body}</p>
          {insightBadge && (
            <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/20">
              <Lightbulb className="h-2.5 w-2.5" /> {insightBadge}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Older posts */}
      {posts.slice(1).map(p => (
        <Card key={p.id} className="border-border/40">
          <CardContent className="p-3">
            {p.title && <p className="text-xs font-semibold text-foreground/70 mb-0.5">{p.title}</p>}
            <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTime(p.created_at)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
