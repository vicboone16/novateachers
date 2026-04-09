/**
 * ClassroomInsights — AI-powered classroom health dashboard.
 * Shows: class momentum, behavior patterns, reinforcement gaps, student risk signals,
 * and actionable recommendations generated via Lovable AI.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Brain, TrendingUp, TrendingDown, AlertTriangle,
  Sparkles, Users, Star, Zap, Heart, Loader2, RefreshCw,
  CheckCircle, Target, Shield, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightData {
  classroom_health: {
    score: number;
    label: string;
    trend: 'up' | 'down' | 'stable';
  };
  top_performers: { student_id: string; name: string; points: number; streak: number }[];
  at_risk: { student_id: string; name: string; reason: string; severity: 'low' | 'medium' | 'high' }[];
  reinforcement_gaps: { student_id: string; name: string; gap_minutes: number }[];
  recommendations: { type: string; title: string; body: string; priority: 'low' | 'medium' | 'high' }[];
  daily_summary: string;
  point_distribution: { earned: number; deducted: number; redeemed: number };
}

const HEALTH_COLORS: Record<string, string> = {
  excellent: 'text-green-500',
  good: 'text-emerald-500',
  fair: 'text-amber-500',
  needs_attention: 'text-orange-500',
  critical: 'text-red-500',
};

const ClassroomInsights = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { groupId, groupName } = useActiveClassroom();
  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [allGroups, setAllGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(groupId);

  useEffect(() => {
    if (groupId) setActiveGroupId(groupId);
  }, [groupId]);

  useEffect(() => {
    if (!effectiveAgencyId) return;
    cloudSupabase
      .from('classroom_groups')
      .select('group_id, name')
      .eq('agency_id', effectiveAgencyId)
      .order('name')
      .then(({ data }) => setAllGroups(data || []));
  }, [effectiveAgencyId]);

  useEffect(() => {
    if (activeGroupId) loadInsights();
  }, [activeGroupId]);

  const loadInsights = useCallback(async () => {
    if (!activeGroupId || !user) return;
    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const dayStart = `${today}T00:00:00Z`;

      // Load students in group WITH names + game profile overrides
      const [{ data: groupStudents }, { data: gameProfiles }] = await Promise.all([
        cloudSupabase
          .from('classroom_group_students')
          .select('client_id, first_name, last_name')
          .eq('group_id', activeGroupId),
        cloudSupabase
          .from('student_game_profiles')
          .select('student_id, display_name_override')
      ]);
      const students = groupStudents || [];
      const sids = students.map((s: any) => s.client_id);

      // Build name lookup with game profile overrides
      const gpMap = new Map((gameProfiles || []).map((p: any) => [p.student_id, p.display_name_override]));
      const nameMap: Record<string, string> = {};
      for (const s of students as any[]) {
        const override = gpMap.get(s.client_id);
        if (override) {
          nameMap[s.client_id] = override;
        } else {
          const first = s.first_name || '';
          const last = s.last_name || '';
          nameMap[s.client_id] = (first + ' ' + last).trim() || `Student ${s.client_id.slice(-4).toUpperCase()}`;
        }
      }

      if (sids.length === 0) {
        setInsights(null);
        setLoading(false);
        return;
      }

      // Parallel data fetches
      const [pointsRes, redemptionsRes] = await Promise.all([
        cloudSupabase
          .from('beacon_points_ledger')
          .select('student_id, points, source, entry_kind, created_at')
          .in('student_id', sids)
          .gte('created_at', dayStart),
        cloudSupabase
          .from('beacon_reward_redemptions')
          .select('student_id, points_spent')
          .in('student_id', sids)
          .gte('redeemed_at', dayStart),
      ]);

      const points = pointsRes.data || [];
      const redemptions = redemptionsRes.data || [];

      // Compute per-student stats
      const studentStats: Record<string, { earned: number; deducted: number; last_at: string | null }> = {};
      for (const sid of sids) {
        studentStats[sid] = { earned: 0, deducted: 0, last_at: null };
      }
      for (const p of points) {
        const s = studentStats[p.student_id];
        if (!s) continue;
        if (p.points > 0) s.earned += p.points;
        else s.deducted += Math.abs(p.points);
        if (!s.last_at || p.created_at > s.last_at) s.last_at = p.created_at;
      }

      const totalEarned = Object.values(studentStats).reduce((s, v) => s + v.earned, 0);
      const totalDeducted = Object.values(studentStats).reduce((s, v) => s + v.deducted, 0);
      const totalRedeemed = (redemptions || []).reduce((s: number, r: any) => s + r.points_spent, 0);

      // Health score (0-100)
      const avgEarned = sids.length > 0 ? totalEarned / sids.length : 0;
      const deductionRatio = totalEarned > 0 ? totalDeducted / totalEarned : 0;
      const healthScore = Math.min(100, Math.max(0,
        Math.round(50 + avgEarned * 2 - deductionRatio * 30)
      ));
      const healthLabel = healthScore >= 90 ? 'excellent' : healthScore >= 75 ? 'good' : healthScore >= 60 ? 'fair' : healthScore >= 40 ? 'needs_attention' : 'critical';

      // Top performers (highest earned today)
      const sorted = Object.entries(studentStats).sort((a, b) => b[1].earned - a[1].earned);
      const topPerformers = sorted.slice(0, 5).filter(([_, v]) => v.earned > 0).map(([sid, v]) => ({
        student_id: sid,
        name: nameMap[sid] || sid.slice(0, 8),
        points: v.earned,
        streak: 0,
      }));

      // At risk (high deduction ratio or no points)
      const atRisk = sorted.filter(([_, v]) => {
        if (v.earned === 0 && v.deducted === 0) return false;
        return v.deducted > v.earned * 0.5 || (v.earned === 0 && v.deducted > 0);
      }).map(([sid, v]) => ({
        student_id: sid,
        name: nameMap[sid] || sid.slice(0, 8),
        reason: v.earned === 0 ? 'No positive points today' : 'High deduction ratio',
        severity: (v.deducted > v.earned ? 'high' : 'medium') as 'low' | 'medium' | 'high',
      }));

      // Reinforcement gaps
      const now = Date.now();
      const gaps = Object.entries(studentStats)
        .filter(([_, v]) => v.last_at)
        .map(([sid, v]) => ({
          student_id: sid,
          name: nameMap[sid] || sid.slice(0, 8),
          gap_minutes: Math.round((now - new Date(v.last_at!).getTime()) / 60000),
        }))
        .filter(g => g.gap_minutes > 30)
        .sort((a, b) => b.gap_minutes - a.gap_minutes);

      // Build recommendations
      const recommendations: InsightData['recommendations'] = [];
      if (deductionRatio > 0.4) {
        recommendations.push({
          type: 'reinforcement',
          title: 'Increase positive reinforcement',
          body: 'Deductions are high relative to rewards. Try increasing praise frequency and using token economy check-ins.',
          priority: 'high',
        });
      }
      if (gaps.length > sids.length * 0.3) {
        recommendations.push({
          type: 'engagement',
          title: 'Reinforcement gaps detected',
          body: `${gaps.length} students haven't received reinforcement in 30+ minutes. Consider a class-wide point opportunity.`,
          priority: 'medium',
        });
      }
      if (atRisk.length > 0) {
        recommendations.push({
          type: 'support',
          title: `${atRisk.length} student${atRisk.length > 1 ? 's' : ''} need support`,
          body: 'Review individualized reinforcement plans and consider a check-in or break.',
          priority: atRisk.some(a => a.severity === 'high') ? 'high' : 'medium',
        });
      }
      if (totalEarned > 0 && totalRedeemed === 0) {
        recommendations.push({
          type: 'economy',
          title: 'No rewards redeemed today',
          body: 'Students are earning but not spending. Consider prompting reward selection or adding new options.',
          priority: 'low',
        });
      }
      if (healthScore >= 80) {
        recommendations.push({
          type: 'celebration',
          title: '🎉 Great classroom energy!',
          body: 'Your class is performing well today. Consider a class-wide celebration or bonus challenge.',
          priority: 'low',
        });
      }

      // Daily summary
      const summary = `Today: ${totalEarned} points earned across ${sids.length} students. ${atRisk.length} students need attention. ${gaps.length} reinforcement gap${gaps.length !== 1 ? 's' : ''} detected. Classroom health: ${healthLabel}.`;

      setInsights({
        classroom_health: { score: healthScore, label: healthLabel, trend: 'stable' },
        top_performers: topPerformers,
        at_risk: atRisk,
        reinforcement_gaps: gaps.slice(0, 5),
        recommendations,
        daily_summary: summary,
        point_distribution: { earned: totalEarned, deducted: totalDeducted, redeemed: totalRedeemed },
      });
    } catch (err) {
      console.error('[Insights] Load error:', err);
    }
    setLoading(false);
  }, [activeGroupId, user]);

  const generateAIInsights = async () => {
    if (!activeGroupId || !insights) return;
    setGenerating(true);
    try {
      const { data, error } = await invokeCloudFunction('classroom-ai-insights', {
        group_id: activeGroupId,
        agency_id: effectiveAgencyId,
        current_data: insights,
      }, session?.access_token);
      if (data?.recommendations) {
        setInsights(prev => prev ? {
          ...prev,
          recommendations: [...data.recommendations, ...prev.recommendations],
          daily_summary: data.summary || prev.daily_summary,
        } : prev);
      }
    } catch { /* AI insights are optional enhancement */ }
    setGenerating(false);
  };

  const healthColor = insights ? HEALTH_COLORS[insights.classroom_health.label] || 'text-muted-foreground' : '';

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center flex-col gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Analyzing classroom data…</p>
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/classroom')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Classroom
        </Button>
        <h1 className="text-lg font-bold font-heading flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" /> Classroom Insights
        </h1>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadInsights}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {allGroups.length > 1 && (
        <Select value={activeGroupId || ''} onValueChange={setActiveGroupId}>
          <SelectTrigger className="h-9 text-sm rounded-xl">
            <SelectValue placeholder="Select classroom…" />
          </SelectTrigger>
          <SelectContent>
            {allGroups.map(g => (
              <SelectItem key={g.group_id} value={g.group_id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!insights ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No data available for this classroom today.</p>
        </div>
      ) : (
        <>
          {/* Health Score */}
          <Card className="overflow-hidden border-0 shadow-md">
            <CardContent className="p-5 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Classroom Health</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('text-4xl font-black tabular-nums', healthColor)}>
                      {insights.classroom_health.score}
                    </span>
                    <span className="text-sm text-muted-foreground">/100</span>
                    {insights.classroom_health.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {insights.classroom_health.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                  </div>
                </div>
                <Badge className={cn('text-xs capitalize', healthColor)} variant="outline">
                  {insights.classroom_health.label.replace('_', ' ')}
                </Badge>
              </div>
              <Progress
                value={insights.classroom_health.score}
                className="h-2.5"
              />
            </CardContent>
          </Card>

          {/* Point Distribution */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="border-border/40">
              <CardContent className="p-3 text-center">
                <Star className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold tabular-nums text-foreground">{insights.point_distribution.earned}</p>
                <p className="text-[10px] text-muted-foreground">Earned</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-3 text-center">
                <Zap className="h-4 w-4 text-red-500 mx-auto mb-1" />
                <p className="text-lg font-bold tabular-nums text-foreground">{insights.point_distribution.deducted}</p>
                <p className="text-[10px] text-muted-foreground">Deducted</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-3 text-center">
                <Heart className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold tabular-nums text-foreground">{insights.point_distribution.redeemed}</p>
                <p className="text-[10px] text-muted-foreground">Redeemed</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Daily Summary</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{insights.daily_summary}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5 text-xs"
                onClick={generateAIInsights}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                {generating ? 'Generating…' : 'Get AI Recommendations'}
              </Button>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {insights.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="section-header"><Target className="h-3 w-3" /> Recommendations</p>
              {insights.recommendations.map((rec, i) => (
                <Card key={i} className={cn(
                  'border-border/40',
                  rec.priority === 'high' && 'border-red-200 dark:border-red-800',
                  rec.priority === 'medium' && 'border-amber-200 dark:border-amber-800',
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      {rec.priority === 'high' && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                      {rec.priority === 'medium' && <Shield className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
                      {rec.priority === 'low' && <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                      <div>
                        <p className="text-sm font-semibold">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.body}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0 ml-auto capitalize">{rec.priority}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* At Risk */}
          {insights.at_risk.length > 0 && (
            <div className="space-y-2">
              <p className="section-header"><AlertTriangle className="h-3 w-3" /> Students Needing Support</p>
              {insights.at_risk.map((s, i) => (
                <Card key={i} className="border-border/40">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold',
                      s.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    )}>
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.reason}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[9px]',
                      s.severity === 'high' ? 'border-red-300 text-red-600' : 'border-amber-300 text-amber-600'
                    )}>
                      {s.severity}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Reinforcement Gaps */}
          {insights.reinforcement_gaps.length > 0 && (
            <div className="space-y-2">
              <p className="section-header"><Zap className="h-3 w-3" /> Reinforcement Gaps</p>
              {insights.reinforcement_gaps.map((g, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                    {g.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm flex-1">{g.name}</span>
                  <Badge variant="outline" className={cn('text-[10px]',
                    g.gap_minutes > 60 ? 'border-red-300 text-red-600' : 'border-amber-300 text-amber-600'
                  )}>
                    {g.gap_minutes}min gap
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Top Performers */}
          {insights.top_performers.length > 0 && (
            <div className="space-y-2">
              <p className="section-header"><Star className="h-3 w-3" /> Top Performers</p>
              {insights.top_performers.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2">
                  <span className={cn('text-sm font-bold w-5 text-center tabular-nums',
                    i === 0 && 'text-amber-500', i === 1 && 'text-slate-400', i === 2 && 'text-orange-400'
                  )}>{i + 1}</span>
                  <span className="text-sm flex-1 font-medium">{s.name}</span>
                  <Badge variant="outline" className="text-[10px] tabular-nums">⭐ {s.points}</Badge>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClassroomInsights;
