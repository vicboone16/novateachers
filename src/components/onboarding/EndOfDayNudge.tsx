/**
 * End-of-session positive nudge — shows when user has been active today.
 * Non-intrusive floating toast.
 */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EndOfDayNudgeProps {
  totalActionsToday: number;
}

export const EndOfDayNudge = ({ totalActionsToday }: EndOfDayNudgeProps) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show nudge if user has been active and it's afternoon/evening
    const hour = new Date().getHours();
    const sessionKey = `beacon_eod_nudge_${new Date().toDateString()}`;
    const alreadyShown = sessionStorage.getItem(sessionKey);

    if (totalActionsToday > 0 && hour >= 14 && !alreadyShown) {
      const timer = setTimeout(() => {
        setVisible(true);
        sessionStorage.setItem(sessionKey, 'true');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [totalActionsToday]);

  useEffect(() => {
    if (visible) {
      const auto = setTimeout(() => setDismissed(true), 6000);
      return () => clearTimeout(auto);
    }
  }, [visible]);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm w-[90vw]">
      <div className="relative px-5 py-4 rounded-xl bg-card border border-border shadow-lg text-center">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="text-sm font-semibold text-foreground">
          You used Beacon today 👏
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          That's exactly what we want. Small steps count.
        </p>
      </div>
    </div>
  );
};
