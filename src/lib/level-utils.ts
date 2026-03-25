/**
 * Level/XP utility functions for Beacon game system.
 * Thresholds match the DB trigger in update_student_xp_on_points().
 */

/** XP required to advance FROM this level to the next */
export const LEVEL_THRESHOLDS = [20, 30, 50, 80, 120, 170, 230, 300, 380, 470];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length + 1; // 11

/** Get the XP needed to level up from current level */
export function xpForNextLevel(level: number): number {
  if (level < 1) return LEVEL_THRESHOLDS[0];
  if (level > LEVEL_THRESHOLDS.length) return Infinity; // max level
  return LEVEL_THRESHOLDS[level - 1];
}

/** Get XP progress as a percentage (0–100) */
export function xpProgressPct(xp: number, level: number): number {
  const needed = xpForNextLevel(level);
  if (needed === Infinity) return 100;
  return Math.min(100, Math.round((xp / needed) * 100));
}

/** Get a label for the level (e.g. "Lv 3") */
export function levelLabel(level: number): string {
  return `Lv ${level}`;
}

/** Level badge color based on level tier */
export function levelColor(level: number): string {
  if (level >= 8) return 'text-amber-500'; // gold
  if (level >= 5) return 'text-purple-500'; // purple
  if (level >= 3) return 'text-blue-500'; // blue
  return 'text-muted-foreground'; // starter
}

/** Level badge bg color */
export function levelBgColor(level: number): string {
  if (level >= 8) return 'bg-amber-500/10 border-amber-500/30';
  if (level >= 5) return 'bg-purple-500/10 border-purple-500/30';
  if (level >= 3) return 'bg-blue-500/10 border-blue-500/30';
  return 'bg-muted/50 border-border/50';
}
