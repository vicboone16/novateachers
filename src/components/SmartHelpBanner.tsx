import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { X, Lightbulb, Users, Star, MessageCircle, LayoutDashboard } from 'lucide-react';

interface HelpSuggestion {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
  route?: string;
  faqTab?: string;
}

export const SmartHelpBanner = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('beacon_help_dismissed');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [suggestion, setSuggestion] = useState<HelpSuggestion | null>(null);

  const agencyId = currentWorkspace?.agencyId;

  useEffect(() => {
    if (!user || !agencyId) return;
    detectSuggestion();
  }, [user, agencyId, pathname]);

  const detectSuggestion = async () => {
    if (!agencyId || !user) return;

    // Only show on specific pages
    if (pathname === '/classroom') {
      // Check if user has any classrooms
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
          action: 'Create Classroom',
          route: '/classrooms',
        });
        return;
      }

      // Check if classroom has students
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
      }
    }

    if (pathname === '/rewards') {
      // Check if any points have been used
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
          action: 'Learn How',
          route: '/faq',
          faqTab: 'tutorials',
        });
        return;
      }
    }

    if (pathname === '/threads') {
      setSuggestion(null);
    }

    // Default: no suggestion
    setSuggestion(null);
  };

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    sessionStorage.setItem('beacon_help_dismissed', JSON.stringify([...next]));
    setSuggestion(null);
  };

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
          onClick={() => suggestion.route && navigate(suggestion.route)}
        >
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
