/**
 * 3-screen swipe walkthrough — calming, quick, human.
 */
import { useState } from 'react';
import { Brain, Users, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

const SLIDES = [
  {
    icon: Brain,
    title: "You don't have to remember everything anymore",
    text: "Just tap behaviors as they happen.\nNo trying to recall things later.",
    color: 'bg-accent/10 text-accent',
  },
  {
    icon: Users,
    title: "You're not doing this alone",
    text: "Send quick updates.\nEveryone stays in the loop without extra effort.",
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: Sparkles,
    title: 'Start small',
    text: "Use it once today. That's it.",
    color: 'bg-warning/10 text-warning',
  },
] as const;

interface WalkthroughCarouselProps {
  open: boolean;
  onComplete: () => void;
}

export const WalkthroughCarousel = ({ open, onComplete }: WalkthroughCarouselProps) => {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const Icon = slide.icon;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl border-0 shadow-xl p-8 text-center">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-primary' : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className={`mx-auto w-20 h-20 rounded-2xl ${slide.color} flex items-center justify-center mb-6`}>
          <Icon className="h-10 w-10" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-foreground mb-3 leading-tight">
          {slide.title}
        </h2>

        {/* Text */}
        <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-line mb-8">
          {slide.text}
        </p>

        {/* Action */}
        {isLast ? (
          <Button
            size="lg"
            className="w-full h-12 text-base rounded-xl"
            onClick={onComplete}
          >
            Take me to my classroom
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full h-12 text-base rounded-xl gap-2"
            onClick={() => setStep(step + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
