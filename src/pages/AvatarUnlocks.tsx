/**
 * AvatarUnlocks — Avatar customization & unlock catalog.
 * Works for both teacher-managed and student read-only modes.
 * Reads from Core Phase 5 tables.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import {
  getStudentGameProfile,
  getUnlockCatalog,
  getStudentUnlocks,
  getStudentStreaks,
} from '@/lib/game-data';
import type { StudentGameProfile, UnlockCatalogItem, StudentUnlock, StudentStreak } from '@/lib/game-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Unlock, Flame, Trophy, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const AvatarUnlocks = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { agencyId } = useAppAccess();

  const studentId = searchParams.get('student') || '';
  const readOnly = searchParams.get('readonly') === '1';

  const [profile, setProfile] = useState<StudentGameProfile | null>(null);
  const [catalog, setCatalog] = useState<UnlockCatalogItem[]>([]);
  const [unlocks, setUnlocks] = useState<StudentUnlock[]>([]);
  const [streaks, setStreaks] = useState<StudentStreak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) loadData();
  }, [studentId]);

  const loadData = async () => {
    setLoading(true);
    const [p, c, u, s] = await Promise.all([
      getStudentGameProfile(studentId),
      getUnlockCatalog(agencyId || undefined),
      getStudentUnlocks(studentId),
      getStudentStreaks(studentId),
    ]);
    setProfile(p as any);
    setCatalog(c as any);
    setUnlocks(u as any);
    setStreaks(s);
    setLoading(false);
  };

  const unlockedIds = new Set(unlocks.map(u => u.unlock_id));

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-bold font-heading">✨ Avatar & Unlocks</h1>
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
};

export default AvatarUnlocks;
