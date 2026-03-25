/**
 * CurvedTrackBoard — SVG curved race track with zones, checkpoints, and student avatars.
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import { interpolateOnTrack, generateSmoothPath, type TrackNode, type TrackZone, type TrackCheckpoint, type GameTheme } from '@/hooks/useGameTrack';
import { FloatingFeedbackOverlay } from '@/components/FloatingFeedback';
import type { FloatingFeedback } from '@/hooks/useGameEngine';
import { cn } from '@/lib/utils';
import type { AnimationEffect } from '@/hooks/useGameEvents';

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
  hasComeback?: boolean;
  streakEmoji?: string | null;
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
}

function jitter(studentId: string, index: number): { dx: number; dy: number } {
  const hash = studentId.charCodeAt(0) + studentId.charCodeAt(studentId.length - 1) + index;
  const angle = (hash % 12) * (Math.PI / 6);
  const radius = 12 + (hash % 8);
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

export function CurvedTrackBoard({ nodes, totalSteps, students, zones = [], checkpoints = [], theme, feedbacks = [], className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 300 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDims({ w: width, h: Math.max(240, width * 0.4) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { w, h } = dims;
  const tc = theme?.colors || {};
  const trackColor = tc.track || 'hsl(220, 70%, 50%)';
  const bgColor = tc.bg || undefined;
  const glowColor = tc.glow || trackColor;

  const pathD = useMemo(() => generateSmoothPath(nodes, w, h), [nodes, w, h]);

  // Zone overlays as path segments (simplified: rectangles positioned by percent)
  const zoneOverlays = useMemo(() => {
    return zones.map(z => {
      const startPos = interpolateOnTrack(z.start_pct, nodes);
      const endPos = interpolateOnTrack(z.end_pct, nodes);
      const midPos = interpolateOnTrack((z.start_pct + z.end_pct) / 2, nodes);
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
  }, [zones, nodes, w, h]);

  // Checkpoint positions from data
  const checkpointMarkers = useMemo(() => {
    return checkpoints.map(cp => {
      const pos = interpolateOnTrack(cp.progress_pct, nodes);
      return {
        ...cp,
        x: (pos.x / 100) * w,
        y: (pos.y / 100) * h,
      };
    });
  }, [checkpoints, nodes, w, h]);

  const startPos = useMemo(() => {
    const p = interpolateOnTrack(0, nodes);
    return { x: (p.x / 100) * w, y: (p.y / 100) * h };
  }, [nodes, w, h]);

  const finishPos = useMemo(() => {
    const p = interpolateOnTrack(1, nodes);
    return { x: (p.x / 100) * w, y: (p.y / 100) * h };
  }, [nodes, w, h]);

  const studentPositions = useMemo(() => {
    return students.map((s, i) => {
      const pos = interpolateOnTrack(s.progress, nodes);
      const { dx, dy } = jitter(s.student_id, i);
      const hasOverlap = students.some((other, j) =>
        j !== i && Math.abs(other.progress - s.progress) < 0.03
      );
      return {
        ...s,
        cx: (pos.x / 100) * w + (hasOverlap ? dx * 0.5 : 0),
        cy: (pos.y / 100) * h + (hasOverlap ? dy * 0.5 : 0),
        distanceToFinish: Math.max(0, totalSteps - s.balance),
      };
    });
  }, [students, nodes, w, h, totalSteps]);

  // Build position map for floating feedback
  const feedbackPositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const sp of studentPositions) {
      map[sp.student_id] = { x: sp.cx, y: sp.cy };
    }
    return map;
  }, [studentPositions]);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        style={{ minHeight: 240 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="track-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.25" />
          </filter>
          <radialGradient id="finish-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="burst-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(48, 96%, 53%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(48, 96%, 53%)" stopOpacity="0" />
          </radialGradient>
          {/* Zone glow filters */}
          {zones.map((z, i) => (
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
            {/* Zone glow ellipse */}
            <ellipse
              cx={z.mx} cy={z.my}
              rx={Math.abs(z.ex - z.sx) / 2 + 20}
              ry={30}
              fill={z.color}
              opacity="0.12"
              filter={`url(#zone-glow-${i})`}
            />
            {/* Zone label */}
            <text
              x={z.mx} y={z.my - 20}
              textAnchor="middle" fontSize="8" fontWeight="700"
              fill={z.color} opacity="0.7"
            >
              {z.type === 'boost' ? '⚡' : z.type === 'slow' ? '❄️' : z.type === 'reward' ? '🎁' : '✨'} {z.label}
            </text>
            {/* Multiplier badge */}
            {z.multiplier !== 1 && (
              <text
                x={z.mx} y={z.my - 10}
                textAnchor="middle" fontSize="7" fontWeight="600"
                fill={z.color} opacity="0.5"
              >
                {z.multiplier}x
              </text>
            )}
          </g>
        ))}

        {/* Track glow */}
        <path d={pathD} fill="none" stroke={glowColor} strokeWidth="16"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.15" filter="url(#track-glow)" />

        {/* Main track path */}
        <path d={pathD} fill="none" stroke={trackColor} strokeWidth="6"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.6" strokeDasharray="12 6" />

        {/* Solid inner track */}
        <path d={pathD} fill="none" stroke={trackColor} strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

        {/* Checkpoint markers from data */}
        {checkpointMarkers.map((cp, i) => (
          <g key={i}>
            <circle cx={cp.x} cy={cp.y} r="12" fill="hsl(48, 96%, 53%)" opacity="0.15">
              <animate attributeName="r" values="10;14;10" dur="3s" repeatCount="indefinite" />
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
              fill="hsl(220, 10%, 42%)" opacity="0.6">
              {cp.label}
            </text>
          </g>
        ))}

        {/* Start marker */}
        <g>
          <circle cx={startPos.x} cy={startPos.y} r="14" fill="hsl(165, 60%, 38%)" opacity="0.2" />
          <circle cx={startPos.x} cy={startPos.y} r="9" fill="hsl(165, 60%, 38%)" stroke="white" strokeWidth="2" />
          <text x={startPos.x} y={startPos.y + 1} textAnchor="middle" dominantBaseline="central" fontSize="10">🏁</text>
        </g>

        {/* Finish marker */}
        <g>
          <circle cx={finishPos.x} cy={finishPos.y} r="28" fill="url(#finish-glow)" />
          <circle cx={finishPos.x} cy={finishPos.y} r="14" fill="hsl(38, 92%, 50%)" opacity="0.2" />
          <circle cx={finishPos.x} cy={finishPos.y} r="9" fill="hsl(38, 92%, 50%)" stroke="white" strokeWidth="2" />
          <text x={finishPos.x} y={finishPos.y + 1} textAnchor="middle" dominantBaseline="central" fontSize="11">🏆</text>
        </g>

        {/* Student avatars */}
        {studentPositions.map((sp) => {
          const nearFinish = sp.progress > 0.85;
          const eff = sp.activeEffect;
          const isBounce = eff === 'bounce';
          const isShake = eff === 'shake';
          const isRingPulse = eff === 'ring-pulse';
          const isBurst = eff === 'burst';
          const isSparkle = eff === 'sparkle';
          const isCardFlash = eff === 'card-flash';
          const isDimmed = isShake;
          return (
            <g
              key={sp.student_id}
              style={{
                transition: 'transform 800ms cubic-bezier(0.4, 0, 0.2, 1)',
                transform: `translate(${sp.cx}px, ${sp.cy}px)`,
              }}
            >
              <ellipse cx={0} cy={4} rx={14} ry={5} fill="black" opacity="0.12" />

              {nearFinish && (
                <circle cx={0} cy={0} r={22} fill="hsl(38, 92%, 50%)" opacity="0.15">
                  <animate attributeName="r" values="18;24;18" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.25;0.15" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {(sp.isFlashing || isBounce) && (
                <circle cx={0} cy={0} r={20} fill="hsl(142, 71%, 45%)" opacity="0.35">
                  <animate attributeName="r" values="14;28;14" dur="0.5s" repeatCount="2" />
                  <animate attributeName="opacity" values="0.35;0.6;0" dur="0.5s" repeatCount="2" />
                </circle>
              )}

              {isShake && (
                <circle cx={0} cy={0} r={20} fill="hsl(0, 72%, 51%)" opacity="0.25">
                  <animate attributeName="r" values="18;22;18" dur="0.15s" repeatCount="5" />
                  <animate attributeName="opacity" values="0.25;0.4;0.25" dur="0.15s" repeatCount="5" />
                </circle>
              )}

              {isRingPulse && (
                <>
                  <circle cx={0} cy={0} r={22} fill="none" stroke="hsl(220, 70%, 50%)" strokeWidth="3" opacity="0.6">
                    <animate attributeName="r" values="18;36" dur="0.75s" repeatCount="2" />
                    <animate attributeName="opacity" values="0.6;0" dur="0.75s" repeatCount="2" />
                  </circle>
                  <circle cx={0} cy={0} r={22} fill="none" stroke="hsl(220, 70%, 50%)" strokeWidth="2" opacity="0.3">
                    <animate attributeName="r" values="18;42" dur="0.75s" begin="0.2s" repeatCount="2" />
                    <animate attributeName="opacity" values="0.3;0" dur="0.75s" begin="0.2s" repeatCount="2" />
                  </circle>
                </>
              )}

              {isBurst && (
                <>
                  <circle cx={0} cy={0} r={30} fill="url(#burst-glow)">
                    <animate attributeName="r" values="20;40;20" dur="0.6s" repeatCount="3" />
                    <animate attributeName="opacity" values="0.6;0.9;0" dur="0.6s" repeatCount="3" />
                  </circle>
                  {[0, 60, 120, 180, 240, 300].map(angle => {
                    const rad = (angle * Math.PI) / 180;
                    return (
                      <line key={angle} x1={0} y1={0} x2={Math.cos(rad) * 26} y2={Math.sin(rad) * 26}
                        stroke="hsl(48, 96%, 53%)" strokeWidth="2" strokeLinecap="round" opacity="0.7">
                        <animate attributeName="opacity" values="0.7;0" dur="0.8s" fill="freeze" />
                      </line>
                    );
                  })}
                </>
              )}

              {isSparkle && (
                <>
                  {[{ cx: -10, cy: -14, delay: '0s' }, { cx: 12, cy: -10, delay: '0.2s' }, { cx: -8, cy: 12, delay: '0.1s' }, { cx: 14, cy: 8, delay: '0.3s' }].map((dot, i) => (
                    <circle key={i} cx={dot.cx} cy={dot.cy} r={2} fill="hsl(48, 96%, 53%)">
                      <animate attributeName="r" values="1;3;1" dur="0.5s" begin={dot.delay} repeatCount="3" />
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" begin={dot.delay} repeatCount="3" />
                    </circle>
                  ))}
                </>
              )}

              {isCardFlash && (
                <circle cx={0} cy={0} r={18} fill="white" opacity="0.5">
                  <animate attributeName="opacity" values="0;0.7;0" dur="0.4s" repeatCount="2" />
                </circle>
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

              {/* Streak emoji badge */}
              {sp.streakEmoji && (
                <g transform="translate(-14, 10)">
                  <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize="10">
                    {sp.streakEmoji}
                  </text>
                </g>
              )}

              {sp.teamColor && (
                <circle cx={0} cy={0} r={18} fill="none" stroke={sp.teamColor} strokeWidth="2.5" opacity="0.7" />
              )}

              <circle cx={0} cy={0} r={16}
                fill="hsl(0, 0%, 100%)"
                stroke={isBounce ? 'hsl(142, 71%, 45%)' : isShake ? 'hsl(0, 72%, 51%)' : sp.isFlashing ? 'hsl(38, 92%, 50%)' : 'hsl(220, 13%, 91%)'}
                strokeWidth={sp.isFlashing || !!eff ? 3 : 1.5}
                className="dark:fill-[hsl(222,25%,16%)]"
                filter="url(#avatar-shadow)"
                opacity={isDimmed ? 0.55 : 1}
              />

              <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize="18"
                style={{ pointerEvents: 'none' }} opacity={isDimmed ? 0.5 : 1}>
                {sp.avatar_emoji || '👤'}
              </text>

              {sp.laps > 0 && (
                <g transform="translate(12, -12)">
                  <circle cx={0} cy={0} r={8} fill="hsl(38, 92%, 50%)" stroke="white" strokeWidth="1.5" />
                  <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill="white">{sp.laps}</text>
                </g>
              )}

              <text x={0} y={26} textAnchor="middle" fontSize="9" fontWeight="600"
                fill="hsl(220, 25%, 12%)" className="dark:fill-[hsl(210,20%,95%)]">
                {sp.name}
              </text>

              {sp.distanceToFinish > 0 && sp.balance > 0 && (
                <text x={0} y={36} textAnchor="middle" fontSize="7" fill="hsl(220, 10%, 42%)" opacity="0.8">
                  {sp.distanceToFinish}pts to go
                </text>
              )}
            </g>
          );
        })}

        {/* Floating feedback */}
        <FloatingFeedbackOverlay feedbacks={feedbacks} positions={feedbackPositions} />
      </svg>
    </div>
  );
}
