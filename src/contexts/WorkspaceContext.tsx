import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { Workspace, AgencyMembership, UserPermissions } from '@/lib/types';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (ws: Workspace) => void;
  isSoloMode: boolean;
  permissions: UserPermissions;
  loading: boolean;
}

const defaultPermissions: UserPermissions = {
  can_collect_data: true,
  can_view_notes: true,
  can_generate_reports: true,
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }
    loadWorkspaces();
  }, [user]);

  const loadWorkspaces = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch agency memberships
      const { data: memberships, error } = await supabase
        .from('agency_memberships')
        .select('id, agency_id, user_id, role, agency:agencies(id, name, agency_type)')
        .eq('user_id', user.id);

      if (error) throw error;

      const ws: Workspace[] = [];

      if (!memberships || memberships.length === 0) {
        // Auto-create solo workspace - output SQL for this RPC if needed
        const { data: soloAgency, error: soloError } = await supabase
          .rpc('ensure_solo_teacher_agency', { p_user_id: user.id });

        if (!soloError && soloAgency) {
          ws.push({
            id: soloAgency.id,
            name: 'My Classroom',
            agency_id: soloAgency.id,
            mode: 'solo',
          });
        }
      } else {
        for (const m of memberships as any[]) {
          const agency = m.agency;
          if (agency.agency_type === 'solo_teacher') {
            ws.push({
              id: agency.id,
              name: 'My Classroom',
              agency_id: agency.id,
              mode: 'solo',
            });
          } else {
            ws.push({
              id: agency.id,
              name: agency.name,
              agency_id: agency.id,
              mode: 'connected',
            });
          }
        }
      }

      setWorkspaces(ws);

      // Restore from session or pick first
      const savedWsId = sessionStorage.getItem('novatrack_workspace_id');
      const restored = ws.find(w => w.id === savedWsId);
      setCurrentWorkspace(restored || ws[0] || null);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetWorkspace = (ws: Workspace) => {
    setCurrentWorkspace(ws);
    sessionStorage.setItem('novatrack_workspace_id', ws.id);
    // In connected mode, permissions will be fetched per-client from user_client_access
    if (ws.mode === 'solo') {
      setPermissions(defaultPermissions);
    }
  };

  const isSoloMode = currentWorkspace?.mode === 'solo';

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, currentWorkspace, setCurrentWorkspace: handleSetWorkspace, isSoloMode, permissions, loading }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
