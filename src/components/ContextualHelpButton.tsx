import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ContextualHelpButtonProps {
  tip: string;
  className?: string;
}

/**
 * Small "?" icon with a tooltip. Drop it next to any UI element
 * to give users contextual help without leaving the page.
 *
 * Usage:
 *   <ContextualHelpButton tip="Points earned today for positive behavior." />
 */
export const ContextualHelpButton = ({ tip, className = '' }: ContextualHelpButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className={`inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors ${className}`}
        aria-label="Help"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
      {tip}
    </TooltipContent>
  </Tooltip>
);
