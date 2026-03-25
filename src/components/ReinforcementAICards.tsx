/**
 * ReinforcementAICards — Accept / Dismiss / Review Data cards for AI recommendations.
 * Queries v_open_reinforcement_ai_recommendations for a student.
 * Accept → opens ReinforcementAssignPanel prefilled from suggested_payload.
 * Dismiss → removes from list. Review Data → evidence drawer.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Brain, Check, X, BarChart3, Loader2, AlertTriangle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Recommendation {
  id: string;
  student_id: string;
  recommendation_type: string;
  priority: string;
  title: string;
  explanation: string;
  suggested_action: string | null;
  suggested_payload: Record<string, any>;
  evidence_json: Record<string, any>;
  created_at: string;
}

interface ReinforcementAICardsProps {
  studentId: string;
  studentName: string;
  agencyId: string;
  /** Called when user accepts a rec and wants to open the reinforcement editor */
  onOpenEditor?: (payload: {
    studentId: string;
    suggestedPayload: Record<string, any>;
    recommendationId: string;
  }) => void;
  compact?: boolean;
}

export function ReinforcementAICards({
  studentId, studentName, agencyId, onOpenEditor, compact = false,
}: ReinforcementAICardsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [evidenceRec, setEvidenceRec] = useState<Recommendation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reinforcement_ai_recommendations')
      .select('id, student_id, recommendation_type, priority, title, explanation, suggested_action, suggested_payload, evidence_json, created_at')
      .eq('student_id', studentId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    setRecs((data || []) as Recommendation[]);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (rec: Recommendation) => {
    if (!user) return;
    setActing(rec.id);
    await supabase.rpc('accept_reinforcement_ai_recommendation', {
      p_recommendation_id: rec.id,
      p_user_id: user.id,
      p_action_notes: null,
    });
    toast({ title: '✓ Recommendation accepted' });
    setRecs(prev => prev.filter(r => r.id !== rec.id));
    setActing(null);
    onOpenEditor?.({
      studentId: rec.student_id,
      suggestedPayload: rec.suggested_payload || {},
      recommendationId: rec.id,
    });
  };

  const handleDismiss = async (rec: Recommendation) => {
    if (!user) return;
    setActing(rec.id);
    await supabase.rpc('dismiss_reinforcement_ai_recommendation', {
      p_recommendation_id: rec.id,
      p_user_id: user.id,
      p_action_notes: null,
    });
    toast({ title: '✓ Recommendation dismissed' });
    setRecs(prev => prev.filter(r => r.id !== rec.id));
    setActing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Checking AI recommendations…</span>
      </div>
    );
  }

  if (recs.length === 0) return null;

  const priorityColor = (p: string) => {
    if (p === 'high') return 'text-destructive bg-destructive/10 border-destructive/30';
    if (p === 'medium') return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-700';
    return 'text-muted-foreground bg-muted border-border';
  };

  const typeIcon = (t: string) => {
    if (t === 'reinforcement_too_thin') return <AlertTriangle className="h-3.5 w-3.5" />;
    if (t === 'response_cost_backfiring') return <AlertTriangle className="h-3.5 w-3.5" />;
    return <Info className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI Recommendations ({recs.length})
        </span>
      </div>

      {recs.map(rec => (
        <Card key={rec.id} className={cn('border', priorityColor(rec.priority))}>
          <CardContent className={cn('space-y-2', compact ? 'p-3' : 'p-4')}>
            <div className="flex items-start gap-2">
              {typeIcon(rec.recommendation_type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-semibold text-foreground">{rec.title}</p>
                  <Badge variant="outline" className="text-[8px] h-4 px-1">
                    {rec.priority}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {rec.explanation}
                </p>
                {rec.suggested_action && (
                  <p className="text-[10px] text-primary mt-1 font-medium">
                    💡 {rec.suggested_action}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-1.5 pt-1">
              <Button
                size="sm"
                className="flex-1 h-7 text-[10px] gap-1"
                disabled={acting === rec.id}
                onClick={() => handleAccept(rec)}
              >
                {acting === rec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-[10px] gap-1"
                disabled={acting === rec.id}
                onClick={() => handleDismiss(rec)}
              >
                <X className="h-3 w-3" /> Dismiss
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] gap-1 px-2"
                onClick={() => setEvidenceRec(rec)}
              >
                <BarChart3 className="h-3 w-3" /> Data
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Evidence drawer */}
      <Sheet open={!!evidenceRec} onOpenChange={(o) => !o && setEvidenceRec(null)}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Evidence — {evidenceRec?.title}
            </SheetTitle>
          </SheetHeader>
          {evidenceRec && (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type</p>
                <p className="text-xs">{evidenceRec.recommendation_type.replace(/_/g, ' ')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Explanation</p>
                <p className="text-xs text-foreground leading-relaxed">{evidenceRec.explanation}</p>
              </div>
              {evidenceRec.suggested_action && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Suggested Action</p>
                  <p className="text-xs text-primary">{evidenceRec.suggested_action}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Evidence Data</p>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  {Object.entries(evidenceRec.evidence_json || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                      <span className="font-medium text-foreground">{String(val)}</span>
                    </div>
                  ))}
                  {Object.keys(evidenceRec.evidence_json || {}).length === 0 && (
                    <p className="text-[10px] text-muted-foreground">No evidence data available.</p>
                  )}
                </div>
              </div>
              {evidenceRec.suggested_payload && Object.keys(evidenceRec.suggested_payload).length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Suggested Changes</p>
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
                    {Object.entries(evidenceRec.suggested_payload).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{key.replace(/suggested_/g, '').replace(/_/g, ' ')}</span>
                        <span className="font-medium text-primary">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
