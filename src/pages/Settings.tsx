import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, LogOut, ArrowRight } from 'lucide-react';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-heading">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account and workspace</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentWorkspace && (
            <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{currentWorkspace.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentWorkspace.mode === 'solo' ? 'Independent' : 'Connected'}
                </p>
              </div>
              <Badge variant="outline">Active</Badge>
            </div>
          )}

          {workspaces.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/workspace')}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Switch Workspace
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
