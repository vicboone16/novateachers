import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building2, LogOut, ArrowRight, Pencil, Check, X } from 'lucide-react';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentName = user?.user_metadata?.full_name || '';
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(currentName);
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: nameValue.trim() },
    });
    if (error) {
      toast({ title: 'Error updating name', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Name updated' });
      setEditingName(false);
    }
    setSavingName(false);
  };

  const displayName = currentName || user?.email || '';

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
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Display Name</p>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  placeholder="Enter your name…"
                  className="h-8 text-sm max-w-xs"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') { setEditingName(false); setNameValue(currentName); }
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName} disabled={savingName}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingName(false); setNameValue(currentName); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{displayName}</p>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setNameValue(currentName); setEditingName(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
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
