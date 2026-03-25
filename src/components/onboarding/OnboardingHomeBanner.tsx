/**
 * Beacon Home top banner + 3 action cards for new/early staff.
 * Warm, encouraging, low-pressure.
 */
import { useNavigate } from 'react-router-dom';
import { Zap, MessageCircle, Users, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface OnboardingHomeBannerProps {
  onboardingDay: number;
  onLogBehavior?: () => void;
  onSendUpdate?: () => void;
  onWhosHere?: () => void;
}

const ACTION_CARDS = [
  {
    key: 'log_behavior',
    icon: Zap,
    title: 'Tap a Behavior',
    subtitle: 'Takes 2 seconds',
    color: 'bg-accent/10 text-accent',
  },
  {
    key: 'send_update',
    icon: MessageCircle,
    title: 'Send Update',
    subtitle: 'Keep everyone in the loop',
    color: 'bg-primary/10 text-primary',
  },
  {
    key: 'whos_here',
    icon: Users,
    title: "Who's Here",
    subtitle: 'See your classroom at a glance',
    color: 'bg-warning/10 text-warning',
  },
] as const;

export const OnboardingHomeBanner = ({ onboardingDay, onLogBehavior, onSendUpdate, onWhosHere }: OnboardingHomeBannerProps) => {
  const navigate = useNavigate();

  const handleCardClick = (key: string) => {
    switch (key) {
      case 'log_behavior':
        onLogBehavior?.();
        break;
      case 'send_update':
        if (onSendUpdate) onSendUpdate();
        else navigate('/threads');
        break;
      case 'whos_here':
        onWhosHere?.();
        break;
    }
  };

  // Only show for first ~5 days
  if (onboardingDay > 7) return null;

  return (
    <div className="space-y-4 mb-6">
      {/* Encouragement banner */}
      <div className="text-center py-4 px-6 rounded-2xl bg-primary/5 border border-primary/10">
        <p className="text-lg font-semibold text-foreground">
          Try this: tap ONE thing today 👇
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          That counts. You don't need to do everything.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid gap-3">
        {ACTION_CARDS.map((card) => {
          // Phase features based on onboarding day
          if (card.key === 'send_update' && onboardingDay < 2) return null;

          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border-border/50"
              onClick={() => handleCardClick(card.key)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center shrink-0`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{card.title}</h3>
                  <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help link */}
      <div className="text-center">
        <button
          onClick={() => navigate('/faq')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <HelpCircle className="h-3 w-3" />
          Need help? Tap anytime.
        </button>
      </div>
    </div>
  );
};
