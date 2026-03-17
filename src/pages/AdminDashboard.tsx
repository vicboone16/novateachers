import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { resolveDisplayNames } from '@/lib/resolve-names';
import type { Client } from '@/lib/types';
import {
  ArrowLeft, Users, UserPlus, Shield, Copy, Pencil, Check, X, Search,
  Key, GraduationCap, Building2, Hash, RefreshCw, Plus, Trash2,
} from 'lucide-react';

// ── Types ──
interface InviteCode {
  id: string;
  code: string;
  agency_id: string;
  role_slug: string;
  invite_scope: string;
  app_context: string;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  target_email: string | null;
  created_at: string;
}

interface StaffMember {
  membership_id: string;
  user_id: string;
  role: string;
  display_name: string;
  email: string;
}

interface ClassroomGroup {
  group_id: string;
  name: string;
  agency_id: string;
  grade_band: string | null;
  school_name: string | null;
}

const AdminDashboard = () => {
  const { currentWorkspace, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Tabs
  const [tab, setTab] = useState('ids');

  // All entities
  const [students, setStudents] = useState<Client[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add student
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newStudentNotes, setNewStudentNotes] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);

  // Add staff
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('teacher');
  const [newStaffName, setNewStaffName] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

  // Edit display name
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  useEffect(() => {
    if (currentWorkspace && isAdmin) loadAll();
  }, [currentWorkspace, isAdmin]);

  const loadAll = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const agencyId = currentWorkspace.agency_id;

    try {
      // Students
      let clientsRes = await supabase.from('clients').select('*').eq('agency_id', agencyId).order('last_name');
      if (clientsRes.error) {
        clientsRes = await supabase.from('students').select('*').eq('agency_id', agencyId).order('last_name');
      }
      setStudents(normalizeClients(clientsRes.data || []));

      // Staff memberships
      const { data: memberships } = await supabase
        .from('agency_memberships')
        .select('id, user_id, role')
        .eq('agency_id', agencyId);

      const userIds = (memberships || []).map((m: any) => m.user_id);
      const nameMap = userIds.length > 0 ? await resolveDisplayNames(userIds).catch(() => new Map()) : new Map();

      setStaff((memberships || []).map((m: any) => ({
        membership_id: m.id,
        user_id: m.user_id,
        role: m.role,
        display_name: (nameMap as Map<string, string>).get(m.user_id) || m.user_id.slice(0, 8) + '…',
        email: '',
      })));

      // Invite codes
      const { data: codes } = await cloudSupabase
        .from('invite_codes')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });
      setInviteCodes((codes || []) as InviteCode[]);

      // Classrooms
      const { data: groups } = await cloudSupabase
        .from('classroom_groups')
        .select('*')
        .eq('agency_id', agencyId)
        .order('name');
      setClassrooms((groups || []) as ClassroomGroup[]);

    } catch (err: any) {
      toast({ title: 'Error loading data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
  };

  // ── Invite Code Overrides ──
  const handleToggleInviteCode = async (codeId: string, currentlyRevoked: boolean) => {
    try {
      const update = currentlyRevoked
        ? { revoked_at: null }
        : { revoked_at: new Date().toISOString() };
      const { error } = await cloudSupabase
        .from('invite_codes')
        .update(update)
        .eq('id', codeId);
      if (error) throw error;
      toast({ title: currentlyRevoked ? 'Code reactivated' : 'Code revoked' });
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleResetInviteUses = async (codeId: string) => {
    try {
      const { error } = await cloudSupabase
        .from('invite_codes')
        .update({ uses_count: 0 })
        .eq('id', codeId);
      if (error) throw error;
      toast({ title: 'Uses reset to 0' });
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Add Student ──
  const handleAddStudent = async () => {
    if (!currentWorkspace || !user || !newFirstName.trim()) return;
    setAddingStudent(true);
    try {
      // Try clients table first, then students
      const row: any = {
        agency_id: currentWorkspace.agency_id,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim() || null,
        grade: newGrade.trim() || null,
        activation_status: 'active',
      };
      let { error } = await supabase.from('clients').insert(row);
      if (error && String(error.message).includes('relation')) {
        const { error: err2 } = await supabase.from('students').insert(row);
        if (err2) throw err2;
      } else if (error) throw error;
      toast({ title: '✓ Student added' });
      setShowAddStudent(false);
      setNewFirstName(''); setNewLastName(''); setNewGrade(''); setNewStudentNotes('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingStudent(false);
    }
  };

  // ── Add Staff ──
  const handleAddStaff = async () => {
    if (!currentWorkspace || !newStaffEmail.trim()) return;
    setAddingStaff(true);
    try {
      // We create a membership directly — user may or may not exist yet
      const row: any = {
        agency_id: currentWorkspace.agency_id,
        user_id: newStaffEmail.trim(), // Placeholder — real flow uses invite codes
        role: newStaffRole,
      };
      // For now, we just note this — real staff needs to join via invite
      toast({
        title: 'Staff registration',
        description: `To add ${newStaffName || newStaffEmail}, generate an invite code from Settings → Sharing. They will be added when they redeem the code.`,
      });
      setShowAddStaff(false);
      setNewStaffEmail(''); setNewStaffName(''); setNewStaffRole('teacher');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingStaff(false);
    }
  };

  // ── Update Display Name ──
  const handleUpdateDisplayName = async (userId: string) => {
    if (!editNameValue.trim()) return;
    try {
      // Try updating profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editNameValue.trim() })
        .eq('id', userId);
      if (error) {
        // Try user_profiles
        const { error: err2 } = await supabase
          .from('user_profiles')
          .update({ full_name: editNameValue.trim() })
          .eq('user_id', userId);
        if (err2) throw err2;
      }
      toast({ title: 'Display name updated' });
      setEditingUserId(null);
      setEditNameValue('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Admin access required.</p>
        <Button variant="link" onClick={() => navigate('/students')}>Back to Students</Button>
      </div>
    );
  }

  const filtered = (items: any[], keys: string[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item => keys.some(k => String(item[k] || '').toLowerCase().includes(q)));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0 self-start">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight font-heading">Admin Dashboard</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage all entities, IDs, and overrides</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto" onClick={loadAll}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="ids" className="gap-1.5"><Hash className="h-3.5 w-3.5" /> All IDs</TabsTrigger>
            <TabsTrigger value="invites" className="gap-1.5"><Key className="h-3.5 w-3.5" /> Invite Codes</TabsTrigger>
            <TabsTrigger value="students" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Students</TabsTrigger>
            <TabsTrigger value="staff" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Staff</TabsTrigger>
          </TabsList>

          {/* ═══════════════ ALL IDs ═══════════════ */}
          <TabsContent value="ids" className="space-y-4 mt-4">
            {/* Agency */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Agency</CardTitle>
              </CardHeader>
              <CardContent>
                <IdRow label="Agency ID" value={currentWorkspace?.agency_id || ''} onCopy={copyToClipboard} />
                <IdRow label="Workspace Name" value={currentWorkspace?.name || ''} onCopy={copyToClipboard} />
              </CardContent>
            </Card>

            {/* Users */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Staff ({staff.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {filtered(staff, ['user_id', 'display_name']).map(s => (
                  <div key={s.user_id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      {editingUserId === s.user_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editNameValue}
                            onChange={e => setEditNameValue(e.target.value)}
                            className="h-7 text-xs max-w-[200px]"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleUpdateDisplayName(s.user_id); if (e.key === 'Escape') setEditingUserId(null); }}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateDisplayName(s.user_id)}><Check className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingUserId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{s.display_name}</span>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingUserId(s.user_id); setEditNameValue(s.display_name); }}>
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[9px]">{s.role}</Badge>
                    <code className="text-[9px] text-muted-foreground font-mono select-all cursor-pointer" onClick={() => copyToClipboard(s.user_id)} title="Click to copy">
                      {s.user_id.slice(0, 12)}…
                    </code>
                    <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(s.user_id)}>
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Students */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Students ({students.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {filtered(students, ['id', 'first_name', 'last_name']).map(s => (
                  <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                    <span className="flex-1 text-sm truncate">{displayName(s)}</span>
                    {s.grade && <Badge variant="outline" className="text-[9px]">Gr {s.grade}</Badge>}
                    <code className="text-[9px] text-muted-foreground font-mono select-all cursor-pointer" onClick={() => copyToClipboard(s.id)} title="Click to copy">
                      {s.id.slice(0, 12)}…
                    </code>
                    <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(s.id)}>
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Classrooms */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Classrooms ({classrooms.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {filtered(classrooms, ['group_id', 'name']).map(c => (
                  <div key={c.group_id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                    <span className="flex-1 text-sm truncate">{c.name}</span>
                    {c.grade_band && <Badge variant="outline" className="text-[9px]">{c.grade_band}</Badge>}
                    <code className="text-[9px] text-muted-foreground font-mono select-all cursor-pointer" onClick={() => copyToClipboard(c.group_id)} title="Click to copy">
                      {c.group_id.slice(0, 12)}…
                    </code>
                    <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(c.group_id)}>
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════ INVITE CODES ═══════════════ */}
          <TabsContent value="invites" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">Override invite code status: toggle active/revoked, reset redemption count.</p>
            {filtered(inviteCodes, ['code', 'role_slug', 'target_email']).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No invite codes found.</p>
            ) : filtered(inviteCodes, ['code', 'role_slug', 'target_email']).map(code => {
              const isRevoked = !!code.revoked_at;
              const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
              const isMaxed = code.uses_count >= code.max_uses;
              return (
                <Card key={code.id} className={`border-border/50 ${isRevoked ? 'opacity-60' : ''}`}>
                  <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold text-foreground">{code.code}</code>
                        <Badge variant="outline" className="text-[9px]">{code.role_slug}</Badge>
                        <Badge variant="outline" className="text-[9px]">{code.app_context}</Badge>
                        {isRevoked && <Badge variant="destructive" className="text-[9px]">Revoked</Badge>}
                        {isExpired && !isRevoked && <Badge variant="secondary" className="text-[9px]">Expired</Badge>}
                        {isMaxed && !isRevoked && <Badge variant="secondary" className="text-[9px]">Maxed</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Uses: {code.uses_count}/{code.max_uses}
                        {code.target_email && ` · For: ${code.target_email}`}
                        {code.expires_at && ` · Expires: ${new Date(code.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">{isRevoked ? 'Revoked' : 'Active'}</span>
                        <Switch
                          checked={!isRevoked}
                          onCheckedChange={() => handleToggleInviteCode(code.id, isRevoked)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleResetInviteUses(code.id)}
                        title="Reset uses to 0"
                      >
                        <RefreshCw className="h-3 w-3" /> Reset
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(code.code)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ═══════════════ STUDENTS ═══════════════ */}
          <TabsContent value="students" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Add students that may or may not integrate with NovaCore.</p>
              <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Student</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">First Name *</Label>
                        <Input value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="First name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Last Name</Label>
                        <Input value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Last name" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Grade</Label>
                      <Input value={newGrade} onChange={e => setNewGrade(e.target.value)} placeholder="e.g. 3rd" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Notes</Label>
                      <Textarea value={newStudentNotes} onChange={e => setNewStudentNotes(e.target.value)} placeholder="Optional notes…" rows={2} />
                    </div>
                    <Button onClick={handleAddStudent} disabled={addingStudent || !newFirstName.trim()} className="w-full">
                      {addingStudent ? 'Adding…' : 'Add Student'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {filtered(students, ['id', 'first_name', 'last_name']).map(s => (
              <Card key={s.id} className="border-border/50">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName(s)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{s.id}</p>
                  </div>
                  {s.grade && <Badge variant="outline" className="text-[9px]">Gr {s.grade}</Badge>}
                  <Badge variant="outline" className="text-[9px]">{s.status || 'active'}</Badge>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(s.id)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ═══════════════ STAFF ═══════════════ */}
          <TabsContent value="staff" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">View & manage staff. Edit display names directly.</p>
              <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Add Staff</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
                  <p className="text-xs text-muted-foreground">Staff members join via invite codes. This will guide you to create one.</p>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Name</Label>
                      <Input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="Staff name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} placeholder="email@school.edu" type="email" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Role</Label>
                      <Select value={newStaffRole} onValueChange={setNewStaffRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="rbt">RBT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddStaff} disabled={addingStaff || !newStaffEmail.trim()} className="w-full gap-1.5">
                      <Key className="h-3.5 w-3.5" />
                      {addingStaff ? 'Processing…' : 'Generate Invite for Staff'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {filtered(staff, ['user_id', 'display_name']).map(s => (
              <Card key={s.user_id} className="border-border/50">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {editingUserId === s.user_id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editNameValue}
                          onChange={e => setEditNameValue(e.target.value)}
                          className="h-7 text-xs max-w-[200px]"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdateDisplayName(s.user_id); if (e.key === 'Escape') setEditingUserId(null); }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateDisplayName(s.user_id)}><Check className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingUserId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{s.display_name}</p>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingUserId(s.user_id); setEditNameValue(s.display_name); }}>
                          <Pencil className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground font-mono">{s.user_id}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{s.role}</Badge>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(s.user_id)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

// ── Helper ──
const IdRow = ({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) => (
  <div className="flex items-center gap-2 py-1.5">
    <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
    <code className="flex-1 text-xs font-mono text-foreground select-all truncate">{value}</code>
    <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => onCopy(value)}>
      <Copy className="h-2.5 w-2.5" />
    </Button>
  </div>
);

export default AdminDashboard;
