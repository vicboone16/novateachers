import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { FileText, Clock, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  clientId: string;
}

export const TeacherSummaries = ({ clientId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const { data: summaries, isLoading } = useQuery({
    queryKey: ['bcba-summaries', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iep_drafts')
        .select('*')
        .eq('client_id', clientId)
        .eq('draft_type', 'bcba_summary')
        .eq('status', 'shared')
        .order('shared_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const markReviewed = useMutation({
    mutationFn: async (summaryId: string) => {
      const { error } = await supabase
        .from('iep_drafts')
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', summaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bcba-summaries', clientId] });
      toast({ title: 'Marked as reviewed' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading summaries…</p>;
  if (!summaries?.length) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
        <FileText className="h-4 w-4" /> Shared Summaries ({summaries.length})
      </h4>
      {summaries.map((s) => {
        const isReviewed = !!s.reviewed_at;
        const isOpen = openItems[s.id] ?? false;
        return (
          <Collapsible key={s.id} open={isOpen} onOpenChange={() => toggleItem(s.id)}>
            <Card className={isReviewed ? 'border-primary/20 bg-primary/[0.02]' : 'border-warning/30 bg-warning/[0.03]'}>
              <CardHeader className="pb-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between gap-2 w-full text-left">
                    <CardTitle className="text-sm truncate">{s.title}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      {isReviewed ? (
                        <Badge variant="outline" className="text-primary border-primary/30 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Reviewed {format(new Date(s.reviewed_at), 'MMM d')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-warning border-warning/40 gap-1">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                      {s.shared_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(s.shared_at), 'MMM d, yyyy')}
                        </span>
                      )}
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-2">
                  <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground bg-muted/50 rounded-md p-3 max-h-48 overflow-y-auto">
                    {s.sections?.[0]?.content || 'No content'}
                  </pre>
                  {isReviewed && s.review_comment && (
                    <div className="rounded-md border border-primary/20 bg-primary/[0.03] p-3 space-y-1">
                      <p className="text-xs font-semibold text-primary">BCBA Feedback</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{s.review_comment}</p>
                    </div>
                  )}
                  {!isReviewed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                      disabled={markReviewed.isPending}
                      onClick={() => markReviewed.mutate(s.id)}
                    >
                      {markReviewed.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Mark as Reviewed
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};
