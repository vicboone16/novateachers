/**
 * Master onboarding orchestrator — renders welcome modal, walkthrough,
 * and manages state transitions. Drop into AppLayout.
 */
import { useState, useCallback } from 'react';
import { useStaffOnboarding } from '@/hooks/useStaffOnboarding';
import { WelcomeModal } from './WelcomeModal';
import { WalkthroughCarousel } from './WalkthroughCarousel';
import { FirstActionCelebration } from './FirstActionCelebration';
import { EndOfDayNudge } from './EndOfDayNudge';

export const StaffOnboardingFlow = () => {
  const {
    loading,
    isFirstLogin,
    welcomeDismissed,
    walkthroughCompleted,
    firstActionCompleted,
    totalActions,
    dismissWelcome,
    completeWalkthrough,
  } = useStaffOnboarding();

  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [celebration, setCelebration] = useState<{
    type: 'first_action' | 'milestone';
    message?: string;
  } | null>(null);

  const handleShowWalkthrough = useCallback(() => {
    dismissWelcome();
    setShowWalkthrough(true);
  }, [dismissWelcome]);

  const handleSkip = useCallback(() => {
    dismissWelcome();
  }, [dismissWelcome]);

  const handleDontShowAgain = useCallback(() => {
    dismissWelcome();
    completeWalkthrough(); // marks onboarding fully done so it never reappears
  }, [dismissWelcome, completeWalkthrough]);

  const handleWalkthroughComplete = useCallback(() => {
    setShowWalkthrough(false);
    completeWalkthrough();
  }, [completeWalkthrough]);

  if (loading) return null;

  return (
    <>
      {/* Welcome modal — first login only */}
      <WelcomeModal
        open={isFirstLogin && !welcomeDismissed}
        onShowWalkthrough={handleShowWalkthrough}
        onSkip={handleSkip}
        onDontShowAgain={handleDontShowAgain}
      />

      {/* Walkthrough carousel */}
      <WalkthroughCarousel
        open={showWalkthrough}
        onComplete={handleWalkthroughComplete}
      />

      {/* Celebration popup */}
      {celebration && (
        <FirstActionCelebration
          type={celebration.type}
          message={celebration.message}
          onDismiss={() => setCelebration(null)}
        />
      )}

      {/* End of day nudge */}
      <EndOfDayNudge totalActionsToday={totalActions} />
    </>
  );
};

// Re-export hook for use in other components
export { useStaffOnboarding } from '@/hooks/useStaffOnboarding';
