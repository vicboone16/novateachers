/**
 * CurvedTrackBoard — Multi-track SVG board with zones, checkpoints,
 * smooth avatar movement, depth effects, and multiple track types.
 */
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { interpolateOnTrack, generateSmoothPath, type TrackNode, type TrackZone, type TrackCheckpoint, type GameTheme } from '@/hooks/useGameTrack';
import { generateTrackPath, getDepthScale, getDepthShadow, getMovementConfig, getFallbackNodes, type TrackType, type MovementStyle } from '@/components/TrackRenderers';
import { FloatingFeedbackOverlay } from '@/components/FloatingFeedback';
import type { FloatingFeedback } from '@/hooks/useGameEngine';
import { cn } from '@/lib/utils';
import type { AnimationEffect } from '@/hooks/useGameEvents';
import { SvgAvatarEffect } from '@/components/AnimatedAvatar';
import type { AvatarAnimState } from '@/lib/avatar-animations';

interface StudentPosition {
  student_id: string;
  avatar_emoji: string;
  name: string;
  progress: number;
  balance: number;
  laps: number;
  isFlashing: boolean;
  teamColor?: string | null;
  activeEffect?: AnimationEffect | null;
  avatarAnimState?: AvatarAnimState;
  hasComeback?: boolean;
  streakEmoji?: string | null;
  activeZone?: { type: string; color: string; label: string; multiplier: number } | null;
}

interface Props {
  nodes: TrackNode[];
  totalSteps: number;
  students: StudentPosition[];
  zones?: TrackZone[];
  checkpoints?: TrackCheckpoint[];
  theme?: GameTheme | null;
  feedbacks?: FloatingFeedback[];
  className?: string;
  trackType?: TrackType;
  movementStyle?: MovementStyle;
}

/** Deterministic offset so overlapping avatars don't stack */
function jitter(studentId: string, index: number): { dx: number; dy: number } {
  const hash = studentId.charCodeAt(0) + studentId.charCodeAt(studentId.length - 1) + index;
  const angle = (hash % 12) * (Math.PI / 6);
  const radius = 12 + (hash % 8);
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

/** Animated avatar group — uses requestAnimationFrame for smooth movement */
function AnimatedAvatarGroup({
  sp,
  targetCx,
  targetCy,
  distanceToFinish,
  movementStyle = 'glide',
  depthScale = 1,
}: {
  sp: StudentPosition;
  targetCx: number;
  targetCy: number;
  distanceToFinish: number;
  movementStyle?: MovementStyle;
  depthScale?: number;
}) {
  const gRef = useRef<SVGGElement>(null);
  const posRef = useRef({ x: targetCx, y: targetCy });
  const animRef = useRef<number>(0);

  const moveConfig = getMovementConfig(movementStyle || 'glide');

  useEffect(() => {
    const startX = posRef.current.x;
    const startY = posRef.current.y;
    const dx = targetCx - startX;
    const dy = targetCy - startY;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      posRef.current = { x: targetCx, y: targetCy };
      if (gRef.current) gRef.current.setAttribute('transform', `translate(${targetCx},${targetCy}) scale(${depthScale})`);
      return;
    }
    const duration = moveConfig.duration;
    let start: number | null = null;
    cancelAnimationFrame(animRef.current);

    const step = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const raw = Math.min(elapsed / duration, 1);
      // Easing based on movement style
      let t: number;
      if (movementStyle === 'bounce') {
        // Bounce easing
        if (raw < 0.5) {
          t = 4 * raw * raw * raw;
        } else {
          const br = raw - 0.5;
          t = 0.5 + 0.5 * (1 - Math.pow(1 - br * 2, 3));
          // Add vertical bounce
        }
      } else if (movementStyle === 'dash') {
        // Quick ease-out
        t = 1 - Math.pow(1 - raw, 4);
      } else if (movementStyle === 'float') {
        // Sine ease
        t = (1 - Math.cos(raw * Math.PI)) / 2;
      } else {
        // Glide: ease-in-out cubic
        t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      }
      const cx = startX + dx * t;
      let cy = startY + dy * t;
      // Bounce Y offset
      if (movementStyle === 'bounce' && raw > 0.4 && raw < 0.9) {
        cy += moveConfig.yOffset * Math.sin((raw - 0.4) / 0.5 * Math.PI);
      }
      // Float Y wobble
      if (movementStyle === 'float') {
        cy += Math.sin(raw * Math.PI * 3) * 2;
      }
      posRef.current = { x: cx, y: cy };
      if (gRef.current) gRef.current.setAttribute('transform', `translate(${cx},${cy}) scale(${depthScale})`);
      if (raw < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [targetCx, targetCy, depthScale]);

  const nearFinish = sp.progress > 0.85;
  const eff = sp.activeEffect;
  const isBounce = eff === 'bounce';
  const isShake = eff === 'shake';
  const isRingPulse = eff === 'ring-pulse';
  const isBurst = eff === 'burst';
  const isSparkle = eff === 'sparkle';
  const isCardFlash = eff === 'card-flash';
  const isFlame = eff === 'flame';
  const isTeamPulse = eff === 'team-pulse';
  const isDimmed = isShake;

  return (
    <g ref={gRef} transform={`translate(${targetCx},${targetCy})`}>
      {/* Animation state from avatar-animations hook */}
      {sp.avatarAnimState && sp.avatarAnimState !== 'idle' && (
        <SvgAvatarEffect state={sp.avatarAnimState} />
      )}

      {/* Shadow ellipse */}
      <ellipse cx={0} cy={6} rx={14} ry={4} fill="black" opacity="0.10" />

      {/* Near-finish glow */}
      {nearFinish && (
        <circle cx={0} cy={0} r={22} fill="hsl(38, 92%, 50%)" opacity="0.12">
          <animate attributeName="r" values="18;24;18" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.10;0.20;0.10" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Bounce / point flash */}
      {(sp.isFlashing || isBounce) && (
        <circle cx={0} cy={0} r={20} fill="hsl(142, 71%, 45%)" opacity="0.3">
          <animate attributeName="r" values="14;28;14" dur="0.5s" repeatCount="2" />
          <animate attributeName="opacity" values="0.3;0.55;0" dur="0.5s" repeatCount="2" />
        </circle>
      )}

      {/* Shake / negative */}
      {isShake && (
        <circle cx={0} cy={0} r={20} fill="hsl(0, 72%, 51%)" opacity="0.2">
          <animate attributeName="r" values="18;22;18" dur="0.15s" repeatCount="5" />
          <animate attributeName="opacity" values="0.2;0.35;0.2" dur="0.15s" repeatCount="5" />
        </circle>
      )}

      {/* Ring pulse (checkpoint) */}
      {isRingPulse && (
        <>
          <circle cx={0} cy={0} r={22} fill="none" stroke="hsl(220, 70%, 50%)" strokeWidth="2.5" opacity="0.5">
            <animate attributeName="r" values="18;36" dur="0.75s" repeatCount="2" />
            <animate attributeName="opacity" values="0.5;0" dur="0.75s" repeatCount="2" />
          </circle>
          <circle cx={0} cy={0} r={22} fill="none" stroke="hsl(220, 70%, 50%)" strokeWidth="1.5" opacity="0.25">
            <animate attributeName="r" values="18;42" dur="0.75s" begin="0.2s" repeatCount="2" />
            <animate attributeName="opacity" values="0.25;0" dur="0.75s" begin="0.2s" repeatCount="2" />
          </circle>
        </>
      )}

      {/* Burst (level-up) */}
      {isBurst && (
        <>
          <circle cx={0} cy={0} r={30} fill="url(#burst-glow)">
            <animate attributeName="r" values="20;40;20" dur="0.6s" repeatCount="3" />
            <animate attributeName="opacity" values="0.5;0.8;0" dur="0.6s" repeatCount="3" />
          </circle>
          {[0, 60, 120, 180, 240, 300].map(angle => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line key={angle} x1={0} y1={0} x2={Math.cos(rad) * 26} y2={Math.sin(rad) * 26}
                stroke="hsl(48, 96%, 53%)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
                <animate attributeName="opacity" values="0.6;0" dur="0.8s" fill="freeze" />
              </line>
            );
          })}
        </>
      )}

      {/* Sparkle (reward ready) */}
      {isSparkle && (
        <>
          {[{ cx: -10, cy: -14, d: '0s' }, { cx: 12, cy: -10, d: '0.2s' }, { cx: -8, cy: 12, d: '0.1s' }, { cx: 14, cy: 8, d: '0.3s' }].map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r={2} fill="hsl(48, 96%, 53%)">
              <animate attributeName="r" values="1;3;1" dur="0.5s" begin={dot.d} repeatCount="3" />
              <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" begin={dot.d} repeatCount="3" />
            </circle>
          ))}
        </>
      )}

      {/* Card flash (reward redeemed) */}
      {isCardFlash && (
        <circle cx={0} cy={0} r={18} fill="white" opacity="0.4">
          <animate attributeName="opacity" values="0;0.6;0" dur="0.4s" repeatCount="2" />
        </circle>
      )}

      {/* Flame trail (streak boost) */}
      {isFlame && (
        <g>
          <ellipse cx={0} cy={-8} rx={10} ry={16} fill="hsl(25, 95%, 53%)" opacity="0.4">
            <animate attributeName="ry" values="14;20;14" dur="0.3s" repeatCount="5" />
            <animate attributeName="opacity" values="0.3;0.5;0.3" dur="0.3s" repeatCount="5" />
          </ellipse>
          <ellipse cx={0} cy={-6} rx={6} ry={10} fill="hsl(48, 96%, 53%)" opacity="0.5">
            <animate attributeName="ry" values="8;14;8" dur="0.25s" repeatCount="6" />
          </ellipse>
          <circle cx={0} cy={0} r={19} fill="none" stroke="hsl(25, 95%, 53%)" strokeWidth="2" opacity="0.4">
            <animate attributeName="opacity" values="0.4;0.7;0.4" dur="0.4s" repeatCount="4" />
          </circle>
        </g>
      )}

      {/* Team pulse */}
      {isTeamPulse && (
        <g>
          <circle cx={0} cy={0} r={22} fill="none" stroke={sp.teamColor || 'hsl(280, 70%, 55%)'} strokeWidth="3" opacity="0.5">
            <animate attributeName="r" values="18;32" dur="0.6s" repeatCount="2" />
            <animate attributeName="opacity" values="0.5;0" dur="0.6s" repeatCount="2" />
          </circle>
          <circle cx={0} cy={0} r={22} fill="none" stroke={sp.teamColor || 'hsl(280, 70%, 55%)'} strokeWidth="1.5" opacity="0.3">
            <animate attributeName="r" values="18;38" dur="0.6s" begin="0.15s" repeatCount="2" />
            <animate attributeName="opacity" values="0.3;0" dur="0.6s" begin="0.15s" repeatCount="2" />
          </circle>
        </g>
      )}

      {/* Comeback badge */}
      {sp.hasComeback && (
        <g transform="translate(-14, -14)">
          <circle cx={0} cy={0} r={7} fill="hsl(200, 80%, 55%)" stroke="white" strokeWidth="1">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
          <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize="8">💪</text>
        </g>
      )}

      {/* Streak emoji */}
      {sp.streakEmoji && (
        <g transform="translate(-14, 10)">
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize="10">{sp.streakEmoji}</text>
        </g>
      )}

      {/* Active zone ring + badge */}
      {sp.activeZone && (
        <g>
          <circle cx={0} cy={0} r={20} fill="none" stroke={sp.activeZone.color} strokeWidth="2" opacity="0.5" strokeDasharray="4 2">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <g transform="translate(14, -14)">
            <rect x={-14} y={-7} width={28} height={14} rx={7} fill={sp.activeZone.color} opacity="0.85" />
            <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize="6" fontWeight="700" fill="white">
              {sp.activeZone.multiplier !== 1 ? `${sp.activeZone.multiplier}x` : sp.activeZone.label.slice(0, 4)}
            </text>
          </g>
        </g>
      )}

      {/* Team color ring */}
      {sp.teamColor && !sp.activeZone && (
        <circle cx={0} cy={0} r={18} fill="none" stroke={sp.teamColor} strokeWidth="2.5" opacity="0.7" />
      )}

      {/* Avatar circle */}
      <circle cx={0} cy={0} r={16}
        fill="hsl(0, 0%, 100%)"
        stroke={
          isBounce ? 'hsl(142, 71%, 45%)'
          : isShake ? 'hsl(0, 72%, 51%)'
          : sp.isFlashing ? 'hsl(38, 92%, 50%)'
          : 'hsl(220, 13%, 91%)'
        }
        strokeWidth={sp.isFlashing || !!eff ? 3 : 1.5}
        className="dark:fill-[hsl(222,25%,16%)]"
        filter="url(#avatar-shadow)"
        opacity={isDimmed ? 0.55 : 1}
      />

      {/* Emoji */}
      <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize="18"
        style={{ pointerEvents: 'none' }} opacity={isDimmed ? 0.5 : 1}>
        {sp.avatar_emoji || '👤'}
      </text>

      {/* Lap badge */}
      {sp.laps > 0 && (
        <g transform="translate(12, -12)">
          <circle cx={0} cy={0} r={8} fill="hsl(38, 92%, 50%)" stroke="white" strokeWidth="1.5" />
          <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill="white">{sp.laps}</text>
        </g>
      )}

      {/* Name label */}
      <text x={0} y={26} textAnchor="middle" fontSize="9" fontWeight="600"
        fill="hsl(220, 25%, 12%)" className="dark:fill-[hsl(210,20%,95%)]">
        {sp.name}
      </text>

      {/* Distance to finish */}
      {distanceToFinish > 0 && sp.balance > 0 && (
        <text x={0} y={36} textAnchor="middle" fontSize="7" fill="hsl(220, 10%, 42%)" opacity="0.7">
          {distanceToFinish}pts to go
        </text>
      )}
    </g>
  );
}

export function CurvedTrackBoard({ nodes, totalSteps, students, zones = [], checkpoints = [], theme, feedbacks = [], className, trackType = 'curved', movementStyle = 'glide' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 300 });

  // Use fallback nodes if provided nodes are invalid
  const safeNodes = useMemo(() => {
    if (!nodes || nodes.length < 2 || nodes.some(n => typeof n.x !== 'number' || typeof n.y !== 'number')) {
      return getFallbackNodes(trackType);
    }
    return nodes;
  }, [nodes, trackType]);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      const heightRatio = trackType === 'depth_track' ? 0.55 : trackType === 'board_nodes' ? 0.65 : 0.42;
      setDims({ w: width, h: Math.max(260, width * heightRatio) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [trackType]);

  const { w, h } = dims;
  const tc = theme?.colors || {};
  const trackColor = tc.track || 'hsl(220, 70%, 50%)';
  const bgColor = tc.bg || undefined;
  const glowColor = tc.glow || trackColor;

  const pathD = useMemo(() => generateTrackPath(trackType, safeNodes, w, h), [trackType, safeNodes, w, h]);

  // Zone overlays
  const zoneOverlays = useMemo(() => {
    return zones.map(z => {
      const startPos = interpolateOnTrack(z.start_pct, safeNodes);
      const endPos = interpolateOnTrack(z.end_pct, safeNodes);
      const midPos = interpolateOnTrack((z.start_pct + z.end_pct) / 2, safeNodes);
      return {
        ...z,
        sx: (startPos.x / 100) * w,
        sy: (startPos.y / 100) * h,
        ex: (endPos.x / 100) * w,
        ey: (endPos.y / 100) * h,
        mx: (midPos.x / 100) * w,
        my: (midPos.y / 100) * h,
      };
    });
  }, [zones, safeNodes, w, h]);

  // Checkpoint positions
  const checkpointMarkers = useMemo(() => {
    return checkpoints.map(cp => {
      const pos = interpolateOnTrack(cp.progress_pct, safeNodes);
      return { ...cp, x: (pos.x / 100) * w, y: (pos.y / 100) * h };
    });
  }, [checkpoints, safeNodes, w, h]);

  const startPos = useMemo(() => {
    const p = interpolateOnTrack(0, safeNodes);
    return { x: (p.x / 100) * w, y: (p.y / 100) * h };
  }, [safeNodes, w, h]);

  const finishPos = useMemo(() => {
    const p = interpolateOnTrack(1, safeNodes);
    return { x: (p.x / 100) * w, y: (p.y / 100) * h };
  }, [safeNodes, w, h]);

  const studentPositions = useMemo(() => {
    return students.map((s, i) => {
      const pos = interpolateOnTrack(s.progress, safeNodes);
      const { dx, dy } = jitter(s.student_id, i);
      const hasOverlap = students.some((other, j) =>
        j !== i && Math.abs(other.progress - s.progress) < 0.03
      );
      const dScale = getDepthScale(s.progress, trackType);
      return {
        ...s,
        cx: (pos.x / 100) * w + (hasOverlap ? dx * 0.5 : 0),
        cy: (pos.y / 100) * h + (hasOverlap ? dy * 0.5 : 0),
        distanceToFinish: Math.max(0, totalSteps - s.balance),
        depthScale: dScale,
      };
    });
  }, [students, safeNodes, w, h, totalSteps, trackType]);

  // Feedback position map
  const feedbackPositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const sp of studentPositions) map[sp.student_id] = { x: sp.cx, y: sp.cy };
    return map;
  }, [studentPositions]);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        style={{ minHeight: 260 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="track-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="track-glow-strong" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.18" />
          </filter>
          <radialGradient id="finish-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="burst-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(48, 96%, 53%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(48, 96%, 53%)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="start-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(165, 60%, 38%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(165, 60%, 38%)" stopOpacity="0" />
          </radialGradient>
          {zones.map((_, i) => (
            <filter key={i} id={`zone-glow-${i}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
        </defs>

        {/* Background */}
        <rect width={w} height={h} rx="16"
          fill={bgColor || "hsl(220, 14%, 96%)"}
          className={!bgColor ? "dark:fill-[hsl(222,25%,12%)]" : undefined}
        />

        {/* Zone overlays */}
        {zoneOverlays.map((z, i) => (
          <g key={i}>
            <ellipse
              cx={z.mx} cy={z.my}
              rx={Math.abs(z.ex - z.sx) / 2 + 25}
              ry={35}
              fill={z.color}
              opacity="0.10"
              filter={`url(#zone-glow-${i})`}
            />
            <text x={z.mx} y={z.my - 22} textAnchor="middle" fontSize="8" fontWeight="700"
              fill={z.color} opacity="0.65">
              {z.type === 'boost' ? '⚡' : z.type === 'slow' ? '❄️' : z.type === 'reward' ? '🎁' : '✨'} {z.label}
            </text>
            {z.multiplier !== 1 && (
              <text x={z.mx} y={z.my - 12} textAnchor="middle" fontSize="7" fontWeight="600"
                fill={z.color} opacity="0.45">
                {z.multiplier}x
              </text>
            )}
          </g>
        ))}

        {/* Track outer glow */}
        <path d={pathD} fill="none" stroke={glowColor} strokeWidth="20"
          strokeLinecap="round" strokeLinejoin={trackType === 'zigzag' ? 'bevel' : 'round'} opacity="0.08" filter="url(#track-glow-strong)" />

        {/* Track mid glow */}
        <path d={pathD} fill="none" stroke={glowColor} strokeWidth="12"
          strokeLinecap="round" strokeLinejoin={trackType === 'zigzag' ? 'bevel' : 'round'} opacity="0.12" filter="url(#track-glow)" />

        {/* Track dashed guide */}
        <path d={pathD} fill="none" stroke={trackColor} strokeWidth="6"
          strokeLinecap="round" strokeLinejoin={trackType === 'zigzag' ? 'bevel' : 'round'} opacity="0.5" strokeDasharray={trackType === 'board_nodes' ? '8 4' : '14 7'} />

        {/* Track solid core */}
        <path d={pathD} fill="none" stroke={trackColor} strokeWidth={trackType === 'depth_track' ? '3.5' : '2.5'}
          strokeLinecap="round" strokeLinejoin={trackType === 'zigzag' ? 'bevel' : 'round'} opacity="0.85" />

        {/* Board nodes markers */}
        {trackType === 'board_nodes' && safeNodes.map((n, i) => (
          <circle key={i} cx={(n.x / 100) * w} cy={(n.y / 100) * h} r={8}
            fill="hsl(220, 14%, 96%)" stroke={trackColor} strokeWidth="1.5" opacity="0.6"
            className="dark:fill-[hsl(222,25%,16%)]"
          />
        ))}

        {/* Checkpoint markers */}
        {checkpointMarkers.map((cp, i) => (
          <g key={i}>
            <circle cx={cp.x} cy={cp.y} r="13" fill="hsl(48, 96%, 53%)" opacity="0.12">
              <animate attributeName="r" values="11;15;11" dur="3.5s" repeatCount="indefinite" />
            </circle>
            <circle cx={cp.x} cy={cp.y} r="10"
              fill="hsl(220, 14%, 96%)" stroke="hsl(48, 96%, 53%)" strokeWidth="2.5"
              className="dark:fill-[hsl(222,25%,12%)]"
            />
            <text x={cp.x} y={cp.y + 1} textAnchor="middle" dominantBaseline="central"
              fontSize="7" fontWeight="700" fill="hsl(48, 96%, 53%)">
              {cp.reward_points > 0 ? `+${cp.reward_points}` : cp.label?.slice(0, 3)}
            </text>
            <text x={cp.x} y={cp.y + 18} textAnchor="middle" fontSize="6"
              fill="hsl(220, 10%, 42%)" opacity="0.55">
              {cp.label}
            </text>
          </g>
        ))}

        {/* Start marker */}
        <g>
          <circle cx={startPos.x} cy={startPos.y} r="22" fill="url(#start-glow)" />
          <circle cx={startPos.x} cy={startPos.y} r="12" fill="hsl(165, 60%, 38%)" opacity="0.15" />
          <circle cx={startPos.x} cy={startPos.y} r="9" fill="hsl(165, 60%, 38%)" stroke="white" strokeWidth="2" />
          <text x={startPos.x} y={startPos.y + 1} textAnchor="middle" dominantBaseline="central" fontSize="10">🏁</text>
        </g>

        {/* Finish marker */}
        <g>
          <circle cx={finishPos.x} cy={finishPos.y} r="32" fill="url(#finish-glow)" />
          <circle cx={finishPos.x} cy={finishPos.y} r="14" fill="hsl(38, 92%, 50%)" opacity="0.18" />
          <circle cx={finishPos.x} cy={finishPos.y} r="9" fill="hsl(38, 92%, 50%)" stroke="white" strokeWidth="2" />
          <text x={finishPos.x} y={finishPos.y + 1} textAnchor="middle" dominantBaseline="central" fontSize="11">🏆</text>
        </g>

        {/* Student avatars with smooth animation */}
        {studentPositions.map((sp) => (
          <AnimatedAvatarGroup
            key={sp.student_id}
            sp={sp}
            targetCx={sp.cx}
            targetCy={sp.cy}
            distanceToFinish={sp.distanceToFinish}
            movementStyle={movementStyle}
            depthScale={(sp as any).depthScale || 1}
          />
        ))}

        {/* Floating feedback */}
        <FloatingFeedbackOverlay feedbacks={feedbacks} positions={feedbackPositions} />
      </svg>
    </div>
  );
}
