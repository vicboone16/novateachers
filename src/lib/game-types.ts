/**
 * Game layer types for Beacon — reads from Core-owned Phase 5 tables.
 * These types map to tables on the external Core instance.
 */

export interface GameMode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_emoji: string;
  config: Record<string, any>;
  is_active: boolean;
}

export interface GameTheme {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  preview_emoji: string;
  color_primary: string;
  color_accent: string;
  color_bg: string;
  is_active: boolean;
}

export interface ClassroomGameSettings {
  id: string;
  group_id: string;
  agency_id: string;
  game_mode: string;
  mode_id: string | null;
  theme_id: string | null;
  track_id: string | null;
  show_avatars: boolean;
  show_leaderboard: boolean;
  allow_team_mode: boolean;
  total_steps: number;
  created_at: string;
  updated_at: string;
}

export interface ClassroomTeam {
  id: string;
  group_id: string;
  team_name: string;
  team_color: string;
  team_icon: string;
  created_at: string;
}

export interface StudentTeamAssignment {
  id: string;
  student_id: string;
  team_id: string;
  group_id: string;
  created_at: string;
}

export interface StudentGameProfile {
  id: string;
  student_id: string;
  agency_id: string;
  avatar_emoji: string;
  avatar_items: Record<string, string>;
  current_level: number;
  current_xp: number;
  portal_enabled: boolean;
  login_mode: 'code' | 'qr' | 'teacher_issued';
  created_at: string;
  updated_at: string;
}

export interface StudentGameState {
  id: string;
  student_id: string;
  group_id: string;
  game_mode_id: string | null;
  track_position: number;
  checkpoints_reached: number;
  last_move_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnlockCatalogItem {
  id: string;
  agency_id: string | null;
  unlock_type: 'avatar_item' | 'trail_effect' | 'badge' | 'reward_access';
  unlock_key: string;
  name: string;
  description: string | null;
  icon_emoji: string;
  points_required: number;
  level_required: number;
  is_active: boolean;
}

export interface StudentUnlock {
  id: string;
  student_id: string;
  unlock_id: string;
  unlocked_at: string;
  is_active: boolean;
}

export interface StudentStreak {
  id: string;
  student_id: string;
  streak_type: string;
  current_count: number;
  best_count: number;
  last_activity_date: string;
  created_at: string;
}

export interface StudentLoginCode {
  id: string;
  student_id: string;
  agency_id: string;
  login_code: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface ClassroomPublicLink {
  id: string;
  group_id: string;
  agency_id: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

// View types
export interface StudentGameProgress {
  student_id: string;
  group_id: string;
  first_name: string;
  last_name: string;
  avatar_emoji: string;
  track_position: number;
  checkpoints_reached: number;
  current_level: number;
  current_xp: number;
  points_balance: number;
  team_id: string | null;
  team_name: string | null;
  team_color: string | null;
}

export interface TeamScore {
  team_id: string;
  team_name: string;
  team_color: string;
  team_icon: string;
  total_points: number;
  member_count: number;
}

// Point display config
export const POINT_SKINS: Record<string, { icon: string; label: string; plural: string }> = {
  stars: { icon: '⭐', label: 'Star', plural: 'Stars' },
  coins: { icon: '🪙', label: 'Coin', plural: 'Coins' },
  xp: { icon: '⚡', label: 'XP', plural: 'XP' },
  energy: { icon: '🔋', label: 'Energy', plural: 'Energy' },
};
