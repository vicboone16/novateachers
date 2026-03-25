import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════ */
/*  TYPES                                                     */
/* ═══════════════════════════════════════════════════════════ */

export interface WalkthroughStep {
  /** CSS selector for the element to highlight */
  selector: string;
  /** Tooltip title shown above/below the element */
  title: string;
  /** Short instruction text */
  description: string;
  /** Where to position the tooltip relative to the element */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * If true, the walkthrough auto-advances when the user clicks the
   * highlighted element. Otherwise the user clicks "Next" in the tooltip.
   */
  waitForClick?: boolean;
  /** Optional route the user must be on for this step (auto-navigates) */
  route?: string;
}

export interface WalkthroughFlow {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name stored as string for serialisation
  steps: WalkthroughStep[];
}

interface WalkthroughState {
  activeFlow: WalkthroughFlow | null;
  currentStepIndex: number;
  isActive: boolean;
}

interface WalkthroughContextType extends WalkthroughState {
  startFlow: (flow: WalkthroughFlow) => void;
  nextStep: () => void;
  prevStep: () => void;
  endFlow: () => void;
}

const WalkthroughContext = createContext<WalkthroughContextType | null>(null);

export const useWalkthrough = () => {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) throw new Error('useWalkthrough must be used inside WalkthroughProvider');
  return ctx;
};

/* ═══════════════════════════════════════════════════════════ */
/*  PROVIDER                                                  */
/* ═══════════════════════════════════════════════════════════ */

export const WalkthroughProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<WalkthroughState>({
    activeFlow: null,
    currentStepIndex: 0,
    isActive: false,
  });

  const startFlow = useCallback((flow: WalkthroughFlow) => {
    setState({ activeFlow: flow, currentStepIndex: 0, isActive: true });
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (!prev.activeFlow) return prev;
      const next = prev.currentStepIndex + 1;
      if (next >= prev.activeFlow.steps.length) {
        return { activeFlow: null, currentStepIndex: 0, isActive: false };
      }
      return { ...prev, currentStepIndex: next };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStepIndex: Math.max(0, prev.currentStepIndex - 1),
    }));
  }, []);

  const endFlow = useCallback(() => {
    setState({ activeFlow: null, currentStepIndex: 0, isActive: false });
  }, []);

  return (
    <WalkthroughContext.Provider value={{ ...state, startFlow, nextStep, prevStep, endFlow }}>
      {children}
    </WalkthroughContext.Provider>
  );
};
