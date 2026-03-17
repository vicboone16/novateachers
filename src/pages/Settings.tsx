import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building2, LogOut, ArrowRight, Pencil, Check, X, Link2, KeyRound, Users, Shield, Trash2, Bell } from 'lucide-react';

interface TeamMember {
  membership_id: string;
  user_id: string;
  role: string;
  display_name: string;
  email: string;
}

const Settings = () => {
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, isAdmin } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentName = user?.user_metadata?.full_name || '';
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(currentName);
  const [savingName, setSavingName] = useState(false);

  // Team members for admin view
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (isAdmin && currentWorkspace) loadTeamMembers();
  }, [isAdmin, currentWorkspace]);

  const loadTeamMembers = async () => {
    if (!currentWorkspace) return;
    setLoadingTeam(true);
    try {
      const { data: memberships } = await supabase
        .from('agency_memberships')
        .select('id, user_id, role')
        .eq('agency_id', currentWorkspace.agency_id);

      if (!memberships?.length) { setTeamMembers([]); setLoadingTeam(false); return; }

      const userIds = memberships.map((m: any) => m.user_id);

      // Try profiles table for display names
      let profileMap = new Map<string, { name: string; email: string }>();
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        if (profiles?.length) {
          profiles.forEach((p: any) => profileMap.set(p.id, { name: p.full_name || '', email: p.email || '' }));
        }
      } catch { /* profiles table may not exist */ }

      if (profileMap.size === 0) {
        try {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);
          if (profiles?.length) {
            profiles.forEach((p: any) => profileMap.set(p.user_id, { name: p.full_name || '', email: p.email || '' }));
          }
        } catch { /* table doesn't exist */ }
      }

      const team: TeamMember[] = memberships.map((m: any) => {
        const profile = profileMap.get(m.user_id);
        return {
          membership_id: m.id,
          user_id: m.user_id,
          role: m.role,
          display_name: profile?.name || profile?.email || m.user_id.slice(0, 8) + '…',
          email: profile?.email || '',
        };
      });

      setTeamMembers(team);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to load team members:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

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

  const handleChangeRole = async (membershipId: string, newRole: string) => {
    const { error } = await supabase
      .from('agency_memberships')
      .update({ role: newRole })
      .eq('id', membershipId);
    if (error) {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role updated' });
      loadTeamMembers();
    }
  };

  const handleRemoveMember = async (membershipId: string, name: string) => {
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    const { error } = await supabase
      .from('agency_memberships')
      .delete()
      .eq('id', membershipId);
    if (error) {
      toast({ title: 'Error removing member', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Member removed' });
      loadTeamMembers();
    }
  };

  const displayNameValue = currentName || user?.email || '';

  const roleColors: Record<string, string> = {
    owner: 'bg-primary/10 text-primary border-primary/30',
    admin: 'bg-accent text-accent-foreground border-accent',
    teacher: 'bg-secondary text-secondary-foreground border-secondary',
    rbt: 'bg-muted text-muted-foreground border-border',
  };

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
                <p className="text-sm font-medium">{displayNameValue}</p>
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

      {/* Sharing & Invites */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Sharing & Invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" className="gap-1.5 w-full justify-start" onClick={() => navigate('/join')}>
            <KeyRound className="h-3.5 w-3.5" />
            Redeem Invite Code
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" className="gap-1.5 w-full justify-start" onClick={() => navigate('/invites')}>
              <Link2 className="h-3.5 w-3.5" />
              Generate Invite Code
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" className="gap-1.5 w-full justify-start" onClick={() => navigate('/admin')}>
              <Shield className="h-3.5 w-3.5" />
              Admin Dashboard
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Roles & Permissions (admin only) */}
      {isAdmin && (
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Team Roles & Permissions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTeam ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members found.</p>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => {
                  const isCurrentUser = member.user_id === user?.id;
                  const isOwner = member.role === 'owner';
                  return (
                    <div key={member.membership_id} className="flex items-center gap-3 rounded-md border border-border/60 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.display_name}
                          {isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                        </p>
                        {member.email && (
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOwner || isCurrentUser ? (
                          <Badge variant="outline" className={roleColors[member.role] || ''}>
                            {member.role}
                          </Badge>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(val) => handleChangeRole(member.membership_id, val)}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="teacher">Teacher</SelectItem>
                              <SelectItem value="rbt">RBT</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {!isOwner && !isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveMember(member.membership_id, member.display_name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
