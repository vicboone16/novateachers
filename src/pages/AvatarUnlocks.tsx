/**
 * AvatarUnlocks — Teacher-facing avatar & unlock management.
 * Shows all students in the active classroom with their avatars, levels, and unlock progress.
 * Teachers can view/manage individual student unlocks.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { getUnlockCatalog, getStudentUnlocks, getStudentStreaks } from '@/lib/game-data';
import type { UnlockCatalogItem, StudentUnlock, StudentStreak } from '@/lib/game-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Unlock, Flame, Trophy, Sparkles, Star, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentRow {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface GameProfile {
  student_id: string;
  avatar_emoji: string;
  current_level: number;
  current_xp: number;
}

const AvatarUnlocks = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { agencyId } = useAppAccess();
  const { groupId } = useActiveClassroom();

  const selectedStudent = searchParams.get('student') || '';

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, GameProfile>>({});
  const [catalog, setCatalog] = useState<UnlockCatalogItem[]>([]);
  const [unlocks, setUnlocks] = useState<StudentUnlock[]>([]);
  const [streaks, setStreaks] = useState<StudentStreak[]>([]);
  const [loading, setLoading] = useState(true);

  // Load students in the active classroom
  useEffect(() => {
    if (!groupId) return;
    const load = async () => {
      setLoading(true);
      const { data: groupStudents } = await cloudSupabase
        .from('classroom_group_students')
        .select('client_id, first_name, last_name')
        .eq('group_id', groupId);
      const studs = (groupStudents || []) as StudentRow[];
      setStudents(studs);

      // Load game profiles for all students
      if (studs.length > 0) {
        const sids = studs.map(s => s.client_id);
        const { data: gp } = await cloudSupabase
          .from('student_game_profiles')
          .select('student_id, avatar_emoji, current_level, current_xp')
          .in('student_id', sids);
        const map: Record<string, GameProfile> = {};
        for (const row of (gp || []) as any[]) {
          map[row.student_id] = row;
        }
        setProfiles(map);
      }

      // Load catalog
      const c = await getUnlockCatalog(agencyId || undefined);
      setCatalog(c as any);
      setLoading(false);
    };
    load();
  }, [groupId, agencyId]);

  // Load student-specific data when selected
  useEffect(() => {
    if (!selectedStudent) { setUnlocks([]); setStreaks([]); return; }
    const load = async () => {
      const [u, s] = await Promise.all([
        getStudentUnlocks(selectedStudent),
        getStudentStreaks(selectedStudent),
      ]);
      setUnlocks(u as any);
      setStreaks(s);
    };
    load();
  }, [selectedStudent]);

  const getName = (s: StudentRow) => {
    const full = ((s.first_name || '') + ' ' + (s.last_name || '')).trim();
    if (full) return full;
    const idx = students.indexOf(s);
    return `Student ${idx + 1}`;
  };

  const unlockedIds = new Set(unlocks.map(u => u.unlock_id));

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Student detail view ──
  if (selectedStudent) {
    const student = students.find(s => s.client_id === selectedStudent);
    const profile = profiles[selectedStudent];

    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
            <ArrowLeft className="h-4 w-4 mr-1" /> All Students
          </Button>
          <h1 className="text-lg font-bold font-heading">✨ {getName(student!)}</h1>
          <div />
        </div>

        {/* Avatar Preview */}
        <Card>
          <CardContent className="p-6 text-center">
            <span className="text-7xl">{profile?.avatar_emoji || '👤'}</span>
            <p className="text-sm text-muted-foreground mt-2">
              Level {profile?.current_level || 1} · {profile?.current_xp || 0} XP
            </p>
            <Progress
              value={((profile?.current_xp || 0) % 100)}
              className="h-2 mt-2 max-w-[200px] mx-auto"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {100 - ((profile?.current_xp || 0) % 100)} XP to next level
            </p>
          </CardContent>
        </Card>

        {/* Streaks */}
        {streaks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /> Streaks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {streaks.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{s.streak_type.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-muted-foreground">Best: {s.best_count}</p>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold">
                    🔥 {s.current_count}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Unlock Catalog */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Unlocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {catalog.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No unlocks available yet</p>
            )}
            {catalog.map(item => {
              const isUnlocked = unlockedIds.has(item.id);
              const currentXp = profile?.current_xp || 0;
              const pctToUnlock = isUnlocked ? 100 : Math.min(100, (currentXp / item.points_required) * 100);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    isUnlocked ? "bg-accent/5 border-accent/30" : "bg-muted/20 border-border/40"
                  )}
                >
                  <span className="text-2xl">{item.icon_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{item.unlock_type.replace(/_/g, ' ')}</p>
                    {!isUnlocked && (
                      <Progress value={pctToUnlock} className="h-1.5 mt-1" />
                    )}
                  </div>
                  {isUnlocked ? (
                    <Badge className="bg-accent/20 text-accent-foreground text-[10px] gap-0.5">
                      <Unlock className="h-3 w-3" /> Unlocked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      <Lock className="h-3 w-3" /> {item.points_required} pts
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Student list view (teacher overview) ──
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-bold font-heading">✨ Avatar & Unlocks</h1>
        <div />
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No students in this classroom yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add students via the Classrooms page first.</p>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {students.map(s => {
              const profile = profiles[s.client_id];
              return (
                <button
                  key={s.client_id}
                  onClick={() => setSearchParams({ student: s.client_id })}
                  className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted/40 transition-colors text-left"
                >
                  <span className="text-2xl">{profile?.avatar_emoji || '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{getName(s)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Level {profile?.current_level || 1} · {profile?.current_xp || 0} XP
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Catalog preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Available Unlocks ({catalog.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No unlocks configured yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {catalog.map(item => (
                <Badge key={item.id} variant="outline" className="gap-1 text-xs py-1">
                  {item.icon_emoji} {item.name} ({item.points_required} pts)
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AvatarUnlocks;
