/**
 * Staff Engagement Dashboard — admin view for monitoring adoption.
 * Warm colors, no shaming, supportive status labels.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, Zap, TrendingUp } from 'lucide-react';

interface StaffEngagement {
  user_id: string;
  agency_id: string;
  first_login_at: string | null;
  welcome_dismissed: boolean;
  walkthrough_completed: boolean;
  first_action_completed: boolean;
  first_action_at: string | null;
  last_active_at: string | null;
  total_actions: number;
  actions_this_week: number;
  status: 'active' | 'started' | 'needs_support';
  displayName?: string;
}

const STATUS_CONFIG = {
  active: { label: 'Active', className: 'bg-accent/10 text-accent border-accent/20' },
  started: { label: 'Started', className: 'bg-warning/10 text-warning border-warning/20' },
  needs_support: { label: 'Needs Support', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const StaffEngagementDashboard = () => {
  const { currentWorkspace } = useWorkspace();
  const agencyId = currentWorkspace?.agency_id;
  const [staff, setStaff] = useState<StaffEngagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agencyId) return;
    loadEngagement();
  }, [agencyId]);

  const loadEngagement = async () => {
    if (!agencyId) return;
    const { data } = await supabase
      .from('v_staff_engagement' as any)
      .select('*')
      .eq('agency_id', agencyId);

    const rows = (data as any as StaffEngagement[]) || [];
    const userIds = rows.map(r => r.user_id);
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      try { nameMap = await resolveDisplayNames(userIds); } catch { /* silent */ }
    }
    setStaff(rows.map(r => ({ ...r, displayName: nameMap.get(r.user_id) || 'Staff' })));
    setLoading(false);
  };

  const counts = {
    total: staff.length,
    activated: staff.filter((s) => s.first_login_at).length,
    walkthroughDone: staff.filter((s) => s.walkthrough_completed).length,
    firstAction: staff.filter((s) => s.first_action_completed).length,
    activeThisWeek: staff.filter((s) => s.status === 'active').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Staff Engagement</h2>
        <p className="text-sm text-muted-foreground">
          See who's using Beacon — reward, don't punish.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Activated', value: counts.activated, icon: Users, total: counts.total },
          { label: 'Walkthrough', value: counts.walkthroughDone, icon: CheckCircle2, total: counts.total },
          { label: 'First Action', value: counts.firstAction, icon: Zap, total: counts.total },
          { label: 'Active This Week', value: counts.activeThisWeek, icon: TrendingUp, total: counts.total },
        ].map((card) => {
          const Icon = card.icon;
          const pct = counts.total > 0 ? Math.round((card.value / counts.total) * 100) : 0;
          return (
            <Card key={card.label} className="border-border/50">
              <CardContent className="p-4 text-center">
                <Icon className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xs text-primary mt-1">{pct}%</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Staff table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Staff Status</CardTitle>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No staff onboarding data yet. Staff will appear here after they log in.
            </p>
          ) : (
            <div className="space-y-2">
              {staff.map((s) => {
                const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.needs_support;
                return (
                  <div
                    key={s.user_id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/50 bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.displayName || 'Staff'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.total_actions} actions · {s.actions_this_week} this week
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.walkthrough_completed && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusCfg.className}`}
                      >
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
