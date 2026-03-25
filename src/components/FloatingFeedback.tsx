/**
 * FloatingFeedback — Animated floating text overlays on the game board.
 * Renders "+5 ⭐", "🔥 STREAK!", etc. positioned near student avatars.
 */
import { useEffect, useState } from 'react';
import type { FloatingFeedback as FeedbackItem } from '@/hooks/useGameEngine';

interface Props {
  feedbacks: FeedbackItem[];
  /** Map student_id → { x, y } pixel position on SVG */
  positions: Record<string, { x: number; y: number }>;
}

export function FloatingFeedbackOverlay({ feedbacks, positions }: Props) {
  return (
    <>
      {feedbacks.map(fb => {
        const pos = positions[fb.studentId];
        if (!pos) return null;
        return <FloatingItem key={fb.id} feedback={fb} x={pos.x} y={pos.y} />;
      })}
    </>
  );
}

function FloatingItem({ feedback, x, y }: { feedback: FeedbackItem; x: number; y: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const colorMap: Record<string, string> = {
    points: 'hsl(142, 71%, 45%)',
    streak: 'hsl(38, 92%, 50%)',
    boost: 'hsl(280, 80%, 60%)',
    checkpoint: 'hsl(48, 96%, 53%)',
    comeback: 'hsl(200, 80%, 55%)',
    zone: 'hsl(280, 80%, 60%)',
  };

  return (
    <g
      style={{
        animation: 'floatUp 2.2s ease-out forwards',
      }}
    >
      <text
        x={x}
        y={y - 28}
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fill={colorMap[feedback.type] || 'hsl(38, 92%, 50%)'}
        stroke="white"
        strokeWidth="2.5"
        paintOrder="stroke"
      >
        {feedback.text}
      </text>
    </g>
  );
}

/** CSS keyframes — inject into index.css or inline */
export const FLOAT_KEYFRAMES = `
@keyframes floatUp {
  0% { opacity: 1; transform: translateY(0); }
  70% { opacity: 1; transform: translateY(-24px); }
  100% { opacity: 0; transform: translateY(-40px); }
}
`;
