import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { WALKTHROUGH_FLOWS } from '@/lib/walkthrough-flows';
import { Button } from '@/components/ui/button';
import { X, Lightbulb, Users, Star, MessageCircle, LayoutDashboard, Gift, Gamepad2, AlertTriangle, Play } from 'lucide-react';

interface HelpSuggestion {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
  route?: string;
  faqTab?: string;
  walkthroughId?: string;
}

export const SmartHelpBanner = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { startFlow, isActive: walkthroughActive } = useWalkthrough();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('beacon_help_dismissed');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [suggestion, setSuggestion] = useState<HelpSuggestion | null>(null);

  const agencyId = currentWorkspace?.agency_id;

  useEffect(() => {
    if (!user || !agencyId) return;
    detectSuggestion();
  }, [user, agencyId, pathname]);

  const detectSuggestion = async () => {
    if (!agencyId || !user) return;

    if (pathname === '/classroom') {
      const { data: groups } = await supabase
        .from('classroom_group_teachers')
        .select('group_id')
        .eq('user_id', user.id)
        .limit(1);

      if (!groups || groups.length === 0) {
        setSuggestion({
          id: 'no-classroom',
          icon: LayoutDashboard,
          title: 'Set up your first classroom',
          description: 'Create a classroom to get started with attendance, points, and data collection.',
          action: 'Start Walkthrough',
          walkthroughId: 'create-classroom',
        });
        return;
      }

      if (groups.length > 0) {
        const { data: students } = await supabase
          .from('classroom_group_students')
          .select('id')
          .eq('group_id', groups[0].group_id)
          .limit(1);

        if (!students || students.length === 0) {
          setSuggestion({
            id: 'no-students',
            icon: Users,
            title: 'Add students to your classroom',
            description: 'Your classroom is empty. Add students to start tracking attendance and behavior.',
            action: 'Add Students',
            route: '/classrooms',
          });
          return;
        }

        // Check point usage
        const { count } = await supabase
          .from('beacon_points_ledger')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('staff_id', user.id)
          .limit(1);

        if (count === 0) {
          setSuggestion({
            id: 'no-points-classroom',
            icon: Star,
            title: 'Try awarding your first points',
            description: 'Tap + on any student card to reinforce positive behavior instantly.',
            action: 'Show Me How',
            walkthroughId: 'add-points',
          });
          return;
        }
      }
    }

    if (pathname === '/rewards') {
      const { count } = await supabase
        .from('beacon_points_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('staff_id', user.id)
        .limit(1);

      if (count === 0) {
        setSuggestion({
          id: 'no-points',
          icon: Star,
          title: 'Start using Beacon Points',
          description: 'Award your first points to motivate students. Tap + on any student card in the Classroom View.',
          action: 'Show Me How',
          walkthroughId: 'add-points',
        });
        return;
      }
    }

    if (pathname === '/threads') {
      const { count } = await supabase
        .from('thread_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .limit(1);

      if (count === 0) {
        setSuggestion({
          id: 'no-threads',
          icon: MessageCircle,
          title: 'Start your first conversation',
          description: 'Threads let you coordinate with your team in real time. Create or join a thread to get started.',
          action: 'Show Me How',
          walkthroughId: 'send-message',
        });
        return;
      }
    }

    if (pathname === '/game-board') {
      setSuggestion({
        id: 'game-board-tip',
        icon: Gamepad2,
        title: 'Project this on your smartboard',
        description: 'Copy the board URL and open it on your classroom display for a live race view.',
        action: 'Learn More',
        route: '/faq',
      });
      return;
    }

    setSuggestion(null);
  };

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    sessionStorage.setItem('beacon_help_dismissed', JSON.stringify([...next]));
    setSuggestion(null);
  };

  const handleAction = () => {
    if (!suggestion) return;
    if (suggestion.walkthroughId) {
      const flow = WALKTHROUGH_FLOWS.find((f) => f.id === suggestion.walkthroughId);
      if (flow) {
        startFlow(flow);
        return;
      }
    }
    if (suggestion.route) navigate(suggestion.route);
  };

  if (walkthroughActive) return null;
  if (!suggestion || dismissed.has(suggestion.id)) return null;

  const SIcon = suggestion.icon;

  return (
    <div className="mb-4 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <SIcon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">{suggestion.title}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{suggestion.description}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs gap-1"
          onClick={handleAction}
        >
          {suggestion.walkthroughId && <Play className="h-3 w-3" />}
          {suggestion.action}
        </Button>
      </div>
      <button
        onClick={() => dismiss(suggestion.id)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
