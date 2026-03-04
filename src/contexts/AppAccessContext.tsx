import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useResolvedUser, clearResolvedUserCache } from '@/hooks/useResolvedUser';
import type { ResolvedUser } from '@/lib/cloud-functions';

interface AppAccessContextType {
  /** Whether the user has access to this app */
  hasAccess: boolean;
  /** The role from the resolved user's first agency (e.g. 'owner', 'admin', 'teacher', 'rbt') */
  appRole: string | null;
  /** The agency_id from the resolved user's current context */
  agencyId: string | null;
  /** Full resolved identity from Nova Core */
  resolvedUser: ResolvedUser | null;
  /** Loading state */
  loading: boolean;
  /** Re-fetch identity from Nova Core */
  refetch: () => void;
  /** Clear cached identity */
  clearCache: () => void;
}

const AppAccessContext = createContext<AppAccessContextType | undefined>(undefined);

export const AppAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { resolved, loading, error, refetch } = useResolvedUser();

  // Derive access from the resolved user
  const hasAccess = !!resolved && resolved.agencies.length > 0;
  const appRole = resolved?.agencies?.[0]?.role?.toLowerCase() ?? null;
  const agencyId = resolved?.current_agency_id ?? resolved?.agencies?.[0]?.agency_id ?? null;

  const clearCache = () => {
    clearResolvedUserCache();
    refetch();
  };

  // If user is not logged in, don't gate
  const value: AppAccessContextType = !user
    ? { hasAccess: false, appRole: null, agencyId: null, resolvedUser: null, loading: false, refetch, clearCache }
    : { hasAccess, appRole, agencyId, resolvedUser: resolved, loading, refetch, clearCache };

  return (
    <AppAccessContext.Provider value={value}>
      {children}
    </AppAccessContext.Provider>
  );
};

export const useAppAccess = () => {
  const context = useContext(AppAccessContext);
  if (!context) throw new Error('useAppAccess must be used within an AppAccessProvider');
  return context;
};
