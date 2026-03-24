/**
 * ClassroomBoard — Kid-safe projectable page.
 * Pulls from Cloud (points, groups, feed) and Core (board settings, game profiles).
 * Uses ActiveClassroomContext when available, otherwise resolves independently.
 * No teacher controls visible.
 */
import { useEffect, useState, useCallback, useContext } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Star, Award, Target, Trophy, Sparkles, Flag, Users, Gift } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface BoardSettings {
  show_points: boolean;
  show_class_goal: boolean;
  show_mission: boolean;
  show_word_of_week: boolean;
  show_reward_progress: boolean;
  show_celebrations: boolean;
  privacy_mode: 'full_names' | 'first_names' | 'initials' | 'avatars_only';
  mission_text: string | null;
  word_of_week: string | null;
  class_goal_label: string;
  class_goal_target: number;
  class_goal_current: number;
  teams_enabled: boolean;
  point_display_type: string;
}

interface StudentCard {
  student_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_emoji: string;
  balance: number;
  team_name?: string;
  team_color?: string;
}

interface FeedPost {
  id: string;
  body: string;
  post_type: string;
  title: string | null;
  created_at: string;
}

const DEFAULT_SETTINGS: BoardSettings = {
  show_points: true,
  show_class_goal: true,
  show_mission: true,
  show_word_of_week: true,
  show_reward_progress: true,
  show_celebrations: true,
  privacy_mode: 'first_names',
  mission_text: 'Be kind. Work hard. Have fun.',
  word_of_week: 'Perseverance',
  class_goal_label: 'Class Goal',
  class_goal_target: 100,
  class_goal_current: 0,
  teams_enabled: false,
  point_display_type: 'stars',
};

const TRACK_LENGTH = 100;
const CHECKPOINT_INTERVAL = 20;

function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return (
    <div className="absolute w-3 h-3 rounded-sm animate-bounce"
      style={{ left: `${x}%`, top: '-10px', backgroundColor: color, animationDelay: `${delay}ms`, animationDuration: `${1500 + Math.random() * 1000}ms`, transform: `rotate(${Math.random() * 360}deg)` }} />
  );
}

export default function ClassroomBoard() {
  const [params] = useSearchParams();
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const classroomParam = params.get('classroom');

  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_SETTINGS);
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [classroomId, setClassroomId] = useState<string | null>(classroomParam);
  const [classroomName, setClassroomName] = useState('');
  const [recentFlash, setRecentFlash] = useState<string | null>(null);
  const [topRewards, setTopRewards] = useState<{ name: string; emoji: string; cost: number }[]>([]);
  const [resolveState, setResolveState] = useState<'loading' | 'resolved' | 'empty'>('loading');

  // Resolution: slug → URL param → teacher membership → any group
  useEffect(() => {
    if (classroomParam) {
      setClassroomId(classroomParam);
      setResolveState('resolved');
      return;
    }

    // Resolve by slug first
    if (slug) {
      cloudSupabase
        .from('classroom_groups')
        .select('group_id')
        .eq('board_slug', slug)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            console.log('[Board] Resolved via slug:', slug, (data as any).group_id);
            setClassroomId((data as any).group_id);
            setResolveState('resolved');
          } else {
            console.warn('[Board] No classroom found for slug:', slug);
            setResolveState('empty');
          }
        });
      return;
    }

    let cancelled = false;
    const resolve = async () => {
      console.log('[Board] Resolving classroom, user:', user?.id || 'none');

      // 1) Try teacher membership
      if (user) {
        try {
          const { data } = await cloudSupabase.from('classroom_group_teachers').select('group_id').eq('user_id', user.id).limit(1);
          if (!cancelled && data?.[0]) {
            console.log('[Board] Resolved via teacher_membership:', data[0].group_id);
            setClassroomId(data[0].group_id);
            setResolveState('resolved');
            return;
          }
        } catch { /* continue */ }
      }

      // 2) Any classroom group (broad fallback — board is kid-facing, no auth required)
      try {
        const { data: groups } = await cloudSupabase.from('classroom_groups').select('group_id').limit(1);
        if (!cancelled && groups?.[0]) {
          console.log('[Board] Resolved via first_available:', groups[0].group_id);
          setClassroomId(groups[0].group_id);
          setResolveState('resolved');
          return;
        }
      } catch (e) {
        console.warn('[Board] classroom_groups query failed:', e);
      }

      if (!cancelled) {
        console.warn('[Board] No classroom found at all');
        setResolveState('empty');
      }
    };

    // Wait a moment for auth, then resolve
    const delay = setTimeout(resolve, user ? 100 : 800);
    const timeout = setTimeout(() => {
      if (!cancelled && resolveState === 'loading') setResolveState('empty');
    }, 8000);
    return () => { cancelled = true; clearTimeout(delay); clearTimeout(timeout); };
  }, [classroomParam, user]);

  const loadBoard = useCallback(async () => {
    if (!classroomId) return;

    // Load classroom name
    const { data: grp } = await cloudSupabase.from('classroom_groups').select('name').eq('group_id', classroomId).maybeSingle();
    if (grp) setClassroomName((grp as any).name || '');

    // Load board settings from Core
    try {
      const { data } = await supabase.from('classroom_board_settings' as any).select('*').eq('classroom_id', classroomId).maybeSingle();
      if (data) setSettings(prev => ({ ...prev, ...data as any }));
    } catch { /* use defaults */ }

    // Load game settings from Core for privacy/teams
    try {
      const { data } = await supabase.from('classroom_game_settings' as any).select('privacy_mode, teams_enabled, point_display_type, mission_of_the_day, word_of_the_week').eq('group_id', classroomId).maybeSingle();
      if (data) {
        const d = data as any;
        setSettings(prev => ({
          ...prev,
          privacy_mode: d.privacy_mode || prev.privacy_mode,
          teams_enabled: d.teams_enabled || prev.teams_enabled,
          point_display_type: d.point_display_type || prev.point_display_type,
          mission_text: d.mission_of_the_day || prev.mission_text,
          word_of_week: d.word_of_the_week || prev.word_of_week,
        }));
      }
    } catch { /* silent */ }

    // Load students in this group
    const { data: groupStudents } = await cloudSupabase.from('classroom_group_students').select('client_id').eq('group_id', classroomId);
    const studentIds = (groupStudents || []).map((s: any) => s.client_id);
    if (studentIds.length === 0) { setStudents([]); return; }

    // Load balances from Cloud
    const { data: ledger } = await cloudSupabase.from('beacon_points_ledger').select('student_id, points').in('student_id', studentIds);
    const balMap = new Map<string, number>();
    for (const row of (ledger || [])) {
      balMap.set(row.student_id, (balMap.get(row.student_id) || 0) + row.points);
    }

    // Load student names from Core — try by ID first, then by agency fallback
    let nameMap = new Map<string, { first_name: string; last_name: string }>();
    try {
      const { data: clients } = await supabase.from('clients' as any).select('id, first_name, last_name').in('id', studentIds);
      for (const c of (clients || []) as any[]) {
        nameMap.set(c.id, { first_name: c.first_name || '', last_name: c.last_name || '' });
      }
    } catch { /* silent */ }
    // If we didn't resolve all names, try loading ALL agency clients and matching
    if (nameMap.size < studentIds.length) {
      try {
        const { data: grpData } = await cloudSupabase.from('classroom_groups').select('agency_id').eq('group_id', classroomId).maybeSingle();
        const aid = (grpData as any)?.agency_id;
        if (aid) {
          const { data: allClients } = await supabase.from('clients' as any).select('id, first_name, last_name').eq('agency_id', aid);
          for (const c of (allClients || []) as any[]) {
            if (studentIds.includes(c.id) && !nameMap.has(c.id)) {
              nameMap.set(c.id, { first_name: c.first_name || '', last_name: c.last_name || '' });
            }
          }
        }
      } catch { /* silent */ }
    }

    // Load game profiles for avatars
    let avatarMap = new Map<string, string>();
    try {
      const { data: profiles } = await supabase.from('student_game_profiles' as any).select('student_id, avatar_emoji').in('student_id', studentIds);
      for (const p of (profiles || []) as any[]) {
        avatarMap.set(p.student_id, p.avatar_emoji || '');
      }
    } catch { /* silent */ }

    const cards: StudentCard[] = studentIds.map(sid => {
      const names = nameMap.get(sid);
      return {
        student_id: sid,
        display_name: names ? `${names.first_name} ${names.last_name}`.trim() : sid.slice(0, 6),
        first_name: names?.first_name || '',
        last_name: names?.last_name || '',
        avatar_emoji: avatarMap.get(sid) || '👤',
        balance: balMap.get(sid) || 0,
      };
    });
    setStudents(cards.sort((a, b) => b.balance - a.balance));

    // Load kid-safe feed posts
    try {
      const { data: posts } = await cloudSupabase.from('classroom_feed_posts')
        .select('id, body, post_type, title, created_at')
        .eq('group_id', classroomId)
        .in('post_type', ['celebration', 'announcement', 'positive'])
        .order('created_at', { ascending: false })
        .limit(5);
      setFeedPosts((posts || []) as any[]);
    } catch { /* silent */ }

    // Load top rewards preview
    try {
      const { data: rws } = await supabase.from('beacon_rewards' as any).select('name, emoji, cost').eq('active', true).order('cost', { ascending: true }).limit(4);
      setTopRewards((rws || []).map((r: any) => ({ name: r.name, emoji: r.emoji || '🎁', cost: r.cost })));
    } catch { /* silent */ }
  }, [classroomId, user]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Fallback polling every 15s + reconnect on tab wake
  useEffect(() => {
    const timer = setInterval(loadBoard, 15_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') loadBoard(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [loadBoard]);

  // Realtime: points + feed posts
  useEffect(() => {
    const channel = cloudSupabase.channel('board-live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'beacon_points_ledger',
      }, (payload: any) => {
        const sid = payload.new?.student_id;
        const pts = payload.new?.points || 0;
        if (sid) {
          setStudents(prev => {
            const updated = prev.map(s => s.student_id === sid ? { ...s, balance: s.balance + pts } : s);
            return updated.sort((a, b) => b.balance - a.balance);
          });
          setRecentFlash(sid);
          setTimeout(() => setRecentFlash(null), 2000);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'classroom_feed_posts',
      }, (payload: any) => {
        const post = payload.new;
        if (post && ['celebration', 'announcement', 'positive'].includes(post.post_type)) {
          setFeedPosts(prev => [{ id: post.id, body: post.body, post_type: post.post_type, title: post.title, created_at: post.created_at }, ...prev].slice(0, 5));
        }
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, []);

  const getDisplayName = (s: StudentCard) => {
    const mode = settings.privacy_mode;
    if (mode === 'avatars_only') return '';
    if (mode === 'initials') return `${s.first_name[0] || ''}${s.last_name[0] || ''}`;
    if (mode === 'first_names') return s.first_name || s.display_name.split(' ')[0];
    return s.display_name;
  };

  const totalClassPoints = students.reduce((sum, s) => sum + s.balance, 0);
  const goalPct = settings.class_goal_target > 0 ? Math.min(100, Math.round((totalClassPoints / settings.class_goal_target) * 100)) : 0;
  const finishedCount = students.filter(s => s.balance >= TRACK_LENGTH).length;
  const skinIcon = settings.point_display_type === 'points' ? '💎' : settings.point_display_type === 'xp' ? '⚡' : '⭐';

  if (!classroomId) {
    if (resolveState === 'empty') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <div className="text-center space-y-4">
            <Sparkles className="h-12 w-12 mx-auto text-amber-400/50" />
            <p className="text-xl font-bold text-foreground">No Classroom Found</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Could not find a classroom to display. Make sure you are assigned to a classroom group.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setResolveState('loading'); window.location.reload(); }} className="rounded-xl bg-secondary border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors">Retry</button>
              <button onClick={() => window.history.back()} className="rounded-xl bg-muted border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 transition-colors">Go Back</button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <Sparkles className="h-12 w-12 mx-auto text-amber-400 animate-pulse" />
          <p className="text-xl font-bold text-foreground">Classroom Board</p>
          <p className="text-sm text-muted-foreground">Finding your classroom…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 text-foreground select-none overflow-hidden relative" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>

      <div className="relative z-10 p-5 lg:p-8 space-y-5">
        {/* Header band */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-card rounded-2xl shadow-sm border border-border/60 p-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">{classroomName || 'Classroom Board'}</h1>
            <div className="flex items-center gap-3 mt-1">
              {settings.show_mission && settings.mission_text && (
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-sm text-muted-foreground font-medium">{settings.mission_text}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {settings.show_word_of_week && settings.word_of_week && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Word of the Week</p>
                <p className="text-lg font-bold text-primary">{settings.word_of_week}</p>
              </div>
            )}
          </div>
        </div>

        {/* Score band */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Class total */}
          <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-2xl">{skinIcon}</div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Class Total</p>
              <p className="text-3xl font-black tabular-nums text-amber-600 dark:text-amber-400">{totalClassPoints.toLocaleString()}</p>
            </div>
          </div>

          {/* Class goal */}
          {settings.show_class_goal && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5"><Target className="h-4 w-4 text-accent" /><span className="text-sm font-semibold text-foreground">{settings.class_goal_label}</span></div>
                <span className="text-lg font-bold tabular-nums text-accent">{goalPct}%</span>
              </div>
              <Progress value={goalPct} className="h-3 rounded-full [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-1000" />
            </div>
          )}

          {/* Race progress */}
          <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-4 flex items-center gap-4">
            <Flag className="h-8 w-8 text-violet-500 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Race</p>
              <p className="text-lg font-bold text-foreground">{finishedCount > 0 ? `${finishedCount} finished!` : `${students.length} racing`}</p>
            </div>
          </div>

          {/* Students */}
          <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-4 flex items-center gap-4">
            <Users className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Students</p>
              <p className="text-lg font-bold text-foreground">{students.length}</p>
            </div>
          </div>
        </div>

        {/* Student board grid — BIG cards for projector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
          {students.map((s, idx) => {
            const pos = Math.min(s.balance, TRACK_LENGTH);
            const cp = Math.floor(pos / CHECKPOINT_INTERVAL);
            const isFinished = pos >= TRACK_LENGTH;
            const isFlashing = recentFlash === s.student_id;
            const isTop3 = idx < 3 && students.length > 3;

            return (
              <div key={s.student_id}
                className={cn(
                  'relative flex flex-col items-center rounded-2xl border p-4 transition-all duration-700',
                  isFlashing ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-400/50 scale-105 shadow-lg' :
                  isTop3 ? 'bg-gradient-to-b from-amber-50 to-card dark:from-amber-900/10 dark:to-card border-amber-200 dark:border-amber-500/20' :
                  'bg-card border-border/60',
                  isFinished && 'ring-1 ring-accent/40',
                )}
                style={{ animationDelay: `${idx * 60}ms` }}>
                {/* Rank badge */}
                {isTop3 && (
                  <div className="absolute -top-2 -right-2 text-base">
                    {idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                )}
                {isFinished && <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm">🏆</div>}

                {/* Flash effect */}
                {isFlashing && <div className="absolute inset-0 rounded-2xl bg-amber-400/10 animate-ping pointer-events-none" style={{ animationDuration: '1s' }} />}

                <span className="text-4xl mb-1.5 transition-transform duration-300" style={isFlashing ? { transform: 'scale(1.15)' } : {}}>{s.avatar_emoji}</span>
                <p className="font-semibold text-sm truncate w-full text-center text-foreground">{getDisplayName(s)}</p>

                {/* Points */}
                <div className="flex items-center gap-1 mt-1.5">
                  <Star className={cn("h-4 w-4", isTop3 ? "fill-amber-500 text-amber-500" : "fill-amber-400 text-amber-400")} />
                  <span className={cn("text-xl font-black tabular-nums", isTop3 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{s.balance}</span>
                </div>

                {/* Race mini-bar */}
                <div className="w-full mt-2 space-y-0.5">
                  <Progress value={(pos / TRACK_LENGTH) * 100} className="h-1.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-primary [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-700" />
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-muted-foreground tabular-nums">{cp}cp</span>
                    {s.team_name && <span className="text-[8px] font-bold" style={{ color: s.team_color || '#6b7280' }}>{s.team_name}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {students.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-16 text-lg">No students in this classroom yet.</p>
          )}
        </div>

        {/* Bottom band: Rewards preview + Feed */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Rewards preview */}
          {topRewards.length > 0 && settings.show_reward_progress && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="h-4 w-4 text-pink-500" />
                <span className="text-sm font-semibold text-foreground">Rewards</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {topRewards.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/50 border border-border/60 px-3 py-2">
                    <span className="text-xl">{r.emoji}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{r.name}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold tabular-nums">{skinIcon} {r.cost}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kid-safe feed */}
          {feedPosts.length > 0 && (
            <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">Celebrations</span>
              </div>
              <div className="space-y-2">
                {feedPosts.map(post => (
                  <div key={post.id} className="rounded-xl bg-secondary/50 px-3 py-2">
                    {post.title && <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{post.title}</p>}
                    <p className="text-xs text-foreground/80">{post.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Celebration overlay */}
      {settings.show_celebrations && goalPct >= 100 && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => (
              <ConfettiParticle key={i} delay={i * 100} x={Math.random() * 100} />
            ))}
          </div>
          <div className="flex items-center justify-center h-full">
            <div className="text-center animate-bounce">
              <p className="text-7xl">🎉</p>
              <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 mt-3">GOAL REACHED!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}