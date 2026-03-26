/**
 * TrackRenderers — SVG track shape generators for different track types.
 * Each returns an SVG path string and node positions for avatar placement.
 */
import type { TrackNode } from '@/hooks/useGameTrack';

export type TrackType = 'curved' | 'zigzag' | 'map' | 'board_nodes' | 'lanes' | 'depth_track';
export type MovementStyle = 'glide' | 'bounce' | 'dash' | 'float';

// ── Node generators for each track type ──

/** Generate zigzag nodes across width */
export function generateZigzagNodes(count: number = 8): TrackNode[] {
  const nodes: TrackNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * 90 + 5;
    const y = i % 2 === 0 ? 25 : 75;
    nodes.push({ x, y });
  }
  return nodes;
}

/** Generate map-style winding nodes */
export function generateMapNodes(): TrackNode[] {
  return [
    { x: 5, y: 85 }, { x: 25, y: 65 }, { x: 15, y: 40 },
    { x: 35, y: 20 }, { x: 55, y: 35 }, { x: 45, y: 60 },
    { x: 65, y: 80 }, { x: 85, y: 55 }, { x: 75, y: 25 },
    { x: 95, y: 15 },
  ];
}

/** Generate board-game-style grid nodes (snaking rows) */
export function generateBoardNodes(cols: number = 5, rows: number = 4): TrackNode[] {
  const nodes: TrackNode[] = [];
  const marginX = 10, marginY = 15;
  const stepX = (100 - marginX * 2) / (cols - 1);
  const stepY = (100 - marginY * 2) / (rows - 1);
  for (let r = rows - 1; r >= 0; r--) {
    const isReverse = (rows - 1 - r) % 2 === 1;
    for (let c = 0; c < cols; c++) {
      const col = isReverse ? (cols - 1 - c) : c;
      nodes.push({ x: marginX + col * stepX, y: marginY + r * stepY });
    }
  }
  return nodes;
}

/** Generate lane-style parallel horizontal nodes */
export function generateLaneNodes(laneCount: number = 3): TrackNode[] {
  // Just returns a single-lane path; actual lanes rendered separately
  const nodes: TrackNode[] = [];
  for (let i = 0; i <= 10; i++) {
    nodes.push({ x: (i / 10) * 90 + 5, y: 50 });
  }
  return nodes;
}

/** Generate depth track (perspective diminishing) */
export function generateDepthNodes(): TrackNode[] {
  return [
    { x: 10, y: 90 }, { x: 20, y: 75 }, { x: 30, y: 62 },
    { x: 40, y: 52 }, { x: 50, y: 44 }, { x: 60, y: 38 },
    { x: 70, y: 33 }, { x: 80, y: 29 }, { x: 90, y: 26 },
  ];
}

// ── SVG Path generators ──

/** Zigzag sharp-angled path */
export function generateZigzagPath(nodes: TrackNode[], w: number, h: number): string {
  if (nodes.length < 2) return '';
  const pts = nodes.map(n => ({ x: (n.x / 100) * w, y: (n.y / 100) * h }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

/** Board-game snake path with rounded corners */
export function generateBoardPath(nodes: TrackNode[], w: number, h: number): string {
  if (nodes.length < 2) return '';
  const pts = nodes.map(n => ({ x: (n.x / 100) * w, y: (n.y / 100) * h }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const cpx = (curr.x + next.x) / 2;
    d += ` Q ${cpx} ${curr.y}, ${next.x} ${next.y}`;
  }
  return d;
}

/** Lane-style parallel paths */
export function generateLanePaths(w: number, h: number, laneCount: number = 3): string[] {
  const paths: string[] = [];
  const margin = 20;
  const spacing = (h - margin * 2) / (laneCount - 1 || 1);
  for (let lane = 0; lane < laneCount; lane++) {
    const y = margin + lane * spacing;
    paths.push(`M ${w * 0.05} ${y} L ${w * 0.95} ${y}`);
  }
  return paths;
}

/** Depth track — perspective path with scale hints */
export function generateDepthPath(nodes: TrackNode[], w: number, h: number): string {
  if (nodes.length < 2) return '';
  const pts = nodes.map(n => ({ x: (n.x / 100) * w, y: (n.y / 100) * h }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const cpx1 = curr.x + (next.x - curr.x) * 0.5;
    const cpy1 = curr.y;
    const cpx2 = next.x - (next.x - curr.x) * 0.3;
    const cpy2 = next.y;
    d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${next.x} ${next.y}`;
  }
  return d;
}

// ── Get fallback nodes for a track type ──

export function getFallbackNodes(trackType: TrackType): TrackNode[] {
  switch (trackType) {
    case 'zigzag': return generateZigzagNodes();
    case 'map': return generateMapNodes();
    case 'board_nodes': return generateBoardNodes();
    case 'lanes': return generateLaneNodes();
    case 'depth_track': return generateDepthNodes();
    case 'curved':
    default:
      return [
        { x: 5, y: 80 }, { x: 20, y: 30 }, { x: 40, y: 70 },
        { x: 60, y: 25 }, { x: 80, y: 60 }, { x: 95, y: 20 },
      ];
  }
}

/** Generate the SVG path for any track type */
export function generateTrackPath(
  trackType: TrackType,
  nodes: TrackNode[],
  w: number,
  h: number,
): string {
  switch (trackType) {
    case 'zigzag':
      return generateZigzagPath(nodes, w, h);
    case 'board_nodes':
      return generateBoardPath(nodes, w, h);
    case 'depth_track':
      return generateDepthPath(nodes, w, h);
    case 'map':
    case 'curved':
    default: {
      // Use smooth curved path (same as existing)
      if (nodes.length < 2) return '';
      const pts = nodes.map(n => ({ x: (n.x / 100) * w, y: (n.y / 100) * h }));
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
  }
}

// ── Movement style CSS/animation config ──

export interface MovementConfig {
  duration: number;  // ms
  easing: string;    // CSS-like label
  yOffset: number;   // vertical bounce offset
  scaleEffect: boolean;
}

export function getMovementConfig(style: MovementStyle): MovementConfig {
  switch (style) {
    case 'bounce':
      return { duration: 700, easing: 'bounce', yOffset: -8, scaleEffect: true };
    case 'dash':
      return { duration: 400, easing: 'ease-out', yOffset: 0, scaleEffect: false };
    case 'float':
      return { duration: 1400, easing: 'ease-in-out', yOffset: -4, scaleEffect: false };
    case 'glide':
    default:
      return { duration: 900, easing: 'ease-in-out', yOffset: 0, scaleEffect: false };
  }
}

/** Get depth scale factor (1.0 at bottom/near, 0.5 at top/far) */
export function getDepthScale(progress: number, trackType: TrackType): number {
  if (trackType !== 'depth_track') return 1;
  return 1.0 - progress * 0.45; // 1.0 → 0.55
}

/** Get shadow intensity for depth effect */
export function getDepthShadow(progress: number, trackType: TrackType): number {
  if (trackType !== 'depth_track') return 0.18;
  return 0.25 - progress * 0.15; // more shadow near, less far
}
