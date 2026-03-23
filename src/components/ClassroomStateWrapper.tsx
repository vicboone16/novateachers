/**
 * ClassroomStateWrapper — Reusable wrapper for pages that depend on ActiveClassroomContext.
 * Renders loading, empty, error, or children based on context state.
 */
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Custom loading message */
  loadingMessage?: string;
  /** If true, still render children even when no classroom is resolved */
  allowEmpty?: boolean;
}

export function ClassroomStateWrapper({
  children,
  loadingMessage = 'Loading classroom…',
  allowEmpty = false,
}: Props) {
  const { groupId, loading, error, errorReason, refresh } = useActiveClassroom();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center flex-col gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  if (error && !groupId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3 max-w-xs mx-auto">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60" />
          <p className="text-sm font-medium text-destructive">{error}</p>
          {errorReason === 'no_teacher_assignment' && (
            <p className="text-xs text-muted-foreground">
              You're not assigned to a classroom yet. Ask your admin to add you.
            </p>
          )}
          {errorReason === 'no_classrooms_at_all' && (
            <p className="text-xs text-muted-foreground">
              No classrooms exist. Create one to get started.
            </p>
          )}
          {errorReason === 'not_authenticated' && (
            <p className="text-xs text-muted-foreground">
              Please sign in to continue.
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={refresh}>
              Retry
            </Button>
            {(errorReason === 'no_classrooms_at_all' || errorReason === 'no_teacher_assignment') && (
              <Button variant="outline" size="sm" onClick={() => navigate('/classrooms')}>
                Classroom Manager
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!groupId && !allowEmpty) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No classroom selected.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/classrooms')}>Classroom Manager</Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
