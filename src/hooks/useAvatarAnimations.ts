/**
 * useAvatarAnimations — Tracks per-student animation states.
 * Driven by game_events realtime subscription.
 * Returns current animation state per student for rendering.
 */
import { useState, useCallback, useRef } from 'react';
import { type AvatarAnimState, AVATAR_ANIM_CONFIG, eventTypeToAnimState } from '@/lib/avatar-animations';

interface AnimEntry {
  state: AvatarAnimState;
  expiresAt: number;
}

export function useAvatarAnimations() {
  const [animations, setAnimations] = useState<Record<string, AnimEntry>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const triggerAnimation = useCallback((studentId: string, state: AvatarAnimState) => {
    if (state === 'idle') return;
    const config = AVATAR_ANIM_CONFIG[state];
    const expiresAt = Date.now() + config.duration;

    setAnimations(prev => ({
      ...prev,
      [studentId]: { state, expiresAt },
    }));

    // Clear existing timer
    const existing = timersRef.current.get(studentId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setAnimations(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      timersRef.current.delete(studentId);
    }, config.duration);
    timersRef.current.set(studentId, timer);
  }, []);

  const triggerFromEvent = useCallback((studentId: string, eventType: string) => {
    const state = eventTypeToAnimState(eventType);
    triggerAnimation(studentId, state);
  }, [triggerAnimation]);

  const getAnimState = useCallback((studentId: string): AvatarAnimState => {
    return animations[studentId]?.state || 'idle';
  }, [animations]);

  return { animations, triggerAnimation, triggerFromEvent, getAnimState };
}
