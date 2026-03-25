/**
 * useStudentGameProfiles — Load and cache game profiles (level, xp, avatar) for students.
 * Subscribes to realtime updates on student_game_profiles.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface GameProfile {
  student_id: string;
  avatar_emoji: string;
  current_level: number;
  current_xp: number;
  identity_title: string | null;
  identity_emoji: string | null;
  momentum_state: string | null;
  comeback_active: boolean;
  daily_narrative: string | null;
}

export function useStudentGameProfiles(studentIds: string[]) {
  const [profiles, setProfiles] = useState<Record<string, GameProfile>>({});
  const [loading, setLoading] = useState(false);
  const { effectiveAgencyId } = useWorkspace();

  const fetchProfiles = useCallback(async () => {
    if (studentIds.length === 0) return;
    setLoading(true);
    try {
      const { data } = await cloudSupabase
        .from('student_game_profiles')
        .select('student_id, avatar_emoji, current_level, current_xp, identity_title, identity_emoji, momentum_state, comeback_active, daily_narrative')
        .in('student_id', studentIds);

      const map: Record<string, GameProfile> = {};
      const existingIds = new Set<string>();
      for (const row of (data || []) as any[]) {
        existingIds.add(row.student_id);
        map[row.student_id] = {
          student_id: row.student_id,
          avatar_emoji: row.avatar_emoji || '👤',
          current_level: row.current_level || 1,
          current_xp: row.current_xp || 0,
          identity_title: row.identity_title || null,
          identity_emoji: row.identity_emoji || null,
          momentum_state: row.momentum_state || null,
          comeback_active: row.comeback_active || false,
          daily_narrative: row.daily_narrative || null,
        };
      }

      // Auto-seed missing profiles
      const missing = studentIds.filter(id => !existingIds.has(id));
      if (missing.length > 0) {
        const avatars = ['🐱','🐶','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐵','🐙','🦄','🐲','🐬','🦋','🐢'];
        const seeds = missing.map((id, i) => ({
          student_id: id,
          avatar_emoji: avatars[i % avatars.length],
          current_level: 1,
          current_xp: 0,
        }));
        await cloudSupabase.from('student_game_profiles').upsert(seeds, { onConflict: 'student_id' });
        for (const s of seeds) {
          map[s.student_id] = {
            student_id: s.student_id,
            avatar_emoji: s.avatar_emoji,
            current_level: 1,
            current_xp: 0,
            identity_title: null,
            identity_emoji: null,
            momentum_state: null,
            comeback_active: false,
            daily_narrative: null,
          };
        }
      }

      setProfiles(map);
    } catch (err) {
      console.warn('[GameProfiles] fetch failed:', err);
    }
    setLoading(false);
  }, [studentIds.join(',')]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Realtime subscription
  useEffect(() => {
    if (studentIds.length === 0) return;
    const channel = cloudSupabase
      .channel('game-profiles-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_game_profiles',
      }, (payload: any) => {
        const row = payload.new;
        if (row && studentIds.includes(row.student_id)) {
          setProfiles(prev => ({
            ...prev,
            [row.student_id]: {
              student_id: row.student_id,
              avatar_emoji: row.avatar_emoji || '👤',
              current_level: row.current_level || 1,
              current_xp: row.current_xp || 0,
              identity_title: row.identity_title || null,
              identity_emoji: row.identity_emoji || null,
              momentum_state: row.momentum_state || null,
              comeback_active: row.comeback_active || false,
              daily_narrative: row.daily_narrative || null,
            },
          }));
        }
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [studentIds.join(',')]);

  return { profiles, loading, refetch: fetchProfiles };
}
