/**
 * useStudentGameProfiles — Load and cache game profiles (level, xp, avatar) for students.
 * Subscribes to realtime updates on student_game_profiles.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

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

  const fetchProfiles = useCallback(async () => {
    if (studentIds.length === 0) return;
    setLoading(true);
    try {
      const { data } = await cloudSupabase
        .from('student_game_profiles')
        .select('student_id, avatar_emoji, current_level, current_xp, identity_title, identity_emoji, momentum_state, comeback_active, daily_narrative')
        .in('student_id', studentIds);
      const map: Record<string, GameProfile> = {};
      for (const row of (data || []) as any[]) {
        map[row.student_id] = {
          student_id: row.student_id,
          avatar_emoji: row.avatar_emoji || '👤',
          current_level: row.current_level || 1,
          current_xp: row.current_xp || 0,
        };
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
            },
          }));
        }
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [studentIds.join(',')]);

  return { profiles, loading, refetch: fetchProfiles };
}
