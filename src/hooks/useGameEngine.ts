/**
 * useGameEngine — Momentum streaks, comeback mechanics, zone multipliers.
 * Reads game_modes config, tracks streaks client-side, records to game_events.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TrackZone } from '@/hooks/useGameTrack';

export interface StreakThreshold {
  count: number;
  multiplier: number;
  label: string;
  emoji: string;
}

export interface MomentumConfig {
  streak_thresholds: StreakThreshold[];
}

export interface ComebackConfig {
  behind_rank_threshold: number;
  bonus_multiplier: number;
  label: string;
  emoji: string;
}

export interface GameModeConfig {
  id: string;
  name: string;
  slug: string;
  momentum: MomentumConfig;
  comeback: ComebackConfig;
  checkpoint_rewards_enabled: boolean;
  max_daily_points: number;
}

export interface FloatingFeedback {
  id: string;
  studentId: string;
  text: string;
  emoji: string;
  type: 'points' | 'streak' | 'boost' | 'checkpoint' | 'comeback' | 'zone';
  expiresAt: number;
}

export interface StudentMomentumStatus {
  studentId: string;
  streak: number;
  activeMultiplier: number;
  label: string | null;
  emoji: string | null;
  hasComeback: boolean;
  status: 'heating_up' | 'on_fire' | 'losing_momentum' | 'close_to_reward' | 'neutral';
}

interface UseGameEngineOptions {
  classroomId?: string | null;
  agencyId?: string;
  modeSlug?: string;
  students?: Array<{ student_id: string; balance: number; rank: number; progress: number }>;
  zones?: TrackZone[];
  enabled?: boolean;
}

const DEFAULT_MOMENTUM: MomentumConfig = {
  streak_thresholds: [
    { count: 3, multiplier: 1.5, label: 'On Fire!', emoji: '🔥' },
    { count: 5, multiplier: 2.0, label: 'Unstoppable!', emoji: '🚀' },
    { count: 10, multiplier: 3.0, label: 'Legendary!', emoji: '💥' },
  ],
};

const DEFAULT_COMEBACK: ComebackConfig = {
  behind_rank_threshold: 3,
  bonus_multiplier: 1.25,
  label: 'Comeback Boost',
  emoji: '💪',
};

const FEEDBACK_DURATION = 2500;

export function useGameEngine({
  classroomId, agencyId, modeSlug = 'race',
  students = [], zones = [], enabled = true,
}: UseGameEngineOptions) {
  const [modeConfig, setModeConfig] = useState<GameModeConfig | null>(null);
  const [feedbacks, setFeedbacks] = useState<FloatingFeedback[]>([]);
  const streaksRef = useRef<Record<string, number>>({});
  const feedbackIdRef = useRef(0);

  // Load game mode config
  useEffect(() => {
    if (!enabled) return;
    supabase
      .from('game_modes' as any)
      .select('*')
      .eq('slug', modeSlug)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          const parse = (v: unknown, fb: any) => {
            if (!v) return fb;
            if (typeof v === 'string') try { return JSON.parse(v); } catch { return fb; }
            return v;
          };
          setModeConfig({
            id: data.id,
            name: data.name,
            slug: data.slug,
            momentum: parse(data.momentum_config_json, DEFAULT_MOMENTUM),
            comeback: parse(data.comeback_config_json, DEFAULT_COMEBACK),
            checkpoint_rewards_enabled: data.checkpoint_rewards_enabled ?? true,
            max_daily_points: data.max_daily_points ?? 500,
          });
        }
      });
  }, [modeSlug, enabled]);

  const addFeedback = useCallback((studentId: string, text: string, emoji: string, type: FloatingFeedback['type']) => {
    const id = `fb-${++feedbackIdRef.current}`;
    const fb: FloatingFeedback = { id, studentId, text, emoji, type, expiresAt: Date.now() + FEEDBACK_DURATION };
    setFeedbacks(prev => [...prev, fb]);
    setTimeout(() => {
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    }, FEEDBACK_DURATION);
  }, []);

  // Record a point event with momentum/zone calculations
  const recordPointEvent = useCallback(async (
    studentId: string, points: number, isPositive: boolean
  ) => {
    if (!agencyId) return points;

    const momentum = modeConfig?.momentum || DEFAULT_MOMENTUM;
    const comeback = modeConfig?.comeback || DEFAULT_COMEBACK;

    // Update streak
    if (isPositive) {
      streaksRef.current[studentId] = (streaksRef.current[studentId] || 0) + 1;
    } else {
      streaksRef.current[studentId] = 0;
    }
    const streak = streaksRef.current[studentId];

    // Calculate momentum multiplier
    let momentumMult = 1;
    let streakLabel: StreakThreshold | null = null;
    for (const t of [...momentum.streak_thresholds].sort((a, b) => b.count - a.count)) {
      if (streak >= t.count) { momentumMult = t.multiplier; streakLabel = t; break; }
    }

    // Check zone multiplier
    const student = students.find(s => s.student_id === studentId);
    let zoneMult = 1;
    let activeZone: TrackZone | null = null;
    if (student && zones.length > 0) {
      activeZone = zones.find(z => student.progress >= z.start_pct && student.progress <= z.end_pct) || null;
      if (activeZone) zoneMult = activeZone.multiplier;
    }

    // Check comeback
    let comebackMult = 1;
    if (student && student.rank >= comeback.behind_rank_threshold) {
      comebackMult = comeback.bonus_multiplier;
    }

    const totalMult = momentumMult * zoneMult * comebackMult;
    const finalPoints = Math.round(points * totalMult);

    // Emit floating feedback
    addFeedback(studentId, `+${finalPoints} ⭐`, '⭐', 'points');
    if (streakLabel && streak === streakLabel.count) {
      addFeedback(studentId, `${streakLabel.emoji} ${streakLabel.label} ${streakLabel.multiplier}x`, streakLabel.emoji, 'streak');
    }
    if (activeZone) {
      addFeedback(studentId, `${activeZone.label}!`, '🎯', 'zone');
    }
    if (comebackMult > 1) {
      addFeedback(studentId, `${comeback.emoji} ${comeback.label}`, comeback.emoji, 'comeback');
    }

    // Write game_event
    try {
      await supabase.from('game_events' as any).insert({
        agency_id: agencyId,
        classroom_id: classroomId,
        student_id: studentId,
        event_type: isPositive ? 'points_awarded' : 'points_deducted',
        zone_type: activeZone?.type || null,
        multiplier_applied: totalMult,
        streak_count: streak,
        is_checkpoint: false,
        payload: { base_points: points, final_points: finalPoints, momentum: momentumMult, zone: zoneMult, comeback: comebackMult },
      });
    } catch (e) { console.warn('[useGameEngine] Event write failed:', e); }

    return finalPoints;
  }, [agencyId, classroomId, modeConfig, students, zones, addFeedback]);

  // Record checkpoint hit
  const recordCheckpoint = useCallback(async (studentId: string, checkpointLabel: string, rewardPoints: number) => {
    if (!agencyId || !modeConfig?.checkpoint_rewards_enabled) return;
    addFeedback(studentId, `🎁 ${checkpointLabel}! +${rewardPoints}`, '🎁', 'checkpoint');
    try {
      await supabase.from('game_events' as any).insert({
        agency_id: agencyId,
        classroom_id: classroomId,
        student_id: studentId,
        event_type: 'checkpoint_hit',
        is_checkpoint: true,
        payload: { label: checkpointLabel, reward_points: rewardPoints },
      });
    } catch (e) { console.warn('[useGameEngine] Checkpoint write failed:', e); }
  }, [agencyId, classroomId, modeConfig, addFeedback]);

  // Compute per-student momentum status for teacher sidebar
  const studentStatuses: Record<string, StudentMomentumStatus> = {};
  for (const s of students) {
    const streak = streaksRef.current[s.student_id] || 0;
    const momentum = modeConfig?.momentum || DEFAULT_MOMENTUM;
    const comeback = modeConfig?.comeback || DEFAULT_COMEBACK;
    let activeMultiplier = 1;
    let label: string | null = null;
    let emoji: string | null = null;
    for (const t of [...momentum.streak_thresholds].sort((a, b) => b.count - a.count)) {
      if (streak >= t.count) { activeMultiplier = t.multiplier; label = t.label; emoji = t.emoji; break; }
    }
    const hasComeback = s.rank >= comeback.behind_rank_threshold;
    let status: StudentMomentumStatus['status'] = 'neutral';
    if (streak >= 5) status = 'on_fire';
    else if (streak >= 2) status = 'heating_up';
    else if (s.progress > 0.8) status = 'close_to_reward';

    studentStatuses[s.student_id] = {
      studentId: s.student_id, streak, activeMultiplier,
      label, emoji, hasComeback, status,
    };
  }

  return {
    modeConfig,
    feedbacks,
    studentStatuses,
    recordPointEvent,
    recordCheckpoint,
  };
}
