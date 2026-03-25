/**
 * StudentNarrativeCard — Displays AI-generated daily narrative for a student.
 * Shows on student portal and parent view.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  studentId: string;
  agencyId?: string;
  variant?: 'student' | 'parent' | 'teacher';
  className?: string;
}

export function StudentNarrativeCard({ studentId, agencyId, variant = 'student', className }: Props) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [affirmation, setAffirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    loadNarrative();
  }, [studentId]);

  const loadNarrative = async () => {
    try {
      // Load from student_game_profiles.daily_narrative
      const { data } = await cloudSupabase
        .from('student_game_profiles')
        .select('daily_narrative, daily_narrative_at, identity_title, momentum_state')
        .eq('student_id', studentId)
        .maybeSingle();

      if (data) {
        const profile = data as any;
        if (profile.daily_narrative) {
          setNarrative(profile.daily_narrative);
          // Generate a quick affirmation from identity
          if (profile.identity_title) {
            setAffirmation(getAffirmation(profile.identity_title, profile.momentum_state));
          }
        }
      }
    } catch { /* silent */ }
  };

  const generateNarrative = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const { data, error } = await cloudSupabase.functions.invoke('generate-student-narrative', {
        body: { studentId, agencyId },
      });
      if (error) throw error;
      if (data?.narrative) {
        setNarrative(data.narrative);
        if (data.affirmation) setAffirmation(data.affirmation);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  if (!narrative && variant !== 'teacher') return null;

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              {variant === 'parent' ? "Today's Story" : "My Journey"}
            </p>
          </div>
          {variant === 'teacher' && (
            <Button variant="ghost" size="sm" onClick={generateNarrative} disabled={loading} className="h-6 text-[10px] gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Generate
            </Button>
          )}
        </div>
        {narrative ? (
          <p className="text-sm text-foreground leading-relaxed">{narrative}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">No narrative generated yet.</p>
        )}
        {affirmation && (
          <p className="text-xs font-medium text-primary/80 italic border-t border-primary/10 pt-2 mt-2">
            ✨ {affirmation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function getAffirmation(identity: string, momentum: string | null): string {
  const affirmations: Record<string, string[]> = {
    'Comeback Kid': [
      "You never give up — that's your superpower!",
      "Every tough moment makes you stronger.",
      "You bounce back like a champion!",
    ],
    'Momentum Rider': [
      "You're on a roll — keep that energy going!",
      "Your consistency is incredible!",
      "Nothing can slow you down!",
    ],
    'Focus Master': [
      "Your focus is getting sharper every day!",
      "When you lock in, amazing things happen!",
      "You're learning to control your power!",
    ],
    'Goal Crusher': [
      "You set goals and smash them!",
      "Your determination is inspiring!",
      "Keep aiming high — you've got this!",
    ],
    'Team Player': [
      "Your kindness makes the classroom better!",
      "You lift everyone around you up!",
      "Being a great teammate is a real gift!",
    ],
  };

  const options = affirmations[identity] || ["You're doing great — keep it up!"];
  // Pick one based on day to be consistent
  const dayIndex = new Date().getDate() % options.length;
  return options[dayIndex];
}
