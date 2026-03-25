/**
 * useGameEvents — Subscribes to game_events via Supabase Realtime.
 * Returns active visual effects keyed by student_id.
 *
 * Event types → animation mapping:
 *   points_awarded  → bounce / glow
 *   points_deducted → shake / dim
 *   checkpoint_hit  → ring pulse
 *   level_up        → burst / confetti
 *   reward_ready    → sparkle
 *   reward_redeemed → card flash
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GameEventType =
  | 'points_awarded'
  | 'points_deducted'
  | 'checkpoint_hit'
  | 'level_up'
  | 'reward_ready'
  | 'reward_redeemed';

export type AnimationEffect =
  | 'bounce'
  | 'shake'
  | 'ring-pulse'
  | 'burst'
  | 'sparkle'
  | 'card-flash';

const EVENT_TO_ANIMATION: Record<GameEventType, AnimationEffect> = {
  points_awarded: 'bounce',
  points_deducted: 'shake',
  checkpoint_hit: 'ring-pulse',
  level_up: 'burst',
  reward_ready: 'sparkle',
  reward_redeemed: 'card-flash',
};

const EFFECT_DURATION_MS: Record<AnimationEffect, number> = {
  bounce: 1200,
  shake: 800,
  'ring-pulse': 1500,
  burst: 2000,
  sparkle: 1800,
  'card-flash': 1000,
};

export interface ActiveEffect {
  effect: AnimationEffect;
  eventType: GameEventType;
  studentId: string;
  expiresAt: number;
}

interface UseGameEventsOptions {
  classroomId?: string | null;
  agencyId?: string;
  enabled?: boolean;
}

export function useGameEvents({ classroomId, agencyId, enabled = true }: UseGameEventsOptions) {
  const [activeEffects, setActiveEffects] = useState<Record<string, ActiveEffect>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearEffect = useCallback((studentId: string) => {
    setActiveEffects(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('game-events-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          ...(classroomId ? { filter: `classroom_id=eq.${classroomId}` } : {}),
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;

          // Scope check: if we have agencyId, ensure match
          if (agencyId && row.agency_id !== agencyId) return;

          const eventType = row.event_type as GameEventType;
          const animation = EVENT_TO_ANIMATION[eventType];
          if (!animation) return;

          const studentId = row.student_id as string;
          if (!studentId) return;

          const duration = EFFECT_DURATION_MS[animation];

          // Set effect
          setActiveEffects(prev => ({
            ...prev,
            [studentId]: {
              effect: animation,
              eventType,
              studentId,
              expiresAt: Date.now() + duration,
            },
          }));

          // Clear any existing timer for this student
          const existing = timersRef.current.get(studentId);
          if (existing) clearTimeout(existing);

          // Auto-clear after duration
          const timer = setTimeout(() => {
            clearEffect(studentId);
            timersRef.current.delete(studentId);
          }, duration);
          timersRef.current.set(studentId, timer);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [enabled, classroomId, agencyId, clearEffect]);

  const getEffect = useCallback(
    (studentId: string): ActiveEffect | null => activeEffects[studentId] || null,
    [activeEffects],
  );

  const hasEffect = useCallback(
    (studentId: string): boolean => !!activeEffects[studentId],
    [activeEffects],
  );

  return { activeEffects, getEffect, hasEffect };
}
