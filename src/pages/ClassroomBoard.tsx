/**
 * ClassroomBoard — Read-only projectable page showing student points,
 * class goals, celebrations, mission of the day, word of the week.
 * No edit controls — designed for projection/student viewing.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Star, Award, Target, Trophy, Sparkles } from 'lucide-react';
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

// Confetti particle component
function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return (
    <div
      className="absolute w-3 h-3 rounded-sm animate-bounce"
      style={{
        left: `${x}%`,
        top: '-10px',
        backgroundColor: color,
        animationDelay: `${delay}ms`,
        animationDuration: `${1500 + Math.random() * 1000}ms`,
        transform: `rotate(${Math.random() * 360}deg)`,
      }}
    />
  );
}

export default function ClassroomBoard() {
  const [params] = useSearchParams();
  const classroomId = params.get('classroom');

  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [balances, setBalances] = useState<PointBalance[]>([]);
  const [contingency, setContingency] = useState<{ name: string; target: number; current: number; reward: string } | null>(null);
  const [recentAwards, setRecentAwards] = useState<Map<string, boolean>>(new Map());
  const [tick, setTick] = useState(0);

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

  // Auto-refresh every 15s for near-realtime projection
  useEffect(() => {
    const timer = setInterval(() => {
      loadBoard();
      setTick(t => t + 1);
    }, 15_000);
    return () => clearInterval(timer);
  }, [loadBoard]);

  const goalPct = settings.class_goal_target > 0
    ? Math.min(100, Math.round((settings.class_goal_current / settings.class_goal_target) * 100))
    : 0;

  const contingencyPct = contingency && contingency.target > 0
    ? Math.min(100, Math.round((contingency.current / contingency.target) * 100))
    : 0;

  const getBalance = (studentId: string) => balances.find(b => b.student_id === studentId)?.balance || 0;

  // Sort profiles by balance descending for leaderboard feel
  const sortedProfiles = [...profiles].sort((a, b) => getBalance(b.student_id) - getBalance(a.student_id));

  if (!classroomId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f23] text-white">
        <div className="text-center space-y-3">
          <Sparkles className="h-12 w-12 mx-auto text-amber-400 animate-pulse" />
          <p className="text-xl font-bold">Classroom Board</p>
          <p className="text-sm text-white/60">Add <code className="bg-white/10 px-2 py-0.5 rounded">?classroom=YOUR_ID</code> to the URL</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white select-none overflow-hidden relative" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Subtle animated gradient background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at 20% 50%, hsl(220 70% 20%) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, hsl(165 55% 15%) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 p-6 lg:p-8 space-y-6">
        {/* Top bar: Mission + Word of Week */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {settings.show_mission && settings.mission_text && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
                <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80 font-semibold">Mission of the Day</p>
                <p className="text-lg font-bold tracking-tight">{settings.mission_text}</p>
              </div>
            </div>
          )}
          {settings.show_word_of_week && settings.word_of_week && (
            <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '150ms' }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30">
                <Award className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/80 font-semibold">Word of the Week</p>
                <p className="text-lg font-bold tracking-tight">{settings.word_of_week}</p>
              </div>
            </div>
          )}
        </div>

        {/* Class Goal + Contingency Progress */}
        {(settings.show_class_goal || contingency) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {settings.show_class_goal && (
              <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-400" />
                    <span className="font-semibold">{settings.class_goal_label}</span>
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-emerald-400">
                    {settings.class_goal_current}<span className="text-white/40 text-base">/{settings.class_goal_target}</span>
                  </span>
                </div>
                <div className="relative">
                  <Progress value={goalPct} className="h-5 bg-white/10 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-cyan-400 [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-1000" />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{goalPct}%</span>
                </div>
              </div>
            )}

            {contingency && (
              <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 animate-fade-in" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-400" />
                    <span className="font-semibold">{contingency.name}</span>
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-amber-400">
                    {contingency.current}<span className="text-white/40 text-base">/{contingency.target}</span>
                  </span>
                </div>
                <div className="relative">
                  <Progress value={contingencyPct} className="h-5 bg-white/10 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-400 [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-1000" />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{contingencyPct}%</span>
                </div>
                <p className="text-xs text-white/50 mt-2 flex items-center gap-1.5">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  Reward: <strong className="text-white/80">{contingency.reward}</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Student Points Grid */}
        {settings.show_points && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {sortedProfiles.map((profile, idx) => {
              const pts = getBalance(profile.student_id);
              const isTop3 = idx < 3 && profiles.length > 3;
              return (
                <div
                  key={profile.student_id}
                  className={cn(
                    'group flex flex-col items-center rounded-2xl border p-4 transition-all duration-500 animate-fade-in',
                    isTop3
                      ? 'bg-gradient-to-b from-amber-500/10 to-transparent border-amber-500/30 scale-105'
                      : 'bg-white/5 border-white/10 hover:border-white/20',
                  )}
                  style={{ animationDelay: `${400 + idx * 80}ms` }}
                >
                  {isTop3 && idx === 0 && (
                    <div className="absolute -top-2 -right-2 text-lg">👑</div>
                  )}
                  <span className="text-4xl mb-2 transition-transform group-hover:scale-110">
                    {profile.avatar_emoji}
                  </span>
                  <p className="font-semibold text-sm truncate w-full text-center">
                    {profile.display_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Star className={cn("h-4 w-4", isTop3 ? "fill-amber-400 text-amber-400" : "fill-amber-500/70 text-amber-500/70")} />
                    <span className={cn(
                      "text-xl font-bold tabular-nums transition-all",
                      isTop3 ? "text-amber-400" : "text-white/90"
                    )}>
                      {pts}
                    </span>
                  </div>
                </div>
              );
            })}
            {profiles.length === 0 && (
              <p className="col-span-full text-center text-white/50 py-12">
                No student profiles configured for this board yet.
              </p>
            )}
          </div>
        )}

        {/* Celebrations overlay */}
        {settings.show_celebrations && (goalPct >= 100 || (contingencyPct || 0) >= 100) && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {/* Confetti */}
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 30 }).map((_, i) => (
                <ConfettiParticle key={i} delay={i * 100} x={Math.random() * 100} />
              ))}
            </div>
            {/* Center celebration text */}
            <div className="flex items-center justify-center h-full">
              <div className="text-center animate-bounce">
                <p className="text-7xl">🎉</p>
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 mt-3 tracking-tight">
                  GOAL REACHED!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
