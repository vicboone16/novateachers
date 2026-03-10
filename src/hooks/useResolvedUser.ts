import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveUser, ResolvedUser } from '@/lib/cloud-functions';

interface ResolvedUserState {
  resolved: ResolvedUser | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const CACHE_KEY = 'nova_resolved_user';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached(): ResolvedUser | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data as ResolvedUser;
  } catch {
    return null;
  }
}

function setCache(data: ResolvedUser) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

export function clearResolvedUserCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

export function useResolvedUser(): ResolvedUserState {
  const { user, session } = useAuth();
  const [resolved, setResolved] = useState<ResolvedUser | null>(getCached);
  const [loading, setLoading] = useState(!getCached());
  const [error, setError] = useState<string | null>(null);

  const fetchResolved = useCallback(async () => {
    if (!user?.email || !session?.access_token) return;

    setLoading(true);
    setError(null);

    console.log('[useResolvedUser] Fetching for', user.email);
    const { data, error: err } = await resolveUser(
      user.email,
      session.access_token,
    );

    console.log('[useResolvedUser] Result:', { data, error: err?.message });

    if (err) {
      setError(err.message);
      setResolved(null);
      sessionStorage.removeItem(CACHE_KEY);
    } else if (data) {
      console.log('[useResolvedUser] agencies:', data.agencies?.length, data.agencies);
      setResolved(data);
      setCache(data);
    }
    setLoading(false);
  }, [user?.email, session?.access_token]);

  useEffect(() => {
    if (!user?.email || !session?.access_token) {
      setResolved(null);
      setLoading(false);
      return;
    }

    // If cache hit, skip fetch
    const cached = getCached();
    if (cached && cached.email === user.email.toLowerCase().trim()) {
      setResolved(cached);
      setLoading(false);
      return;
    }

    fetchResolved();
  }, [user?.email, session?.access_token, fetchResolved]);

  return { resolved, loading, error, refetch: fetchResolved };
}
