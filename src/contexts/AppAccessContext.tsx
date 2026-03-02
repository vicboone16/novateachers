import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

const APP_SLUG = 'novateachers';

interface AppAccessContextType {
  /** Whether the user has access to this app */
  hasAccess: boolean;
  /** The role from user_app_access (e.g. 'owner', 'admin', 'teacher', 'rbt') */
  appRole: string | null;
  /** The agency_id from the access record */
  agencyId: string | null;
  /** Loading state */
  loading: boolean;
}

const AppAccessContext = createContext<AppAccessContextType | undefined>(undefined);

export const AppAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setAppRole(null);
      setAgencyId(null);
      setLoading(false);
      return;
    }
    checkAppAccess();
  }, [user]);

  const checkAppAccess = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Try the has_app_access RPC first
      try {
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('has_app_access', { p_user_id: user.id, p_app_slug: APP_SLUG });

        if (!rpcError && rpcResult === true) {
          // RPC confirmed access, now fetch the role
          const { data: accessRow } = await supabase
            .from('user_app_access')
            .select('role, agency_id')
            .eq('user_id', user.id)
            .eq('app_slug', APP_SLUG)
            .maybeSingle();

          setHasAccess(true);
          setAppRole(accessRow?.role ? String(accessRow.role).toLowerCase() : 'teacher');
          setAgencyId(accessRow?.agency_id || null);
          setLoading(false);
          return;
        }

        if (!rpcError && rpcResult === false) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
      } catch {
        // RPC doesn't exist, fall through to direct table query
      }

      // Fallback: query user_app_access table directly
      const { data, error } = await supabase
        .from('user_app_access')
        .select('role, agency_id')
        .eq('user_id', user.id)
        .eq('app_slug', APP_SLUG)
        .maybeSingle();

      if (error) {
        console.warn('[AppAccess] user_app_access query failed:', error.message);
        // Table might not exist yet — grant access by default to avoid breaking existing users
        setHasAccess(true);
        setAppRole(null);
        setLoading(false);
        return;
      }

      if (data) {
        setHasAccess(true);
        setAppRole(data.role ? String(data.role).toLowerCase() : 'teacher');
        setAgencyId(data.agency_id || null);
      } else {
        setHasAccess(false);
      }
    } catch (err) {
      console.error('[AppAccess] Unexpected error:', err);
      // Fail open to avoid locking out users if table doesn't exist
      setHasAccess(true);
      setAppRole(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppAccessContext.Provider value={{ hasAccess, appRole, agencyId, loading }}>
      {children}
    </AppAccessContext.Provider>
  );
};

export const useAppAccess = () => {
  const context = useContext(AppAccessContext);
  if (!context) throw new Error('useAppAccess must be used within an AppAccessProvider');
  return context;
};
