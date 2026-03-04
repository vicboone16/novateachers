import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ArrowLeft, Plus, Users, UserPlus, GraduationCap, Trash2, X, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName } from '@/lib/student-utils';
import type { Client, ClassroomGroup } from '@/lib/types';

// ── Types ──

interface UserProfile {
  user_id: string;
  role: string;
  display_name: string;
}

interface GroupWithMembers extends ClassroomGroup {
  teachers: { id: string; user_id: string }[];
  students: { id: string; client_id: string; client?: Client }[];
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
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Assign teacher dialog
  const [assignTeacherGroupId, setAssignTeacherGroupId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Bulk-assign students dialog
  const [bulkAssignGroupId, setBulkAssignGroupId] = useState<string | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

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
        supabase.from('classroom_groups').select('*').eq('agency_id', agencyId).order('name'),
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
        const teachersRes = await supabase
          .from('classroom_group_teachers')
          .select('id, group_id, user_id')
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
        const studentsRes = await supabase
          .from('classroom_group_students')
          .select('id, group_id, client_id')
          .in('group_id', groupIds);
        if (studentsRes.error) {
          if (import.meta.env.DEV) console.warn('[Classroom] Student query error, trying student_id fallback:', studentsRes.error.message);
          // Fallback for older schemas using student_id
          const legacyRes = await supabase
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

      const enriched: GroupWithMembers[] = groupsList.map(g => ({
        ...g,
        teachers: teacherRows.filter(t => t.group_id === g.group_id).map(t => ({
          id: t.id,
          user_id: t.user_id,
        })),
        students: studentRows.filter(s => s.group_id === g.group_id).map(s => ({
          id: s.id,
          client_id: s.client_id,
          client: clientMap.get(s.client_id),
        })),
      }));

      setGroups(enriched);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to load classroom groups:', err);
      toast({ title: 'Error loading classrooms', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /** Try to fetch display names from a profiles table; fall back to auth user metadata */
  async function fetchUserProfiles(userIds: string[]): Promise<{ user_id: string; display_name: string }[]> {
    if (userIds.length === 0) return [];

    // Try profiles table first (common pattern)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (!error && data?.length) {
        return data.map((p: any) => ({
          user_id: p.id,
          display_name: p.full_name || p.email || p.id.slice(0, 8) + '…',
        }));
      }
    } catch {
      // profiles table may not exist
    }

    // Fallback: try user_profiles or just return IDs
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (!error && data?.length) {
        return data.map((p: any) => ({
          user_id: p.user_id,
          display_name: p.full_name || p.email || p.user_id.slice(0, 8) + '…',
        }));
      }
    } catch {
      // table doesn't exist
    }

    return userIds.map(id => ({ user_id: id, display_name: id.slice(0, 8) + '…' }));
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
      const { error } = await supabase.from('classroom_groups').insert({
        agency_id: currentWorkspace.agency_id,
        name: newName.trim(),
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: 'Classroom created' });
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this classroom group? Students will not be deleted.')) return;
    try {
      const { error } = await supabase.from('classroom_groups').delete().eq('group_id', groupId);
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
      const row = { group_id: assignTeacherGroupId, user_id: selectedUserId };
      // Try insert first (simpler, avoids upsert conflict target issues)
      const { error } = await supabase.from('classroom_group_teachers').insert(row);
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        // Ignore duplicate — teacher already assigned
        if (msg.includes('duplicate') || msg.includes('23505')) {
          toast({ title: 'Teacher already assigned to this classroom' });
          setAssignTeacherGroupId(null);
          setSelectedUserId('');
          return;
        }
        if (import.meta.env.DEV) console.error('[Classroom] Teacher assign error:', error);
        throw error;
      }
      const member = allMembers.find(m => m.user_id === selectedUserId);
      toast({
        title: 'Teacher assigned',
        description: member ? `${member.display_name} (synced from staff)` : undefined,
      });
      setAssignTeacherGroupId(null);
      setSelectedUserId('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error assigning teacher', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveTeacher = async (rowId: string) => {
    try {
      const { error } = await supabase.from('classroom_group_teachers').delete().eq('id', rowId);
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
      const { error: insertErr } = await supabase.from('classroom_group_students').insert(rows);
      assignError = insertErr;

      // Legacy schema fallback (student_id column)
      if (assignError && String(assignError.message || '').toLowerCase().includes('client_id')) {
        const legacyRows = ids.map(client_id => ({ group_id: bulkAssignGroupId, student_id: client_id, agency_id: agencyId }));
        const { error: legacyErr } = await supabase.from('classroom_group_students').insert(legacyRows as any);
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
      const { error } = await supabase.from('classroom_group_students').delete().eq('id', rowId);
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
            const teacherUserIds = new Set(group.teachers.map(t => t.user_id));
            const studentClientIds = new Set(group.students.map(s => s.client_id));
            const availableTeachers = allMembers.filter(m => !teacherUserIds.has(m.user_id));
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
                      {group.grade_band && <p className="text-xs text-muted-foreground mt-0.5">{group.grade_band}{group.school_name ? ` · ${group.school_name}` : ''}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(group.group_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* ── Teachers ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus className="h-3 w-3" /> Teachers
                      </p>
                      <Dialog open={assignTeacherGroupId === group.group_id} onOpenChange={(o) => { if (!o) setAssignTeacherGroupId(null); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssignTeacherGroupId(group.group_id)}>
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Assign Teacher</DialogTitle></DialogHeader>
                          <p className="text-xs text-muted-foreground">Showing existing staff members from your agency. Teachers are synced automatically.</p>
                          <div className="space-y-4 pt-2">
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
                                      <Badge variant="outline" className="text-[9px] h-4 px-1">Staff ✓</Badge>
                                    </span>
                                  </SelectItem>
                                ))}
                                {availableTeachers.length === 0 && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">All members assigned</div>
                                )}
                              </SelectContent>
                            </Select>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClassroomManager;
