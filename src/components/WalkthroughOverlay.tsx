import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Full-screen overlay that highlights a single DOM element (via CSS selector)
 * and renders a floating tooltip with instructions.
 */
export const WalkthroughOverlay = () => {
  const { activeFlow, currentStepIndex, isActive, nextStep, prevStep, endFlow } = useWalkthrough();
  const navigate = useNavigate();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  const step = activeFlow?.steps[currentStepIndex];
  const isLast = activeFlow ? currentStepIndex >= activeFlow.steps.length - 1 : false;
  const isFirst = currentStepIndex === 0;

  // Locate the target element
  const locateElement = useCallback(() => {
    if (!step) { setRect(null); return; }
    const el = document.querySelector(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setRect(null);
    }
  }, [step]);

  // Navigate to the correct route if needed
  useEffect(() => {
    if (!step?.route) return;
    navigate(step.route);
  }, [step?.route, navigate]);

  // Re-locate element on step change + poll briefly for dynamic elements
  useEffect(() => {
    if (!isActive || !step) return;

    // Small delay to allow route transitions / renders
    const timer = setTimeout(locateElement, 300);
    const poll = setInterval(locateElement, 800);

    // Also watch DOM mutations
    observerRef.current = new MutationObserver(locateElement);
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      observerRef.current?.disconnect();
    };
  }, [isActive, step, locateElement]);

  // Re-calc on scroll / resize
  useEffect(() => {
    if (!isActive) return;
    const handler = () => locateElement();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [isActive, locateElement]);

  // Listen for clicks on the highlighted element when waitForClick is true
  useEffect(() => {
    if (!isActive || !step?.waitForClick || !step?.selector) return;
    const handler = (e: MouseEvent) => {
      const el = document.querySelector(step.selector);
      if (el && (el === e.target || el.contains(e.target as Node))) {
        nextStep();
      }
    };
    // Use capture so we get it before stopPropagation
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isActive, step, nextStep]);

  if (!isActive || !activeFlow || !step) return null;

  const padding = 8;
  const tooltipWidth = 300;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const placement = step.placement || 'bottom';
    const base: React.CSSProperties = { position: 'fixed', width: tooltipWidth, zIndex: 10002 };

    switch (placement) {
      case 'top':
        return { ...base, left: rect.left + rect.width / 2 - tooltipWidth / 2, top: rect.top - padding - 12, transform: 'translateY(-100%)' };
      case 'bottom':
        return { ...base, left: rect.left + rect.width / 2 - tooltipWidth / 2, top: rect.bottom + padding + 12 };
      case 'left':
        return { ...base, left: rect.left - tooltipWidth - padding - 12, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' };
      case 'right':
        return { ...base, left: rect.right + padding + 12, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' };
      default:
        return { ...base, left: rect.left + rect.width / 2 - tooltipWidth / 2, top: rect.bottom + padding + 12 };
    }
  };

  return (
    <>
      {/* Backdrop — dims everything except the highlighted element */}
      <div className="fixed inset-0 z-[10000] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="walkthrough-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - padding}
                  y={rect.top - padding}
                  width={rect.width + padding * 2}
                  height={rect.height + padding * 2}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#walkthrough-mask)"
          />
        </svg>
      </div>

      {/* Highlight ring around the element */}
      {rect && (
        <div
          className="fixed z-[10001] rounded-xl border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)] pointer-events-none animate-pulse"
          style={{
            left: rect.left - padding,
            top: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          }}
        />
      )}

      {/* Make the highlighted element clickable through the overlay */}
      {rect && step.waitForClick && (
        <div
          className="fixed z-[10001] cursor-pointer"
          style={{
            left: rect.left - padding,
            top: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip card */}
      <div className="z-[10002]" style={{ ...getTooltipStyle(), position: 'fixed' }}>
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Step {currentStepIndex + 1} of {activeFlow.steps.length}
            </span>
            <button onClick={endFlow} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {activeFlow.steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i < currentStepIndex ? 'bg-primary' :
                  i === currentStepIndex ? 'bg-primary scale-125' :
                  'bg-border'
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={isFirst}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>

            {step.waitForClick ? (
              <span className="text-[10px] text-muted-foreground italic">
                👆 Tap the highlighted element
              </span>
            ) : (
              <Button
                size="sm"
                onClick={nextStep}
                className="h-8 text-xs gap-1"
              >
                {isLast ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
