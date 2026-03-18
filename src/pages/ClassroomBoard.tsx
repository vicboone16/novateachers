/**
 * ClassroomBoard — Read-only projectable page showing student points,
 * class goals, celebrations, mission of the day, word of the week.
 * No edit controls — designed for projection/student viewing.
 */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Star, Zap, Award, Target, Trophy, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface BoardSettings {
  show_points: boolean;
  show_class_goal: boolean;
  show_mission: boolean;
  show_word_of_week: boolean;
  show_reward_progress: boolean;
  show_celebrations: boolean;
  mission_text: string | null;
  word_of_week: string | null;
  class_goal_label: string;
  class_goal_target: number;
  class_goal_current: number;
}

interface StudentProfile {
  student_id: string;
  display_name: string;
  avatar_emoji: string;
  is_visible: boolean;
}

interface PointBalance {
  student_id: string;
  balance: number;
}

const DEFAULT_SETTINGS: BoardSettings = {
  show_points: true,
  show_class_goal: true,
  show_mission: true,
  show_word_of_week: true,
  show_reward_progress: true,
  show_celebrations: true,
  mission_text: 'Be kind. Work hard. Have fun.',
  word_of_week: 'Perseverance',
  class_goal_label: 'Class Goal',
  class_goal_target: 100,
  class_goal_current: 0,
};

export default function ClassroomBoard() {
  const [params] = useSearchParams();
  const classroomId = params.get('classroom');

  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [balances, setBalances] = useState<PointBalance[]>([]);
  const [contingency, setContingency] = useState<{ name: string; target: number; current: number; reward: string } | null>(null);

  const loadBoard = useCallback(async () => {
    if (!classroomId) return;

    // Load board settings from Core
    try {
      const { data } = await supabase
        .from('classroom_board_settings' as any)
        .select('*')
        .eq('classroom_id', classroomId)
        .maybeSingle();
      if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch { /* use defaults */ }

    // Load student board profiles from Core
    try {
      const { data } = await supabase
        .from('student_board_profiles' as any)
        .select('student_id, display_name, avatar_emoji, is_visible')
        .eq('classroom_id', classroomId);
      if (data) setProfiles((data as any[]).filter(p => p.is_visible));
    } catch { /* empty */ }

    // Load point balances from Cloud
    try {
      const { data } = await cloudSupabase
        .from('beacon_points_ledger')
        .select('student_id, points')
        .order('created_at', { ascending: false });
      if (data) {
        const map = new Map<string, number>();
        for (const row of data) {
          map.set(row.student_id, (map.get(row.student_id) || 0) + row.points);
        }
        setBalances(Array.from(map.entries()).map(([student_id, balance]) => ({ student_id, balance })));
      }
    } catch { /* empty */ }

    // Load active class contingency
    try {
      const { data } = await supabase
        .from('class_contingencies' as any)
        .select('name, target_value, current_value, reward_name')
        .eq('classroom_id', classroomId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (data) setContingency({ name: data.name, target: data.target_value, current: data.current_value, reward: data.reward_name });
    } catch { /* empty */ }
  }, [classroomId]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(loadBoard, 30_000);
    return () => clearInterval(timer);
  }, [loadBoard]);

  const goalPct = settings.class_goal_target > 0
    ? Math.min(100, Math.round((settings.class_goal_current / settings.class_goal_target) * 100))
    : 0;

  const getBalance = (studentId: string) => balances.find(b => b.student_id === studentId)?.balance || 0;

  if (!classroomId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1a2e] text-white">
        <p className="text-xl">Add ?classroom=YOUR_CLASSROOM_ID to the URL</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6 font-heading select-none">
      {/* Top bar: Mission + Word of Week */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        {settings.show_mission && settings.mission_text && (
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-400/80">Mission of the Day</p>
              <p className="text-lg font-bold">{settings.mission_text}</p>
            </div>
          </div>
        )}
        {settings.show_word_of_week && settings.word_of_week && (
          <div className="flex items-center gap-3">
            <Award className="h-6 w-6 text-cyan-400" />
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-400/80">Word of the Week</p>
              <p className="text-lg font-bold">{settings.word_of_week}</p>
            </div>
          </div>
        )}
      </div>

      {/* Class Goal Progress */}
      {settings.show_class_goal && (
        <div className="mb-8 rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-400" />
              <span className="font-semibold text-lg">{settings.class_goal_label}</span>
            </div>
            <span className="text-2xl font-bold text-emerald-400">
              {settings.class_goal_current} / {settings.class_goal_target}
            </span>
          </div>
          <Progress value={goalPct} className="h-4 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-cyan-400" />
          {contingency && (
            <div className="flex items-center gap-2 mt-3 text-sm text-white/70">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Reward: <strong className="text-white">{contingency.reward}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Student Points Grid */}
      {settings.show_points && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {profiles.map(profile => {
            const pts = getBalance(profile.student_id);
            return (
              <div
                key={profile.student_id}
                className="flex flex-col items-center rounded-2xl bg-white/5 border border-white/10 p-4 transition-transform hover:scale-105"
              >
                <span className="text-4xl mb-2">{profile.avatar_emoji}</span>
                <p className="font-semibold text-sm truncate w-full text-center">
                  {profile.display_name}
                </p>
                <div className="flex items-center gap-1 mt-2 text-amber-400">
                  <Star className="h-4 w-4 fill-amber-400" />
                  <span className="text-xl font-bold">{pts}</span>
                </div>
              </div>
            );
          })}
          {profiles.length === 0 && (
            <p className="col-span-full text-center text-white/50 py-8">
              No student profiles configured for this board yet.
            </p>
          )}
        </div>
      )}

      {/* Celebrations */}
      {settings.show_celebrations && goalPct >= 100 && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="text-center animate-bounce">
            <p className="text-6xl">🎉</p>
            <p className="text-3xl font-bold text-amber-400 mt-2">GOAL REACHED!</p>
          </div>
        </div>
      )}
    </div>
  );
}
