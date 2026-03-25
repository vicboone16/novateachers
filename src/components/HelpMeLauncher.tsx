import { useState } from 'react';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { WALKTHROUGH_FLOWS } from '@/lib/walkthrough-flows';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  HelpCircle,
  AlertTriangle,
  Star,
  LayoutDashboard,
  MessageCircle,
  Heart,
  Play,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  AlertTriangle,
  Star,
  LayoutDashboard,
  MessageCircle,
  Heart,
};

export const HelpMeLauncher = () => {
  const { startFlow, isActive } = useWalkthrough();
  const [open, setOpen] = useState(false);

  if (isActive) return null; // hide while walkthrough is running

  const handleStart = (flowId: string) => {
    const flow = WALKTHROUGH_FLOWS.find((f) => f.id === flowId);
    if (flow) {
      setOpen(false);
      // Small delay so sheet closes first
      setTimeout(() => startFlow(flow), 200);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95"
          aria-label="Help me do this"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Help Me Do This
          </SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Select an action and we'll walk you through it step by step.
        </p>
        <div className="space-y-2 pb-4">
          {WALKTHROUGH_FLOWS.map((flow) => {
            const FlowIcon = iconMap[flow.icon] || HelpCircle;
            return (
              <button
                key={flow.id}
                onClick={() => handleStart(flow.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <FlowIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{flow.title}</h3>
                  <p className="text-xs text-muted-foreground">{flow.description}</p>
                </div>
                <Play className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
