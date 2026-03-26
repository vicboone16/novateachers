import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearResolvedUserCache } from '@/hooks/useResolvedUser';
import { registerPush, deactivatePushTokens, isPushAvailable } from '@/lib/push';
import { clearCloudAuthStorage } from '@/lib/cloud-auth-session';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pushRegisteredRef = useRef(false);

  // Auto-register push after login on native
  const tryRegisterPush = (userId: string) => {
    if (pushRegisteredRef.current || !isPushAvailable()) return;
    pushRegisteredRef.current = true;
    registerPush(userId).catch(() => {});
  };

  useEffect(() => {
    let mounted = true;

    clearCloudAuthStorage();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      clearCloudAuthStorage();

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        tryRegisterPush(session.user.id);
      }

      if (_event === 'SIGNED_OUT') {
        pushRegisteredRef.current = false;
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        tryRegisterPush(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    clearCloudAuthStorage();
    clearResolvedUserCache();
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    clearCloudAuthStorage();
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    clearCloudAuthStorage();
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    clearCloudAuthStorage();
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Deactivate push tokens before signing out
    if (user?.id) {
      await deactivatePushTokens(user.id).catch(() => {});
    }
    pushRegisteredRef.current = false;
    clearResolvedUserCache();
    clearCloudAuthStorage();
    await supabase.auth.signOut();
    clearCloudAuthStorage();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
