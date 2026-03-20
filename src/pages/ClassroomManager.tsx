import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReinforcementTemplates from '@/components/ReinforcementTemplates';
import { ReinforcerStore } from '@/components/ReinforcerStore';
import ClassroomFeed from '@/components/ClassroomFeed';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Users, UserPlus, GraduationCap, Trash2, X, Search, LinkIcon, Copy, Pencil, Sparkles, MessageSquare, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { resolveDisplayNames } from '@/lib/resolve-names';
import type { Client, ClassroomGroup } from '@/lib/types';

// ── Types ──

interface UserProfile {
  user_id: string;
  role: string;
  display_name: string;
}

interface GuestCode {
  id: string;
  code: string;
  guest_name: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  group_id: string;
}

interface GroupWithMembers extends ClassroomGroup {
  teachers: { id: string; user_id: string; staff_role: string }[];
  students: { id: string; client_id: string; client?: Client }[];
  guestCodes: GuestCode[];
}

// ── Component ──

const ClassroomManager = () => {
  const { currentWorkspace, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allMembers, setAllMembers] = useState<UserProfile[]>([]);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGradeBand, setNewGradeBand] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Assign staff dialog
  const [assignTeacherGroupId, setAssignTeacherGroupId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedStaffRole, setSelectedStaffRole] = useState('teacher');

  // Bulk-assign students dialog
  const [bulkAssignGroupId, setBulkAssignGroupId] = useState<string | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Guest code
  const [guestCodeGroupId, setGuestCodeGroupId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestExpiry, setGuestExpiry] = useState('1'); // days
  const [generatedGuestLink, setGeneratedGuestLink] = useState('');
  const [generatingGuest, setGeneratingGuest] = useState(false);

  // Edit group dialog
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGradeBand, setEditGradeBand] = useState('');
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace && isAdmin) loadAll();
  }, [currentWorkspace, isAdmin]);

  // ── Data loading ──

  const loadAll = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const agencyId = currentWorkspace.agency_id;

    try {
      // Load clients first, trying both table names
      let clientsRes = await supabase.from('clients').select('*').eq('agency_id', agencyId).order('last_name');
      if (clientsRes.error) {
        if (import.meta.env.DEV) console.warn('[Classroom] clients table failed, trying students:', clientsRes.error.message);
        clientsRes = await supabase.from('students').select('*').eq('agency_id', agencyId).order('last_name');
      }
      if (clientsRes.error) {
        if (import.meta.env.DEV) console.error('[Classroom] Could not load students:', clientsRes.error.message);
      }
      if (import.meta.env.DEV) console.log('[Classroom] Loaded students:', clientsRes.data?.length ?? 0);

      const [groupsRes, membersRes] = await Promise.all([
        cloudSupabase.from('classroom_groups').select('*').eq('agency_id', agencyId).order('name'),
        supabase.from('agency_memberships').select('user_id, role').eq('agency_id', agencyId),
      ]);

      const groupsList = (groupsRes.data || []) as ClassroomGroup[];
      const rawMembers = (membersRes.data || []) as { user_id: string; role: string }[];
      setAllClients(normalizeClients(clientsRes.data || []));

      // Fetch display names for all member user_ids from profiles table
      const memberProfiles = await fetchUserProfiles(rawMembers.map(m => m.user_id));
      const profileMap = new Map(memberProfiles.map(p => [p.user_id, p.display_name]));

      const enrichedMembers: UserProfile[] = rawMembers.map(m => ({
        user_id: m.user_id,
        role: m.role,
        display_name: profileMap.get(m.user_id) || m.user_id.slice(0, 8) + '…',
      }));
      setAllMembers(enrichedMembers);

      if (groupsList.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const groupIds = groupsList.map(g => g.group_id);

      // Fetch child rows — wrap each in try/catch because Core RLS policies
      // may reference columns that don't match the expected schema
      let teacherRows: any[] = [];
      let studentRows: any[] = [];

      try {
        const teachersRes = await cloudSupabase
          .from('classroom_group_teachers')
          .select('id, group_id, user_id, staff_role')
          .in('group_id', groupIds);
        if (teachersRes.error) {
          if (import.meta.env.DEV) console.warn('[Classroom] Teacher query error (RLS?):', teachersRes.error.message);
        } else {
          teacherRows = teachersRes.data || [];
        }
      } catch (e: any) {
        if (import.meta.env.DEV) console.warn('[Classroom] Teacher query exception:', e.message);
      }

      try {
        const studentsRes = await cloudSupabase
          .from('classroom_group_students')
          .select('id, group_id, client_id')
          .in('group_id', groupIds);
        if (studentsRes.error) {
          if (import.meta.env.DEV) console.warn('[Classroom] Student query error, trying student_id fallback:', studentsRes.error.message);
          // Fallback for older schemas using student_id
          const legacyRes = await cloudSupabase
            .from('classroom_group_students')
            .select('id, group_id, student_id')
            .in('group_id', groupIds);
          if (!legacyRes.error) {
            studentRows = (legacyRes.data || []).map((s: any) => ({
              id: s.id,
              group_id: s.group_id,
              client_id: s.student_id,
            }));
          }
        } else {
          studentRows = studentsRes.data || [];
        }
      } catch (e: any) {
        if (import.meta.env.DEV) console.warn('[Classroom] Student query exception:', e.message);
      }
      const clientMap = new Map(normalizeClients(clientsRes.data || []).map(c => [c.id, c]));

      // Load guest codes for all groups
      let guestCodeRows: GuestCode[] = [];
      try {
        const { data: codes } = await cloudSupabase
          .from('guest_access_codes')
          .select('*')
          .in('group_id', groupIds) as any;
        guestCodeRows = codes || [];
      } catch { /* table may not exist */ }

      const enriched: GroupWithMembers[] = groupsList.map(g => ({
        ...g,
        teachers: teacherRows.filter(t => t.group_id === g.group_id).map(t => ({
          id: t.id,
          user_id: t.user_id,
          staff_role: t.staff_role || 'teacher',
        })),
        students: studentRows.filter(s => s.group_id === g.group_id).map(s => ({
          id: s.id,
          client_id: s.client_id,
          client: clientMap.get(s.client_id),
        })),
        guestCodes: guestCodeRows.filter((c: any) => c.group_id === g.group_id),
      }));

      setGroups(enriched);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to load classroom groups:', err);
      toast({ title: 'Error loading classrooms', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  async function fetchUserProfiles(userIds: string[]): Promise<{ user_id: string; display_name: string }[]> {
    if (userIds.length === 0) return [];

    try {
      const nameMap = await resolveDisplayNames(userIds);
      return userIds.map(id => ({
        user_id: id,
        display_name: nameMap.get(id) || id.slice(0, 8) + '…',
      }));
    } catch {
      return userIds.map(id => ({ user_id: id, display_name: id.slice(0, 8) + '…' }));
    }
  }

  // ── Helpers ──

  const getMemberDisplayName = (userId: string) => {
    return allMembers.find(m => m.user_id === userId)?.display_name || userId.slice(0, 8) + '…';
  };

  // ── Handlers ──

  const handleCreate = async () => {
    if (!currentWorkspace || !user || !newName.trim()) return;
    setCreating(true);
    try {
      const insertData: any = {
        agency_id: currentWorkspace.agency_id,
        name: newName.trim(),
        created_by: user.id,
      };
      if (newGradeBand.trim()) insertData.grade_band = newGradeBand.trim();
      if (newSchoolName.trim()) insertData.school_name = newSchoolName.trim();
      const { error } = await cloudSupabase.from('classroom_groups').insert(insertData);
      if (error) throw error;

      // Sync to Nova Core classrooms table
      const { data: newGroup } = await cloudSupabase
        .from('classroom_groups')
        .select('group_id, name, grade_band, school_name')
        .eq('agency_id', currentWorkspace.agency_id)
        .eq('name', newName.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (newGroup) {
        await supabase.from('classrooms').upsert({
          id: newGroup.group_id,
          name: newGroup.name,
          grade_band: newGroup.grade_band,
          school_name: newGroup.school_name,
          agency_id: currentWorkspace.agency_id,
        }, { onConflict: 'id' });
      }

      toast({ title: 'Classroom created' });
      setShowCreate(false);
      setNewName('');
      setNewGradeBand('');
      setNewSchoolName('');
      setNewDescription('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editGroupId || !editName.trim() || !currentWorkspace) return;
    setEditSaving(true);
    try {
      const updates: any = { name: editName.trim(), grade_band: editGradeBand.trim() || null, school_name: editSchoolName.trim() || null };
      const { error } = await cloudSupabase.from('classroom_groups').update(updates).eq('group_id', editGroupId);
      if (error) throw error;

      // Sync to Nova Core
      await supabase.from('classrooms').upsert({
        id: editGroupId,
        name: updates.name,
        grade_band: updates.grade_band,
        school_name: updates.school_name,
        agency_id: currentWorkspace.agency_id,
      }, { onConflict: 'id' });

      toast({ title: 'Classroom updated' });
      setEditGroupId(null);
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this classroom group? Students will not be deleted.')) return;
    try {
      await supabase.from('classrooms').delete().eq('id', groupId);
      const { error } = await cloudSupabase.from('classroom_groups').delete().eq('group_id', groupId);
      if (error) throw error;
      toast({ title: 'Classroom deleted' });
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAssignTeacher = async () => {
    if (!assignTeacherGroupId || !selectedUserId) return;
    try {
      const row = { group_id: assignTeacherGroupId, user_id: selectedUserId, staff_role: selectedStaffRole };
      const { error } = await cloudSupabase.from('classroom_group_teachers').insert(row);
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('23505')) {
          toast({ title: 'This person is already assigned with that role' });
          setAssignTeacherGroupId(null);
          setSelectedUserId('');
          setSelectedStaffRole('teacher');
          return;
        }
        if (import.meta.env.DEV) console.error('[Classroom] Staff assign error:', error);
        throw error;
      }
      const member = allMembers.find(m => m.user_id === selectedUserId);
      toast({
        title: 'Staff assigned',
        description: member ? `${member.display_name} as ${selectedStaffRole}` : undefined,
      });
      setAssignTeacherGroupId(null);
      setSelectedUserId('');
      setSelectedStaffRole('teacher');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error assigning staff', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveTeacher = async (rowId: string) => {
    try {
      const { error } = await cloudSupabase.from('classroom_group_teachers').delete().eq('id', rowId);
      if (error) throw error;
      toast({ title: 'Teacher removed' });
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleBulkAssignStudents = async () => {
    if (!bulkAssignGroupId || bulkSelectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const ids = Array.from(bulkSelectedIds);
      let assignError: any = null;
      let usedLegacy = false;
      const agencyId = currentWorkspace?.agency_id;

      // Try inserting with agency_id to satisfy not-null constraint
      const rows = ids.map(client_id => ({ group_id: bulkAssignGroupId, client_id, agency_id: agencyId }));
      const { error: insertErr } = await cloudSupabase.from('classroom_group_students').insert(rows);
      assignError = insertErr;

      // Legacy schema fallback (student_id column)
      if (assignError && String(assignError.message || '').toLowerCase().includes('client_id')) {
        const legacyRows = ids.map(client_id => ({ group_id: bulkAssignGroupId, student_id: client_id, agency_id: agencyId }));
        const { error: legacyErr } = await cloudSupabase.from('classroom_group_students').insert(legacyRows as any);
        assignError = legacyErr;
        usedLegacy = true;
      }

      // Ignore harmless duplicate errors
      const message = String(assignError?.message || '').toLowerCase();
      if (assignError && !message.includes('duplicate') && !message.includes('23505')) {
        if (import.meta.env.DEV) console.error('[Classroom] Student assign error:', assignError);
        throw assignError;
      }

      const rowsCount = bulkSelectedIds.size;
      toast({ title: `${rowsCount} student(s) assigned` });
      setBulkAssignGroupId(null);
      setBulkSelectedIds(new Set());
      setBulkSearch('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error assigning students', description: err.message, variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleRemoveStudent = async (rowId: string) => {
    try {
      const { error } = await cloudSupabase.from('classroom_group_students').delete().eq('id', rowId);
      if (error) throw error;
      toast({ title: 'Student removed' });
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleBulkSelect = (clientId: string) => {
    setBulkSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const toggleSelectAll = (available: Client[]) => {
    const allSelected = available.every(c => bulkSelectedIds.has(c.id));
    if (allSelected) {
      setBulkSelectedIds(new Set());
    } else {
      setBulkSelectedIds(new Set(available.map(c => c.id)));
    }
  };

  const handleGenerateGuestCode = async () => {
    if (!guestCodeGroupId || !currentWorkspace || !user) return;
    setGeneratingGuest(true);
    try {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(guestExpiry || '1'));

      const { error } = await cloudSupabase.from('guest_access_codes').insert({
        code,
        group_id: guestCodeGroupId,
        agency_id: currentWorkspace.agency_id,
        created_by: user.id,
        guest_name: guestName.trim() || null,
        expires_at: expiresAt.toISOString(),
      } as any);
      if (error) throw error;

      const link = `${window.location.origin}/guest/${code}`;
      setGeneratedGuestLink(link);
      toast({ title: '✓ Guest code created' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingGuest(false);
    }
  };

  const copyGuestLink = () => {
    navigator.clipboard.writeText(generatedGuestLink);
    toast({ title: 'Link copied!' });
  };

  const handleRevokeGuestCode = async (codeId: string) => {
    try {
      const { error } = await cloudSupabase
        .from('guest_access_codes')
        .update({ is_active: false } as any)
        .eq('id', codeId);
      if (error) throw error;
      toast({ title: 'Guest code revoked' });
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Guard ──

  if (!isAdmin) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Only agency admins can manage classroom groups.</p>
        <Button variant="link" onClick={() => navigate('/students')}>Back to Students</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/students')} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight font-heading">Classroom Groups</h2>
          <p className="text-sm text-muted-foreground">Organize teachers and students into groups</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Classroom
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Classroom Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Room 204 — 3rd Grade" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Grade Band</Label>
                  <Input value={newGradeBand} onChange={e => setNewGradeBand(e.target.value)} placeholder="e.g. 3rd–5th" />
                </div>
                <div className="space-y-1.5">
                  <Label>School Name</Label>
                  <Input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="e.g. Lincoln Elementary" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Optional notes…" rows={2} />
              </div>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full">
                {creating ? 'Creating…' : 'Create Classroom'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No classroom groups yet</p>
          <Button variant="link" className="mt-2" onClick={() => setShowCreate(true)}>Create your first classroom</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const teacherUserIds = new Set(group.teachers.map(t => `${t.user_id}-${t.staff_role}`));
            const studentClientIds = new Set(group.students.map(s => s.client_id));
            const availableTeachers = allMembers;
            const availableStudents = allClients.filter(c => !studentClientIds.has(c.id));

            // Filtered available students for bulk dialog
            const bulkFiltered = bulkSearch
              ? availableStudents.filter(c => displayName(c).toLowerCase().includes(bulkSearch.toLowerCase()))
              : availableStudents;

            return (
              <Card key={group.group_id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-heading">{group.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        {group.grade_band && <p className="text-xs text-muted-foreground">{group.grade_band}{group.school_name ? ` · ${group.school_name}` : ''}</p>}
                        <Badge variant="outline" className="text-[9px] font-mono bg-muted/50 text-muted-foreground select-all cursor-pointer" title="Classroom Group ID">
                          {group.group_id.slice(0, 8)}…
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Dialog
                        open={guestCodeGroupId === group.group_id}
                        onOpenChange={(o) => {
                          if (!o) { setGuestCodeGroupId(null); setGeneratedGuestLink(''); setGuestName(''); }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setGuestCodeGroupId(group.group_id)} title="Generate guest code for substitute">
                            <LinkIcon className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Guest Access Code</DialogTitle></DialogHeader>
                          <p className="text-xs text-muted-foreground">Generate a temporary link for a substitute teacher. No account needed.</p>
                          {generatedGuestLink ? (
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                                <code className="flex-1 text-xs break-all text-foreground">{generatedGuestLink}</code>
                                <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={copyGuestLink}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">Share this link with the substitute. It expires in {guestExpiry} day(s).</p>
                            </div>
                          ) : (
                            <div className="space-y-4 pt-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Substitute Name (optional)</Label>
                                <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="e.g. Ms. Johnson" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Expires in (days)</Label>
                                <Select value={guestExpiry} onValueChange={setGuestExpiry}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 day</SelectItem>
                                    <SelectItem value="3">3 days</SelectItem>
                                    <SelectItem value="7">1 week</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button onClick={handleGenerateGuestCode} disabled={generatingGuest} className="w-full gap-1.5">
                                <LinkIcon className="h-3.5 w-3.5" />
                                {generatingGuest ? 'Generating…' : 'Generate Guest Link'}
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditGroupId(group.group_id);
                        setEditName(group.name);
                        setEditGradeBand(group.grade_band || '');
                        setEditSchoolName(group.school_name || '');
                      }} title="Edit classroom">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(group.group_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs defaultValue="roster" className="w-full">
                    <TabsList className="w-full justify-start h-8">
                      <TabsTrigger value="roster" className="text-xs gap-1 h-7">
                        <Users className="h-3 w-3" /> Roster
                      </TabsTrigger>
                      <TabsTrigger value="templates" className="text-xs gap-1 h-7">
                        <Sparkles className="h-3 w-3" /> Templates
                      </TabsTrigger>
                      <TabsTrigger value="feed" className="text-xs gap-1 h-7">
                        <MessageSquare className="h-3 w-3" /> Feed
                      </TabsTrigger>
                      <TabsTrigger value="store" className="text-xs gap-1 h-7">
                        <ShoppingBag className="h-3 w-3" /> Store
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="roster" className="space-y-4 mt-3">
                  {/* ── Teachers ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                     <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus className="h-3 w-3" /> Staff
                        <Badge variant="outline" className="text-[10px] ml-1">{group.teachers.length}</Badge>
                      </p>
                      <Dialog open={assignTeacherGroupId === group.group_id} onOpenChange={(o) => { if (!o) setAssignTeacherGroupId(null); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setAssignTeacherGroupId(group.group_id); setSelectedStaffRole('teacher'); }}>
                            <Plus className="h-3 w-3" /> Add Staff
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Assign Staff</DialogTitle></DialogHeader>
                          <p className="text-xs text-muted-foreground">Select a team member and their role. The same person can be assigned multiple roles.</p>
                          <div className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Team Member</Label>
                              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a team member…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTeachers.map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                      <span className="flex items-center gap-2">
                                        {m.display_name}
                                        <span className="text-muted-foreground text-xs">({m.role})</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                  {availableTeachers.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">No team members available</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Classroom Role</Label>
                              <Select value={selectedStaffRole} onValueChange={setSelectedStaffRole}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="teacher">Teacher</SelectItem>
                                  <SelectItem value="bi">BI (Behavior Interventionist)</SelectItem>
                                  <SelectItem value="aide">Aide / Paraprofessional</SelectItem>
                                  <SelectItem value="bcba">BCBA / Supervisor</SelectItem>
                                  <SelectItem value="sped">SPED Teacher</SelectItem>
                                  <SelectItem value="slp">SLP</SelectItem>
                                  <SelectItem value="ot">OT</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={handleAssignTeacher} disabled={!selectedUserId} className="w-full">Assign</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.teachers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No teachers assigned</p>
                      ) : group.teachers.map(t => (
                        <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                          <span className="text-xs">{getMemberDisplayName(t.user_id)}</span>
                          <button onClick={() => handleRemoveTeacher(t.id)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* ── Students ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="h-3 w-3" /> Students
                        <Badge variant="outline" className="text-[10px] ml-1">{group.students.length}</Badge>
                      </p>
                      <Dialog
                        open={bulkAssignGroupId === group.group_id}
                        onOpenChange={(o) => {
                          if (!o) {
                            setBulkAssignGroupId(null);
                            setBulkSelectedIds(new Set());
                            setBulkSearch('');
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setBulkAssignGroupId(group.group_id)}
                          >
                            <Plus className="h-3 w-3" /> Add Students
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Add Students to {group.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 pt-2 flex-1 overflow-hidden flex flex-col">
                            {/* Search */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Search students…"
                                value={bulkSearch}
                                onChange={e => setBulkSearch(e.target.value)}
                                className="pl-9 h-9 text-sm"
                              />
                            </div>

                            {/* Select all */}
                            {bulkFiltered.length > 0 && (
                              <div className="flex items-center justify-between px-1">
                                <button
                                  onClick={() => toggleSelectAll(bulkFiltered)}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {bulkFiltered.every(c => bulkSelectedIds.has(c.id)) ? 'Deselect all' : 'Select all'}
                                </button>
                                <span className="text-xs text-muted-foreground">{bulkSelectedIds.size} selected</span>
                              </div>
                            )}

                            {/* List */}
                            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[40vh]">
                              {bulkFiltered.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                  {availableStudents.length === 0 ? 'All students already assigned' : 'No matches'}
                                </p>
                              ) : bulkFiltered.map(c => (
                                <label
                                  key={c.id}
                                  className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                                >
                                  <Checkbox
                                    checked={bulkSelectedIds.has(c.id)}
                                    onCheckedChange={() => toggleBulkSelect(c.id)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{displayName(c)}</p>
                                    {c.grade && <p className="text-[10px] text-muted-foreground">Grade {c.grade}</p>}
                                  </div>
                                </label>
                              ))}
                            </div>

                            {/* Submit */}
                            <Button
                              onClick={handleBulkAssignStudents}
                              disabled={bulkSelectedIds.size === 0 || bulkSaving}
                              className="w-full"
                            >
                              {bulkSaving ? 'Assigning…' : `Assign ${bulkSelectedIds.size} Student${bulkSelectedIds.size !== 1 ? 's' : ''}`}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.students.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No students assigned</p>
                      ) : group.students.map(s => (
                        <Badge key={s.id} variant="outline" className="gap-1 pr-1">
                          <span className="text-xs">{s.client ? displayName(s.client) : s.client_id.slice(0, 8) + '…'}</span>
                          <button onClick={() => handleRemoveStudent(s.id)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* ── Guest Codes ── */}
                  {group.guestCodes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <LinkIcon className="h-3 w-3" /> Guest Codes
                        <Badge variant="outline" className="text-[10px] ml-1">{group.guestCodes.length}</Badge>
                      </p>
                      <div className="space-y-1.5">
                        {group.guestCodes.map(gc => {
                          const expired = new Date(gc.expires_at) < new Date();
                          const active = gc.is_active && !expired;
                          return (
                            <div key={gc.id} className={`flex items-center gap-2 rounded-md border border-border/40 px-2.5 py-1.5 ${!active ? 'opacity-50' : ''}`}>
                              <code className="text-xs font-mono text-foreground">{gc.code}</code>
                              {gc.guest_name && <span className="text-[10px] text-muted-foreground">{gc.guest_name}</span>}
                              {!gc.is_active && <Badge variant="destructive" className="text-[8px] h-4">Revoked</Badge>}
                              {expired && gc.is_active && <Badge variant="secondary" className="text-[8px] h-4">Expired</Badge>}
                              {active && <Badge variant="outline" className="text-[8px] h-4 border-accent text-accent-foreground">Active</Badge>}
                              <span className="flex-1" />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/guest/${gc.code}`); toast({ title: 'Link copied!' }); }}
                                title="Copy guest link"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                              {gc.is_active && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => handleRevokeGuestCode(gc.id)}
                                  title="Revoke"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                    </TabsContent>

                    <TabsContent value="templates" className="mt-3">
                      <ReinforcementTemplates
                        groupId={group.group_id}
                        agencyId={currentWorkspace?.agency_id || ''}
                      />
                    </TabsContent>

                    <TabsContent value="feed" className="mt-3">
                      <ClassroomFeed
                        groupId={group.group_id}
                        agencyId={currentWorkspace?.agency_id || ''}
                      />
                    </TabsContent>

                    <TabsContent value="store" className="mt-3">
                      <ReinforcerStore
                        agencyId={currentWorkspace?.agency_id || ''}
                        classroomId={group.group_id}
                        students={group.students.map(s => ({
                          id: s.client_id,
                          name: s.client ? displayName(s.client) : s.client_id.slice(0, 8),
                          balance: 0,
                        }))}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Group Dialog */}
      <Dialog open={!!editGroupId} onOpenChange={(o) => { if (!o) setEditGroupId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Classroom</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Classroom Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Room 204" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Grade Band (optional)</Label>
              <Input value={editGradeBand} onChange={e => setEditGradeBand(e.target.value)} placeholder="e.g. K-2" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">School Name (optional)</Label>
              <Input value={editSchoolName} onChange={e => setEditSchoolName(e.target.value)} placeholder="e.g. Lincoln Elementary" />
            </div>
            <Button onClick={handleUpdateGroup} disabled={editSaving || !editName.trim()} className="w-full">
              {editSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassroomManager;
