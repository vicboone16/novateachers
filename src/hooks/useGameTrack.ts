/**
 * useGameTrack — Load the active game track (nodes_json) for a classroom.
 * Resolves track_id from classroom_game_settings, then loads from game_tracks.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

export interface TrackNode {
  x: number; // percent 0-100
  y: number; // percent 0-100
  label?: string;
}

export interface GameTrack {
  id: string;
  name: string;
  total_steps: number;
  nodes: TrackNode[];
  theme_slug: string | null;
}

/** Default fallback track if none configured */
const DEFAULT_NODES: TrackNode[] = [
  { x: 5, y: 80 },
  { x: 20, y: 30 },
  { x: 40, y: 70 },
  { x: 60, y: 25 },
  { x: 80, y: 60 },
  { x: 95, y: 20 },
];

/**
 * Interpolate position along a polyline defined by nodes.
 * progress: 0..1 (0 = start, 1 = finish)
 * Returns { x, y } in percent coordinates.
 */
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

/**
 * Generate an SVG path string (smooth cubic bezier) through nodes.
 */
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

export function useGameTrack(groupId: string | null) {
  const [track, setTrack] = useState<GameTrack | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      // 1. Get track_id from classroom_game_settings
      const { data: settings } = await cloudSupabase
        .from('classroom_game_settings')
        .select('track_id')
        .eq('group_id', groupId)
        .maybeSingle();

      const trackId = (settings as any)?.track_id;

      // 2. Load the track (by ID or fallback to first preset)
      let trackRow: any = null;
      if (trackId) {
        const { data } = await cloudSupabase
          .from('game_tracks')
          .select('*')
          .eq('id', trackId)
          .maybeSingle();
        trackRow = data;
      }

      if (!trackRow) {
        // Fallback: load first available track
        const { data } = await cloudSupabase
          .from('game_tracks')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        trackRow = data;
      }

      if (trackRow) {
        const rawNodes = typeof trackRow.nodes_json === 'string'
          ? JSON.parse(trackRow.nodes_json)
          : trackRow.nodes_json;

        const nodes: TrackNode[] = Array.isArray(rawNodes)
          ? rawNodes.map((n: any) => ({ x: n.x ?? 50, y: n.y ?? 50, label: n.label }))
          : DEFAULT_NODES;

        setTrack({
          id: trackRow.id,
          name: trackRow.name,
          total_steps: trackRow.total_steps || 100,
          nodes,
          theme_slug: trackRow.theme_slug,
        });
      } else {
        // Use hardcoded default
        setTrack({
          id: 'default',
          name: 'Default Track',
          total_steps: 100,
          nodes: DEFAULT_NODES,
          theme_slug: null,
        });
      }
    } catch (err) {
      console.warn('[useGameTrack] Failed to load track:', err);
      setTrack({
        id: 'default',
        name: 'Default Track',
        total_steps: 100,
        nodes: DEFAULT_NODES,
        theme_slug: null,
      });
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  return { track, loading, refetch: load };
}
