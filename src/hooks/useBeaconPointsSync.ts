/**
 * useBeaconPointsSync — Shared realtime subscription for beacon_points_ledger.
 * Provides consistent balance updates across all views (classroom, game, rewards, portal).
 * Single source of truth: beacon_points_ledger via v_student_points_balance view.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { getStudentBalances } from '@/lib/beacon-points';

interface UseBeaconPointsSyncOptions {
  /** User ID for balance queries */
  userId: string | undefined;
  /** Student IDs to track */
  studentIds: string[];
  /** Channel name suffix for unique subscriptions */
  channelKey?: string;
  /** Callback when balances change */
  onBalancesUpdate?: (balances: Record<string, number>) => void;
}

export function useBeaconPointsSync({
  userId,
  studentIds,
  channelKey = 'default',
  onBalancesUpdate,
}: UseBeaconPointsSyncOptions) {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!userId || studentIds.length === 0) return;

    // Debounce: don't refetch if we just fetched < 500ms ago
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;

    setLoading(true);
    const bals = await getStudentBalances(userId, studentIds);
    setBalances(bals);
    onBalancesUpdate?.(bals);
    setLoading(false);
  }, [userId, studentIds.join(','), onBalancesUpdate]);

  // Initial load
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Realtime subscription
  useEffect(() => {
    if (!userId || studentIds.length === 0) return;

    const channel = cloudSupabase
      .channel(`beacon-points-sync-${channelKey}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'beacon_points_ledger',
      }, (payload: any) => {
        const sid = payload.new?.student_id;
        if (sid && studentIds.includes(sid)) {
          // Debounce rapid inserts (e.g. bulk award)
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            fetchBalances();
          }, 300);
        }
      })
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      cloudSupabase.removeChannel(channel);
    };
  }, [userId, studentIds.join(','), channelKey, fetchBalances]);

  /** Optimistic update — apply delta immediately, will reconcile on next realtime event */
  const applyOptimistic = useCallback((studentId: string, delta: number) => {
    setBalances(prev => {
      const updated = { ...prev, [studentId]: (prev[studentId] || 0) + delta };
      onBalancesUpdate?.(updated);
      return updated;
    });
  }, [onBalancesUpdate]);

  /** Rollback optimistic update */
  const rollbackOptimistic = useCallback((studentId: string, delta: number) => {
    setBalances(prev => {
      const updated = { ...prev, [studentId]: (prev[studentId] || 0) - delta };
      onBalancesUpdate?.(updated);
      return updated;
    });
  }, [onBalancesUpdate]);

  return {
    balances,
    loading,
    refetch: fetchBalances,
    applyOptimistic,
    rollbackOptimistic,
  };
}
