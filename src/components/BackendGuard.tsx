import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface BackendGuardProps {
  children: React.ReactNode;
}

export const BackendGuard: React.FC<BackendGuardProps> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    checkHandshake();
  }, []);

  const checkHandshake = async () => {
    try {
      if (import.meta.env.DEV) console.log('[BackendGuard] Checking handshake...');
      const { data, error } = await supabase
        .from('app_handshake')
        .select('app_slug')
        .eq('id', 1)
        .single();

      if (import.meta.env.DEV) console.log('[BackendGuard] Response:', { data, error });

      if (error) throw error;

      if (data?.app_slug === 'novatrack') {
        setStatus('ok');
      } else {
        setStatus('error');
        setErrorMsg('Unauthorized application. Invalid app_slug.');
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[BackendGuard] Error:', err);
      setStatus('error');
      setErrorMsg(err?.message || 'Failed to verify application. Check Supabase connection.');
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verifying application…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-2xl">⚠</span>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Unauthorized Application
          </h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
