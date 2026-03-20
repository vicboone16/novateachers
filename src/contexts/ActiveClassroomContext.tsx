/**
 * ActiveClassroomContext — single source of truth for the resolved classroom/group.
 * All pages (Classroom, Game, Board, Rewards) read from here instead of resolving independently.
 *
 * Resolution order:
 *  1. URL param ?classroom=...
 *  2. classroom_group_teachers row for auth user
 *  3. First classroom_group in any agency
 *  4. Empty state with reason
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useAppAccess } from './AppAccessContext';

interface ActiveClassroomState {
  groupId: string | null;
  groupName: string | null;
  agencyId: string | null;
  resolvedBy: string | null; // which path resolved it
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setGroupId: (id: string) => void;
}

const ActiveClassroomContext = createContext<ActiveClassroomState | undefined>(undefined);

export const ActiveClassroomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { agencyId: appAgencyId } = useAppAccess();

  const [groupId, setGroupIdState] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [resolvedBy, setResolvedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('[ActiveClassroom] Resolving for user', user.id, 'agency', appAgencyId);

    // 1) classroom_group_teachers for this user
    try {
      const { data } = await cloudSupabase
        .from('classroom_group_teachers')
        .select('group_id')
        .eq('user_id', user.id)
        .limit(1);
      if (data?.[0]) {
        await applyGroup(data[0].group_id, 'teacher_membership');
        return;
      }
    } catch (e) { console.warn('[ActiveClassroom] teacher lookup failed:', e); }

    // 2) First classroom group matching app agency
    if (appAgencyId) {
      try {
        const { data } = await cloudSupabase
          .from('classroom_groups')
          .select('group_id, name, agency_id')
          .eq('agency_id', appAgencyId)
          .limit(1);
        if (data?.[0]) {
          await applyGroup(data[0].group_id, 'agency_match');
          return;
        }
      } catch (e) { console.warn('[ActiveClassroom] agency match failed:', e); }
    }

    // 3) Any classroom group at all (dev/demo fallback)
    try {
      const { data } = await cloudSupabase
        .from('classroom_groups')
        .select('group_id, name, agency_id')
        .limit(1);
      if (data?.[0]) {
        console.log('[ActiveClassroom] Using first_available fallback:', data[0].group_id);
        await applyGroup(data[0].group_id, 'first_available');
        return;
      }
    } catch (e) { console.warn('[ActiveClassroom] first_available failed:', e); }

    setLoading(false);
    setError('No classroom groups found. Create one from the Classroom page.');
  }, [user, appAgencyId]);

  const applyGroup = async (gid: string, source: string) => {
    const { data: grp } = await cloudSupabase
      .from('classroom_groups')
      .select('name, agency_id')
      .eq('group_id', gid)
      .maybeSingle();

    setGroupIdState(gid);
    setGroupName((grp as any)?.name || null);
    setAgencyId((grp as any)?.agency_id || null);
    setResolvedBy(source);
    setLoading(false);
    console.log(`[ActiveClassroom] Resolved group=${gid} via ${source}`);
  };

  const autoLinkTeacher = async (gid: string) => {
    if (!user) return;
    try {
      // Check if already linked
      const { data: existing } = await cloudSupabase
        .from('classroom_group_teachers')
        .select('id')
        .eq('group_id', gid)
        .eq('user_id', user.id)
        .limit(1);
      if (existing && existing.length > 0) return;

      // Auto-link
      await cloudSupabase.from('classroom_group_teachers').insert({ group_id: gid, user_id: user.id });
      console.log(`[ActiveClassroom] Auto-linked teacher ${user.id} to group ${gid}`);
    } catch (e) {
      console.warn('[ActiveClassroom] Failed to auto-link teacher:', e);
    }
  };

  const setGroupId = useCallback(async (id: string) => {
    await applyGroup(id, 'explicit');
  }, []);

  useEffect(() => {
    if (user) resolve();
    else {
      setGroupIdState(null);
      setLoading(false);
    }
  }, [user, appAgencyId]);

  return (
    <ActiveClassroomContext.Provider value={{
      groupId: groupId,
      groupName,
      agencyId,
      resolvedBy,
      loading,
      error,
      refresh: resolve,
      setGroupId,
    }}>
      {children}
    </ActiveClassroomContext.Provider>
  );
};

export const useActiveClassroom = () => {
  const ctx = useContext(ActiveClassroomContext);
  if (!ctx) throw new Error('useActiveClassroom must be used within ActiveClassroomProvider');
  return ctx;
};
