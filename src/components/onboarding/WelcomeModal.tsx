/**
 * First-login welcome modal — warm, non-technical, burnout-aware.
 */
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface WelcomeModalProps {
  open: boolean;
  onShowWalkthrough: () => void;
  onSkip: () => void;
}

export const WelcomeModal = ({ open, onShowWalkthrough, onSkip }: WelcomeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl border-0 shadow-xl p-8 text-center">
        <DialogHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">
            We got you 🤍
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground leading-relaxed">
            This is here to make your day easier — not give you more work.
            <br />
            You don't need to learn everything right now. We'll keep this simple.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-6">
          <Button
            size="lg"
            className="w-full text-base h-12 rounded-xl"
            onClick={onShowWalkthrough}
          >
            Show me (30 sec)
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-sm h-10 text-muted-foreground"
            onClick={onSkip}
          >
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
