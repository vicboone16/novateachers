/**
 * AnimatedAvatar — Student avatar with CSS animation states.
 * Used on both the game board (SVG) and student portal (HTML).
 * Lightweight: pure CSS animations, no framer-motion.
 */
import { cn } from '@/lib/utils';
import { type AvatarAnimState, AVATAR_ANIM_CONFIG } from '@/lib/avatar-animations';

interface AnimatedAvatarProps {
  emoji: string;
  state?: AvatarAnimState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-4xl',
};

export function AnimatedAvatar({ emoji, state = 'idle', size = 'md', className }: AnimatedAvatarProps) {
  const config = AVATAR_ANIM_CONFIG[state];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={cn(
      'relative rounded-full flex items-center justify-center shrink-0',
      sizeClass,
      config.className,
      className,
    )}>
      {/* Glow ring for boost */}
      {state === 'boost' && (
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-avatar-boost-ring" />
      )}
      {/* Pulse ring for level_up */}
      {state === 'level_up' && (
        <>
          <div className="absolute inset-[-4px] rounded-full border-2 border-accent animate-avatar-pulse-ring" />
          <div className="absolute inset-[-8px] rounded-full border border-accent/40 animate-avatar-pulse-ring-outer" />
        </>
      )}
      {/* Sparkle dots for reward_ready */}
      {state === 'reward_ready' && (
        <>
          <span className="absolute -top-1 -right-1 text-[8px] animate-avatar-sparkle-dot" style={{ animationDelay: '0s' }}>✨</span>
          <span className="absolute -bottom-1 -left-1 text-[8px] animate-avatar-sparkle-dot" style={{ animationDelay: '0.3s' }}>✨</span>
          <span className="absolute top-0 -left-2 text-[8px] animate-avatar-sparkle-dot" style={{ animationDelay: '0.6s' }}>✨</span>
        </>
      )}
      <span className="pointer-events-none select-none">{emoji || '👤'}</span>
    </div>
  );
}

/**
 * SVG version of animated avatar effects for game board.
 * Renders SVG animation elements around an avatar at (0,0).
 */
export function SvgAvatarEffect({ state }: { state: AvatarAnimState }) {
  if (state === 'idle') return null;

  return (
    <>
      {state === 'boost' && (
        <circle cx={0} cy={0} r={20} fill="hsl(var(--primary))" opacity="0.25">
          <animate attributeName="r" values="16;24;16" dur="0.4s" repeatCount="2" />
          <animate attributeName="opacity" values="0.25;0.45;0" dur="0.4s" repeatCount="2" />
        </circle>
      )}
      {state === 'level_up' && (
        <>
          <circle cx={0} cy={0} r={20} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" opacity="0.7">
            <animate attributeName="r" values="16;32" dur="0.6s" repeatCount="2" />
            <animate attributeName="opacity" values="0.7;0" dur="0.6s" repeatCount="2" />
          </circle>
          <circle cx={0} cy={0} r={14} fill="hsl(var(--accent))" opacity="0.15">
            <animate attributeName="opacity" values="0;0.3;0" dur="0.3s" repeatCount="3" />
          </circle>
        </>
      )}
      {state === 'reward_ready' && (
        <>
          {[{ cx: -10, cy: -12 }, { cx: 12, cy: -8 }, { cx: -6, cy: 12 }].map((pos, i) => (
            <circle key={i} cx={pos.cx} cy={pos.cy} r={1.5} fill="hsl(48, 96%, 53%)">
              <animate attributeName="r" values="1;3;1" dur="0.4s" begin={`${i * 0.15}s`} repeatCount="3" />
              <animate attributeName="opacity" values="0.4;1;0.4" dur="0.4s" begin={`${i * 0.15}s`} repeatCount="3" />
            </circle>
          ))}
        </>
      )}
      {state === 'shake' && (
        <circle cx={0} cy={0} r={18} fill="hsl(0, 72%, 51%)" opacity="0.2">
          <animate attributeName="opacity" values="0;0.3;0" dur="0.15s" repeatCount="3" />
        </circle>
      )}
      {state === 'move' && (
        <circle cx={0} cy={0} r={18} fill="hsl(var(--primary))" opacity="0.1">
          <animate attributeName="opacity" values="0.1;0.2;0" dur="0.6s" />
        </circle>
      )}
    </>
  );
}
