/**
 * Avatar animation state model.
 * Maps game events and point changes to CSS animation classes.
 * All animations are pure CSS — no heavy libraries.
 */

export type AvatarAnimState =
  | 'idle'
  | 'move'
  | 'boost'
  | 'level_up'
  | 'reward_ready'
  | 'shake';

export interface AvatarAnimConfig {
  className: string;
  duration: number; // ms
  svgEffect?: 'glow' | 'pulse-ring' | 'sparkle' | 'flash';
}

export const AVATAR_ANIM_CONFIG: Record<AvatarAnimState, AvatarAnimConfig> = {
  idle: { className: '', duration: 0 },
  move: { className: 'animate-avatar-move', duration: 600 },
  boost: { className: 'animate-avatar-boost', duration: 800, svgEffect: 'glow' },
  level_up: { className: 'animate-avatar-level-up', duration: 1200, svgEffect: 'pulse-ring' },
  reward_ready: { className: 'animate-avatar-reward-ready', duration: 1500, svgEffect: 'sparkle' },
  shake: { className: 'animate-avatar-shake', duration: 500 },
};

/** Map game_events event_type to avatar animation state */
export function eventTypeToAnimState(eventType: string): AvatarAnimState {
  switch (eventType) {
    case 'points_awarded': return 'boost';
    case 'points_deducted': return 'shake';
    case 'checkpoint_hit': return 'boost';
    case 'level_up': return 'level_up';
    case 'reward_ready': return 'reward_ready';
    case 'reward_redeemed': return 'boost';
    default: return 'idle';
  }
}

/** Map point change direction to animation state */
export function pointChangeToAnimState(delta: number): AvatarAnimState {
  if (delta > 0) return 'boost';
  if (delta < 0) return 'shake';
  return 'idle';
}
