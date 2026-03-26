/**
 * useGameTrack — Load the active game track with zones, checkpoints, and theme.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

export interface TrackNode {
  x: number;
  y: number;
  label?: string;
}

export interface TrackZone {
  start_pct: number;
  end_pct: number;
  type: 'boost' | 'slow' | 'reward' | 'bonus';
  multiplier: number;
  color: string;
  label: string;
}

export interface TrackCheckpoint {
  progress_pct: number;
  reward_points: number;
  label: string;
}

export interface GameTheme {
  id: string;
  name: string;
  slug: string;
  colors: Record<string, string>;
  assets: Record<string, string>;
  avatar_style: string;
}

export interface GameTrack {
  id: string;
  name: string;
  description: string | null;
  total_steps: number;
  track_type: string;
  nodes: TrackNode[];
  zones: TrackZone[];
  checkpoints: TrackCheckpoint[];
  theme_slug: string | null;
  theme: GameTheme | null;
}

const DEFAULT_NODES: TrackNode[] = [
  { x: 5, y: 80 }, { x: 20, y: 30 }, { x: 40, y: 70 },
  { x: 60, y: 25 }, { x: 80, y: 60 }, { x: 95, y: 20 },
];

export function interpolateOnTrack(progress: number, nodes: TrackNode[]): { x: number; y: number } {
  if (nodes.length < 2) return nodes[0] || { x: 50, y: 50 };
  const clamped = Math.max(0, Math.min(1, progress));
  const totalSegments = nodes.length - 1;
  const segmentProgress = clamped * totalSegments;
  const index = Math.min(Math.floor(segmentProgress), totalSegments - 1);
  const t = segmentProgress - index;
  const start = nodes[index];
  const end = nodes[index + 1] || nodes[index];
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

export function generateSmoothPath(nodes: TrackNode[], width: number, height: number): string {
  if (nodes.length < 2) return '';
  const pts = nodes.map(n => ({ x: (n.x / 100) * width, y: (n.y / 100) * height }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const cpx1 = curr.x + (next.x - curr.x) * 0.4;
    const cpy1 = curr.y;
    const cpx2 = next.x - (next.x - curr.x) * 0.4;
    const cpy2 = next.y;
    d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${next.x} ${next.y}`;
  }
  return d;
}

/** Get zone at a given progress (0..1) */
export function getZoneAtProgress(progress: number, zones: TrackZone[]): TrackZone | null {
  return zones.find(z => progress >= z.start_pct && progress <= z.end_pct) || null;
}

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  return raw as T;
}

export function useGameTrack(groupId: string | null) {
  const [track, setTrack] = useState<GameTrack | null>(null);
  const [allTracks, setAllTracks] = useState<GameTrack[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const { data: settings } = await cloudSupabase
        .from('classroom_game_settings')
        .select('track_id')
        .eq('group_id', groupId)
        .maybeSingle();

      const trackId = (settings as any)?.track_id;

      // Load all tracks for selector
      const { data: allTrackRows } = await cloudSupabase
        .from('game_tracks')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      const parsed = (allTrackRows || []).map((row: any) => buildTrack(row));
      setAllTracks(parsed);

      // Pick active track
      let active = trackId ? parsed.find(t => t.id === trackId) : null;
      if (!active && parsed.length > 0) active = parsed[0];

      if (active) {
        // Load theme if theme_slug set
        if (active.theme_slug) {
          const { data: themeRow } = await cloudSupabase
            .from('game_themes' as any)
            .select('*')
            .eq('slug', active.theme_slug)
            .maybeSingle();
          if (themeRow) {
            active = {
              ...active,
              theme: {
                id: (themeRow as any).id,
                name: (themeRow as any).name,
                slug: (themeRow as any).slug,
                colors: parseJsonField((themeRow as any).colors_json, {}),
                assets: parseJsonField((themeRow as any).assets_json, {}),
                avatar_style: (themeRow as any).avatar_style || 'emoji',
              },
            };
          }
        }
        setTrack(active);
      } else {
        setTrack({
          id: 'default', name: 'Default Track', description: null,
          total_steps: 100, nodes: DEFAULT_NODES,
          zones: [], checkpoints: [], theme_slug: null, theme: null,
        });
      }
    } catch (err) {
      console.warn('[useGameTrack] Failed:', err);
      setTrack({
        id: 'default', name: 'Default Track', description: null,
        total_steps: 100, nodes: DEFAULT_NODES,
        zones: [], checkpoints: [], theme_slug: null, theme: null,
      });
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  return { track, allTracks, loading, refetch: load };
}

function buildTrack(row: any): GameTrack {
  const rawNodes = parseJsonField(row.nodes_json, DEFAULT_NODES);
  const nodes: TrackNode[] = Array.isArray(rawNodes)
    ? rawNodes.map((n: any) => ({ x: n.x ?? 50, y: n.y ?? 50, label: n.label }))
    : DEFAULT_NODES;
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    total_steps: row.total_steps || 100,
    nodes,
    zones: parseJsonField(row.zones_json, []),
    checkpoints: parseJsonField(row.checkpoints_json, []),
    theme_slug: row.theme_slug,
    theme: null,
  };
}
