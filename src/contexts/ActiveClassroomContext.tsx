/**
 * ActiveClassroomContext — single source of truth for the resolved classroom/group.
 * All pages (Classroom, Game, Board, Rewards) read from here instead of resolving independently.
 *
 * Resolution order:
 *  1. URL param ?classroom=...
 *  2. classroom_group_teachers row for auth user
 *  3. First classroom_group_students-linked group for visible students
 *  4. First classroom_group in current agency
 *  5. First classroom_group in system (dev/demo fallback)
 *  6. Empty state with reason
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface ActiveClassroomState {
  groupId: string | null;
  groupName: string | null;
  agencyId: string | null;
  resolvedBy: string | null;
  loading: boolean;
  error: string | null;
  errorReason: 'no_teacher_assignment' | 'no_workspace_classroom' | 'no_classroom_in_agency' | 'no_classrooms_at_all' | 'not_authenticated' | null;
  refresh: () => void;
  setGroupId: (id: string) => void;
}

const ActiveClassroomContext = createContext<ActiveClassroomState | undefined>(undefined);

export const ActiveClassroomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [groupId, setGroupIdState] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [resolvedBy, setResolvedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<ActiveClassroomState['errorReason']>(null);

  const resolve = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError('Not authenticated');
      setErrorReason('not_authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorReason(null);
    console.log('[ActiveClassroom] Resolving for user', user.id);

    // 1) URL param — checked by consuming pages, not context
    // Context resolves the default; pages can override via setGroupId

    // 2) classroom_group_teachers for this user
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

    // 3) Any classroom group (agency filtering removed — single-tenant)
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
    setError('No classroom groups found. Create one from the Classroom Manager.');
    setErrorReason('no_classrooms_at_all');
  }, [user]);

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
    setError(null);
    setErrorReason(null);
    setLoading(false);
    console.log(`[ActiveClassroom] ✅ Resolved group=${gid} name="${(grp as any)?.name}" via ${source}`);
  };

  const setGroupId = useCallback(async (id: string) => {
    await applyGroup(id, 'explicit');
  }, []);

  useEffect(() => {
    if (user) resolve();
    else {
      setGroupIdState(null);
      setGroupName(null);
      setAgencyId(null);
      setResolvedBy(null);
      setLoading(false);
    }
  }, [user]);

  return (
    <ActiveClassroomContext.Provider value={{
      groupId,
      groupName,
      agencyId,
      resolvedBy,
      loading,
      error,
      errorReason,
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
