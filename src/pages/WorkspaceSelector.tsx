import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, GraduationCap, Loader2 } from 'lucide-react';

const WorkspaceSelector = () => {
  const { workspaces, setCurrentWorkspace, loading } = useWorkspace();
  const navigate = useNavigate();

  const handleSelect = (ws: typeof workspaces[0]) => {
    setCurrentWorkspace(ws);
    navigate('/students');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            NovaTrack
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose your workspace</p>
        </div>

        <div className="space-y-3">
          {workspaces.map((ws) => (
            <Card
              key={ws.id}
              className="cursor-pointer border-border/50 transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => handleSelect(ws)}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {ws.mode === 'solo' ? (
                    <GraduationCap className="h-6 w-6" />
                  ) : (
                    <Building2 className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ws.mode === 'solo' ? 'Independent Classroom' : 'Connected Agency'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-primary">
                  Open →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {workspaces.length === 0 && (
          <Card className="border-dashed border-border">
            <CardContent className="py-12 text-center">
              <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No workspaces available. Setting up your classroom…</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSelector;
