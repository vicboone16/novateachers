/**
 * Micro-celebration popup for first action + milestone messages.
 * Non-intrusive, warm, disappears after a few seconds.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface FirstActionCelebrationProps {
  type: 'first_action' | 'milestone';
  message?: string;
  onDismiss: () => void;
}

export const FirstActionCelebration = ({ type, message, onDismiss }: FirstActionCelebrationProps) => {
  const [open, setOpen] = useState(true);

  // Auto-dismiss after 5s for milestones
  useEffect(() => {
    if (type === 'milestone') {
      const t = setTimeout(() => {
        setOpen(false);
        onDismiss();
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [type, onDismiss]);

  const handleClose = () => {
    setOpen(false);
    onDismiss();
  };

  if (type === 'first_action') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-xs mx-auto rounded-2xl border-0 shadow-xl p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            That's it. You did it ✔
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            You don't have to be perfect — just keep going.
          </p>
          <Button
            className="w-full h-10 rounded-xl"
            onClick={handleClose}
          >
            Keep going
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Milestone toast-style
  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300"
      onClick={handleClose}
    >
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border shadow-lg cursor-pointer">
        <Sparkles className="h-5 w-5 text-warning shrink-0" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
};
