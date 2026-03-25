/**
 * LaunchReadiness — Admin-only dashboard showing readiness score and checklist.
 * Uses launch_readiness_checks table and v_launch_readiness_score view.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Rocket, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadinessCheck {
  id: string;
  category: string;
  check_key: string;
  label: string;
  description: string | null;
  weight: number;
  is_complete: boolean;
}

interface ReadinessScore {
  total_checks: number;
  completed_checks: number;
  total_weight: number;
  completed_weight: number;
  score: number;
}

const DEFAULT_CHECKS = [
  { category: 'Setup', check_key: 'agency_created', label: 'Agency workspace created', weight: 5 },
  { category: 'Setup', check_key: 'classroom_created', label: 'At least one classroom created', weight: 5 },
  { category: 'Setup', check_key: 'students_added', label: 'Students added to classroom', weight: 10 },
  { category: 'Setup', check_key: 'staff_invited', label: 'Staff members invited', weight: 5 },
  { category: 'Reinforcement', check_key: 'point_rules_configured', label: 'Point rules configured', weight: 10 },
  { category: 'Reinforcement', check_key: 'rewards_created', label: 'Reward store populated', weight: 10 },
  { category: 'Reinforcement', check_key: 'templates_assigned', label: 'Reinforcement templates assigned', weight: 5 },
  { category: 'Game', check_key: 'game_track_selected', label: 'Game track selected', weight: 5 },
  { category: 'Game', check_key: 'game_settings_configured', label: 'Game settings configured', weight: 5 },
  { category: 'Communication', check_key: 'threads_created', label: 'Staff threads created', weight: 5 },
  { category: 'Communication', check_key: 'mayday_contacts_set', label: 'Mayday contacts configured', weight: 10 },
  { category: 'Portals', check_key: 'student_portal_enabled', label: 'Student portal access set up', weight: 5 },
  { category: 'Portals', check_key: 'parent_links_created', label: 'Parent access links created', weight: 5 },
  { category: 'Data', check_key: 'behaviors_configured', label: 'Behavior categories defined', weight: 5 },
  { category: 'Data', check_key: 'targets_created', label: 'Student targets created', weight: 5 },
  { category: 'Safety', check_key: 'staff_presence_tested', label: 'Staff presence system tested', weight: 5 },
  { category: 'Safety', check_key: 'mayday_tested', label: 'Mayday alert tested', weight: 10 },
];

export default function LaunchReadiness() {
  const navigate = useNavigate();
  const { currentWorkspace, isAdmin } = useWorkspace();
  const { toast } = useToast();
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [score, setScore] = useState<ReadinessScore | null>(null);
  const [loading, setLoading] = useState(true);

  const agencyId = currentWorkspace?.agency_id || '';

  useEffect(() => {
    if (agencyId && isAdmin) loadData();
  }, [agencyId, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    // Ensure default checks exist
    const { data: existing } = await cloudSupabase
      .from('launch_readiness_checks')
      .select('check_key')
      .eq('agency_id', agencyId);
    const existingKeys = new Set((existing || []).map((e: any) => e.check_key));
    const missing = DEFAULT_CHECKS.filter(c => !existingKeys.has(c.check_key));
    if (missing.length > 0) {
      await cloudSupabase.from('launch_readiness_checks').insert(
        missing.map(c => ({ ...c, agency_id: agencyId }))
      );
    }

    // Load checks
    const { data: allChecks } = await cloudSupabase
      .from('launch_readiness_checks')
      .select('*')
      .eq('agency_id', agencyId)
      .order('category')
      .order('weight', { ascending: false });
    setChecks((allChecks || []) as any[]);

    // Load score
    const { data: scoreData } = await cloudSupabase
      .from('v_launch_readiness_score')
      .select('*')
      .eq('agency_id', agencyId)
      .maybeSingle();
    setScore(scoreData as any);

    setLoading(false);
  };

  const handleToggle = async (check: ReadinessCheck) => {
    const newComplete = !check.is_complete;
    await cloudSupabase.from('launch_readiness_checks').update({
      is_complete: newComplete,
      completed_at: newComplete ? new Date().toISOString() : null,
    }).eq('id', check.id);
    loadData();
  };

  if (!isAdmin) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Admin access required.</p>
        <Button variant="link" onClick={() => navigate('/settings')}>Back to Settings</Button>
      </div>
    );
  }

  const scoreValue = score?.score || 0;
  const scoreColor = scoreValue >= 90 ? 'text-green-500' : scoreValue >= 60 ? 'text-amber-500' : 'text-destructive';
  const progressColor = scoreValue >= 90 ? 'bg-green-500' : scoreValue >= 60 ? 'bg-amber-500' : 'bg-destructive';
  const categories = [...new Set(checks.map(c => c.category))];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-bold font-heading flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> Launch Readiness</h1>
          <p className="text-xs text-muted-foreground">Track your setup progress before going live.</p>
        </div>
      </div>

      {/* Score header */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardContent className="p-6 text-center">
          <p className={cn('text-6xl font-black tabular-nums', scoreColor)}>{Math.round(scoreValue)}</p>
          <p className="text-sm text-muted-foreground font-medium mt-1">out of 110</p>
          <div className="mt-3 max-w-xs mx-auto">
            <div className="relative h-4 rounded-full bg-secondary overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', progressColor)} style={{ width: `${Math.min(100, (scoreValue / 110) * 100)}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            {scoreValue >= 90 ? (
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 gap-1"><CheckCircle className="h-3 w-3" /> Ready to Launch!</Badge>
            ) : scoreValue >= 60 ? (
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 gap-1"><AlertTriangle className="h-3 w-3" /> Almost There</Badge>
            ) : (
              <Badge className="bg-destructive/20 text-destructive gap-1"><XCircle className="h-3 w-3" /> Needs Work</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {score?.completed_checks || 0} of {score?.total_checks || 0} checks complete
          </p>
        </CardContent>
      </Card>

      {/* Checklist by category */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : (
        categories.map(cat => {
          const catChecks = checks.filter(c => c.category === cat);
          const catComplete = catChecks.filter(c => c.is_complete).length;
          return (
            <Card key={cat} className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{cat}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{catComplete}/{catChecks.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {catChecks.map(check => (
                  <div key={check.id} className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleToggle(check)}>
                    <Checkbox checked={check.is_complete} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', check.is_complete && 'line-through text-muted-foreground')}>{check.label}</p>
                      {check.description && <p className="text-[10px] text-muted-foreground">{check.description}</p>}
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0">×{check.weight}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Incomplete gaps */}
      {checks.filter(c => !c.is_complete).length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Missing Items ({checks.filter(c => !c.is_complete).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {checks.filter(c => !c.is_complete).map(c => (
                <p key={c.id} className="text-xs text-muted-foreground">• {c.label} <span className="text-[10px]">({c.category}, ×{c.weight})</span></p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
