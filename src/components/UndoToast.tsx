/**
 * UndoToast — floating undo bar shown after point actions.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Undo2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UndoableAction } from '@/hooks/useUndoAction';

interface Props {
  action: UndoableAction | null;
  onUndo: () => Promise<boolean>;
  onDismiss: () => void;
}

export function UndoToast({ action, onUndo, onDismiss }: Props) {
  const [undoing, setUndoing] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!action || action.undone) {
      setProgress(100);
      return;
    }
    const start = action.timestamp;
    const duration = 15_000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [action]);

  if (!action) return null;

  const handleUndo = async () => {
    setUndoing(true);
    await onUndo();
    setUndoing(false);
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg min-w-[280px] max-w-[90vw]",
        action.undone ? "border-accent/50" : "border-border/60"
      )}>
        {action.undone ? (
          <>
            <Check className="h-4 w-4 text-accent shrink-0" />
            <span className="text-sm font-medium text-accent">Undone</span>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {action.points > 0 ? '+' : ''}{action.points} {action.studentName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{action.label}</p>
              {/* Progress bar */}
              <div className="h-0.5 w-full bg-muted/50 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs font-bold shrink-0"
              onClick={handleUndo}
              disabled={undoing}
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </Button>
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
