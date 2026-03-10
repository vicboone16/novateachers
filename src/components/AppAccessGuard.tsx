import { useAppAccess } from '@/contexts/AppAccessContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface AppAccessGuardProps {
  children: React.ReactNode;
}

export const AppAccessGuard: React.FC<AppAccessGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const { hasAccess, loading, resolvedUser, refetch, clearCache } = useAppAccess();

  // Don't gate if user isn't logged in yet (Login page handles that)
  if (!user) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking app access…</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Access Not Configured
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            Your account does not have access to NovaTeachers. Please contact your administrator to get access configured.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-1">
            App: novateachers
          </p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            Email: {user.email} · Agencies: {resolvedUser?.agencies?.length ?? 'none'}
          </p>
          <Button variant="outline" size="sm" onClick={() => { clearCache(); }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
