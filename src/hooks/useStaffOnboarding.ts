/**
 * Hook to manage staff onboarding state.
 * Tracks first login, walkthrough completion, first action, milestones.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface OnboardingState {
  loading: boolean;
  isFirstLogin: boolean;
  welcomeDismissed: boolean;
  walkthroughCompleted: boolean;
  firstActionCompleted: boolean;
  onboardingDay: number;
  totalActions: number;
  lastMilestoneShown: string | null;
}

const MILESTONES = [
  { threshold: 1, key: 'first_use', message: "You're already ahead 👏" },
  { threshold: 3, key: 'consistency', message: "You're getting the hang of this 🔥" },
  { threshold: 10, key: 'daily_user', message: "You're making this smoother for everyone 🤍" },
  { threshold: 25, key: 'pro', message: 'This is helping more than you think.' },
] as const;

export const useStaffOnboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const agencyId = currentWorkspace?.agency_id;

  const [state, setState] = useState<OnboardingState>({
    loading: true,
    isFirstLogin: false,
    welcomeDismissed: false,
    walkthroughCompleted: false,
    firstActionCompleted: false,
    onboardingDay: 1,
    totalActions: 0,
    lastMilestoneShown: null,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user || !agencyId) return;
    loadOnboarding();
  }, [authLoading, user?.id, agencyId]);

  const loadOnboarding = async () => {
    if (authLoading) return;
    if (!user || !agencyId) return;

    // Use raw fetch to avoid type issues with new tables
    const { data, error } = await supabase
      .from('staff_onboarding' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (!data && !error) {
      // Check if user has completed onboarding in ANY agency (cross-agency awareness)
      const { data: anyRecord } = await supabase
        .from('staff_onboarding' as any)
        .select('welcome_dismissed, walkthrough_completed')
        .eq('user_id', user.id)
        .eq('welcome_dismissed', true)
        .maybeSingle();

      const alreadyOnboarded = !!(anyRecord as any)?.welcome_dismissed;

      // Create record for this agency
      await supabase
        .from('staff_onboarding' as any)
        .insert({
          user_id: user.id,
          agency_id: agencyId,
          welcome_dismissed: alreadyOnboarded,
          walkthrough_completed: alreadyOnboarded,
        } as any);

      setState({
        loading: false,
        isFirstLogin: !alreadyOnboarded,
        welcomeDismissed: alreadyOnboarded,
        walkthroughCompleted: alreadyOnboarded,
        firstActionCompleted: false,
        onboardingDay: 1,
        totalActions: 0,
        lastMilestoneShown: null,
      });
      return;
    }

    if (data) {
      const row = data as any;
      const daysSinceFirst = row.first_login_at
        ? Math.max(1, Math.ceil((Date.now() - new Date(row.first_login_at).getTime()) / 86400000))
        : 1;

      const permanentlyDone = (row.welcome_dismissed && row.walkthrough_completed) ?? false;
      setState({
        loading: false,
        isFirstLogin: !row.welcome_dismissed && !row.walkthrough_completed,
        welcomeDismissed: row.welcome_dismissed ?? false,
        walkthroughCompleted: row.walkthrough_completed ?? false,
        firstActionCompleted: row.first_action_completed ?? false,
        onboardingDay: daysSinceFirst,
        totalActions: row.total_actions ?? 0,
        lastMilestoneShown: row.last_milestone_shown,
      });

      // Update last_active
      supabase
        .from('staff_onboarding' as any)
        .update({ last_active_at: new Date().toISOString() } as any)
        .eq('user_id', user.id)
        .eq('agency_id', agencyId)
        .then(() => {});
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  };

  const dismissWelcome = useCallback(async () => {
    if (!user || !agencyId) return;
    setState((s) => ({ ...s, welcomeDismissed: true, isFirstLogin: false }));
    await supabase
      .from('staff_onboarding' as any)
      .update({ welcome_dismissed: true } as any)
      .eq('user_id', user.id)
      .eq('agency_id', agencyId);
  }, [user, agencyId]);

  const completeWalkthrough = useCallback(async () => {
    if (!user || !agencyId) return;
    setState((s) => ({ ...s, walkthroughCompleted: true }));
    await supabase
      .from('staff_onboarding' as any)
      .update({ walkthrough_completed: true } as any)
      .eq('user_id', user.id)
      .eq('agency_id', agencyId);
  }, [user, agencyId]);

  const recordAction = useCallback(async (activityType: string) => {
    if (!user || !agencyId) return null;

    // Log activity
    await supabase
      .from('staff_activity_log' as any)
      .insert({ user_id: user.id, agency_id: agencyId, activity_type: activityType } as any);

    const newTotal = state.totalActions + 1;
    const updates: Record<string, unknown> = {
      total_actions: newTotal,
      last_active_at: new Date().toISOString(),
    };

    if (!state.firstActionCompleted) {
      updates.first_action_completed = true;
      updates.first_action_at = new Date().toISOString();
    }

    // Check milestones
    let newMilestone: string | null = null;
    for (const m of MILESTONES) {
      if (newTotal >= m.threshold && state.lastMilestoneShown !== m.key) {
        const alreadyShown = MILESTONES.findIndex((x) => x.key === state.lastMilestoneShown);
        const thisIndex = MILESTONES.findIndex((x) => x.key === m.key);
        if (thisIndex > alreadyShown) {
          newMilestone = m.key;
          updates.last_milestone_shown = m.key;
          break;
        }
      }
    }

    await supabase
      .from('staff_onboarding' as any)
      .update(updates as any)
      .eq('user_id', user.id)
      .eq('agency_id', agencyId);

    setState((s) => ({
      ...s,
      totalActions: newTotal,
      firstActionCompleted: true,
      lastMilestoneShown: newMilestone || s.lastMilestoneShown,
    }));

    if (!state.firstActionCompleted) {
      return { type: 'first_action' as const };
    }
    if (newMilestone) {
      const milestone = MILESTONES.find((m) => m.key === newMilestone);
      return { type: 'milestone' as const, message: milestone?.message ?? '' };
    }
    return null;
  }, [user, agencyId, state]);

  return {
    ...state,
    dismissWelcome,
    completeWalkthrough,
    recordAction,
    MILESTONES,
  };
};
