/**
 * useUndoAction — Provides a timed undo capability for recent actions.
 * Creates reversal rows in beacon_points_ledger instead of deleting.
 */
import { useState, useCallback, useRef } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

export interface UndoableAction {
  id: string;
  label: string;
  studentId: string;
  studentName: string;
  /** The ledger row id to reverse */
  ledgerRowId?: string;
  /** Points that were awarded (positive or negative) */
  points: number;
  /** Agency context */
  agencyId: string;
  staffId: string;
  /** Timestamp of the action */
  timestamp: number;
  /** Whether this has been undone */
  undone: boolean;
}

const UNDO_WINDOW_MS = 15_000; // 15 seconds

export function useUndoAction() {
  const [pendingAction, setPendingAction] = useState<UndoableAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushAction = useCallback((action: Omit<UndoableAction, 'timestamp' | 'undone'>) => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    const full: UndoableAction = { ...action, timestamp: Date.now(), undone: false };
    setPendingAction(full);

    // Auto-dismiss after window
    timerRef.current = setTimeout(() => {
      setPendingAction(prev => (prev?.id === full.id ? null : prev));
    }, UNDO_WINDOW_MS);
  }, []);

  const undoAction = useCallback(async (): Promise<boolean> => {
    if (!pendingAction || pendingAction.undone) return false;

    // Insert reversal row into beacon_points_ledger
    const reversalPoints = -pendingAction.points;
    const { error } = await cloudSupabase.from('beacon_points_ledger').insert({
      student_id: pendingAction.studentId,
      staff_id: pendingAction.staffId,
      agency_id: pendingAction.agencyId,
      points: reversalPoints,
      source: 'undo',
      reason: `Undo: ${pendingAction.label}`,
      is_reversal: true,
      reversal_of_ledger_id: pendingAction.ledgerRowId || null,
      entry_kind: 'reversal',
    } as any);

    if (error) {
      console.warn('[Undo] reversal insert failed:', error.message);
      return false;
    }

    setPendingAction(prev => prev ? { ...prev, undone: true } : null);

    // Clear after brief display
    setTimeout(() => {
      setPendingAction(prev => (prev?.undone ? null : prev));
    }, 2000);

    return true;
  }, [pendingAction]);

  const dismissAction = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingAction(null);
  }, []);

  const timeRemaining = pendingAction
    ? Math.max(0, UNDO_WINDOW_MS - (Date.now() - pendingAction.timestamp))
    : 0;

  return { pendingAction, pushAction, undoAction, dismissAction, timeRemaining };
}
