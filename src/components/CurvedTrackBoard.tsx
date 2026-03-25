/**
 * CurvedTrackBoard — SVG curved race track with student avatars.
 * Renders a smooth bezier path from nodes_json, places checkpoint markers,
 * start/finish flags, and positions student avatars via interpolation.
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import { interpolateOnTrack, generateSmoothPath, type TrackNode } from '@/hooks/useGameTrack';
import { cn } from '@/lib/utils';
import type { AnimationEffect } from '@/hooks/useGameEvents';

interface StudentPosition {
  student_id: string;
  avatar_emoji: string;
  name: string;
  progress: number; // 0..1
  balance: number;
  laps: number;
  isFlashing: boolean;
  teamColor?: string | null;
  activeEffect?: AnimationEffect | null;
}

interface Props {
  nodes: TrackNode[];
  totalSteps: number;
  students: StudentPosition[];
  className?: string;
}

// Deterministic jitter so overlapping students don't stack
function jitter(studentId: string, index: number): { dx: number; dy: number } {
  const hash = studentId.charCodeAt(0) + studentId.charCodeAt(studentId.length - 1) + index;
  const angle = (hash % 12) * (Math.PI / 6);
  const radius = 12 + (hash % 8);
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

export function CurvedTrackBoard({ nodes, totalSteps, students, className }: Props) {
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

  const pathD = useMemo(() => generateSmoothPath(nodes, w, h), [nodes, w, h]);

  // Checkpoint positions (every 20% of track)
  const checkpoints = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const pct = (i + 1) / (count + 1);
      const pos = interpolateOnTrack(pct, nodes);
      return { pct, x: (pos.x / 100) * w, y: (pos.y / 100) * h, label: Math.round(pct * totalSteps) };
    });
  }, [nodes, w, h, totalSteps]);

  // Start and finish positions
  const startPos = useMemo(() => {
    const p = interpolateOnTrack(0, nodes);
    return { x: (p.x / 100) * w, y: (p.y / 100) * h };
  }, [nodes, w, h]);

  const finishPos = useMemo(() => {
    const p = interpolateOnTrack(1, nodes);
    return { x: (p.x / 100) * w, y: (p.y / 100) * h };
  }, [nodes, w, h]);

  // Student positions with jitter for overlapping
  const studentPositions = useMemo(() => {
    // Group students by similar progress to detect overlaps
    return students.map((s, i) => {
      const pos = interpolateOnTrack(s.progress, nodes);
      const { dx, dy } = jitter(s.student_id, i);
      // Check if any other student is very close
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
          {/* Glow filter for the path */}
          <filter id="track-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Shadow filter for avatars */}
          <filter id="avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.25" />
          </filter>
          {/* Finish glow */}
          <radialGradient id="finish-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity="0" />
          </radialGradient>
          {/* Burst effect gradient */}
          <radialGradient id="burst-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(48, 96%, 53%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(48, 96%, 53%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background gradient */}
        <rect width={w} height={h} rx="16" fill="hsl(220, 14%, 96%)" className="dark:fill-[hsl(222,25%,12%)]" />

        {/* Track glow layer */}
        <path
          d={pathD}
          fill="none"
          stroke="hsl(220, 70%, 50%)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
          filter="url(#track-glow)"
        />

        {/* Main track path */}
        <path
          d={pathD}
          fill="none"
          stroke="hsl(220, 70%, 50%)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
          strokeDasharray="12 6"
        />

        {/* Solid inner track */}
        <path
          d={pathD}
          fill="none"
          stroke="hsl(220, 70%, 50%)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Checkpoints */}
        {checkpoints.map((cp, i) => (
          <g key={i}>
            <circle
              cx={cp.x}
              cy={cp.y}
              r="10"
              fill="hsl(220, 14%, 96%)"
              stroke="hsl(220, 70%, 50%)"
              strokeWidth="2.5"
              className="dark:fill-[hsl(222,25%,12%)]"
            />
            <text
              x={cp.x}
              y={cp.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="700"
              fill="hsl(220, 70%, 50%)"
            >
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

        {/* Finish marker with glow */}
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
              {/* Shadow */}
              <ellipse cx={0} cy={4} rx={14} ry={5} fill="black" opacity="0.12" />

              {/* Near-finish glow */}
              {nearFinish && (
                <circle cx={0} cy={0} r={22} fill="hsl(38, 92%, 50%)" opacity="0.15">
                  <animate attributeName="r" values="18;24;18" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.25;0.15" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* EFFECT: bounce — expanding glow ring */}
              {(sp.isFlashing || isBounce) && (
                <circle cx={0} cy={0} r={20} fill="hsl(142, 71%, 45%)" opacity="0.35">
                  <animate attributeName="r" values="14;28;14" dur="0.5s" repeatCount="2" />
                  <animate attributeName="opacity" values="0.35;0.6;0" dur="0.5s" repeatCount="2" />
                </circle>
              )}

              {/* EFFECT: shake — red flash ring */}
              {isShake && (
                <circle cx={0} cy={0} r={20} fill="hsl(0, 72%, 51%)" opacity="0.25">
                  <animate attributeName="r" values="18;22;18" dur="0.15s" repeatCount="5" />
                  <animate attributeName="opacity" values="0.25;0.4;0.25" dur="0.15s" repeatCount="5" />
                </circle>
              )}

              {/* EFFECT: ring-pulse — expanding checkpoint ring */}
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

              {/* EFFECT: burst — confetti-like rays */}
              {isBurst && (
                <>
                  <circle cx={0} cy={0} r={30} fill="url(#burst-glow)">
                    <animate attributeName="r" values="20;40;20" dur="0.6s" repeatCount="3" />
                    <animate attributeName="opacity" values="0.6;0.9;0" dur="0.6s" repeatCount="3" />
                  </circle>
                  {[0, 60, 120, 180, 240, 300].map(angle => {
                    const rad = (angle * Math.PI) / 180;
                    const x2 = Math.cos(rad) * 26;
                    const y2 = Math.sin(rad) * 26;
                    return (
                      <line key={angle} x1={0} y1={0} x2={x2} y2={y2}
                        stroke="hsl(48, 96%, 53%)" strokeWidth="2" strokeLinecap="round" opacity="0.7">
                        <animate attributeName="opacity" values="0.7;0" dur="0.8s" fill="freeze" />
                      </line>
                    );
                  })}
                </>
              )}

              {/* EFFECT: sparkle — twinkling dots */}
              {isSparkle && (
                <>
                  {[
                    { cx: -10, cy: -14, delay: '0s' },
                    { cx: 12, cy: -10, delay: '0.2s' },
                    { cx: -8, cy: 12, delay: '0.1s' },
                    { cx: 14, cy: 8, delay: '0.3s' },
                  ].map((dot, i) => (
                    <circle key={i} cx={dot.cx} cy={dot.cy} r={2} fill="hsl(48, 96%, 53%)">
                      <animate attributeName="r" values="1;3;1" dur="0.5s" begin={dot.delay} repeatCount="3" />
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" begin={dot.delay} repeatCount="3" />
                    </circle>
                  ))}
                </>
              )}

              {/* EFFECT: card-flash — white flash overlay */}
              {isCardFlash && (
                <circle cx={0} cy={0} r={18} fill="white" opacity="0.5">
                  <animate attributeName="opacity" values="0;0.7;0" dur="0.4s" repeatCount="2" />
                </circle>
              )}

              {/* Team color ring */}
              {sp.teamColor && (
                <circle cx={0} cy={0} r={18} fill="none" stroke={sp.teamColor} strokeWidth="2.5" opacity="0.7" />
              )}

              {/* Avatar circle */}
              <circle
                cx={0}
                cy={0}
                r={16}
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

              {/* Avatar emoji */}
              <text
                x={0}
                y={1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="18"
                style={{ pointerEvents: 'none' }}
                opacity={isDimmed ? 0.5 : 1}
              >
                {sp.avatar_emoji || '👤'}
              </text>

              {/* Lap badge */}
              {sp.laps > 0 && (
                <g transform="translate(12, -12)">
                  <circle cx={0} cy={0} r={8} fill="hsl(38, 92%, 50%)" stroke="white" strokeWidth="1.5" />
                  <text x={0} y={1} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="700" fill="white">
                    {sp.laps}
                  </text>
                </g>
              )}

              {/* Name label */}
              <text
                x={0}
                y={26}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="hsl(220, 25%, 12%)"
                className="dark:fill-[hsl(210,20%,95%)]"
              >
                {sp.name}
              </text>

              {/* Distance to finish */}
              {sp.distanceToFinish > 0 && sp.balance > 0 && (
                <text
                  x={0}
                  y={36}
                  textAnchor="middle"
                  fontSize="7"
                  fill="hsl(220, 10%, 42%)"
                  opacity="0.8"
                >
                  {sp.distanceToFinish}pts to go
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
