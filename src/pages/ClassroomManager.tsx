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
import { ArrowLeft, Plus, Users, UserPlus, GraduationCap, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName } from '@/lib/student-utils';
import type { Client, ClassroomGroup } from '@/lib/types';

interface GroupWithMembers extends ClassroomGroup {
  teachers: { id: string; user_id: string; email?: string }[];
  students: { id: string; client_id: string; client?: Client }[];
}

const ClassroomManager = () => {
  const { currentWorkspace, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allMembers, setAllMembers] = useState<{ user_id: string; role: string; email?: string }[]>([]);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Assign dialogs
  const [assignTeacherGroupId, setAssignTeacherGroupId] = useState<string | null>(null);
  const [assignStudentGroupId, setAssignStudentGroupId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

  useEffect(() => {
    if (currentWorkspace && isAdmin) loadAll();
  }, [currentWorkspace, isAdmin]);

  const loadAll = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const agencyId = currentWorkspace.agency_id;

    try {
      // Load groups, members, clients in parallel
      const [groupsRes, membersRes, clientsRes] = await Promise.all([
        supabase.from('classroom_groups').select('*').eq('agency_id', agencyId).order('name'),
        supabase.from('agency_memberships').select('user_id, role').eq('agency_id', agencyId),
        (async () => {
          let r = await supabase.from('clients').select('*').eq('agency_id', agencyId).order('last_name');
          if (r.error) r = await supabase.from('students').select('*').eq('agency_id', agencyId).order('last_name');
          return r;
        })(),
      ]);

      const groupsList = (groupsRes.data || []) as ClassroomGroup[];
      setAllMembers((membersRes.data || []) as any[]);
      setAllClients(normalizeClients(clientsRes.data || []));

      if (groupsList.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const groupIds = groupsList.map(g => g.id);

      // Load teachers and students for all groups
      const [teachersRes, studentsRes] = await Promise.all([
        supabase.from('classroom_group_teachers').select('id, group_id, user_id').in('group_id', groupIds),
        supabase.from('classroom_group_students').select('id, group_id, client_id').in('group_id', groupIds),
      ]);

      const teacherRows = (teachersRes.data || []) as any[];
      const studentRows = (studentsRes.data || []) as any[];

      const clientMap = new Map(normalizeClients(clientsRes.data || []).map(c => [c.id, c]));

      const enriched: GroupWithMembers[] = groupsList.map(g => ({
        ...g,
        teachers: teacherRows.filter(t => t.group_id === g.id).map(t => ({
          id: t.id,
          user_id: t.user_id,
        })),
        students: studentRows.filter(s => s.group_id === g.id).map(s => ({
          id: s.id,
          client_id: s.client_id,
          client: clientMap.get(s.client_id),
        })),
      }));

      setGroups(enriched);
    } catch (err: any) {
      console.error('Failed to load classroom groups:', err);
      toast({ title: 'Error loading classrooms', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!currentWorkspace || !user || !newName.trim()) return;
    setCreating(true);

    try {
      const { error } = await supabase.from('classroom_groups').insert({
        agency_id: currentWorkspace.agency_id,
        name: newName.trim(),
        description: newDescription.trim() || null,
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
      const { error } = await supabase.from('classroom_groups').delete().eq('id', groupId);
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
      const { error } = await supabase.from('classroom_group_teachers').insert({
        group_id: assignTeacherGroupId,
        user_id: selectedUserId,
      });
      if (error) throw error;
      toast({ title: 'Teacher assigned' });
      setAssignTeacherGroupId(null);
      setSelectedUserId('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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

  const handleAssignStudent = async () => {
    if (!assignStudentGroupId || !selectedClientId) return;
    try {
      const { error } = await supabase.from('classroom_group_students').insert({
        group_id: assignStudentGroupId,
        client_id: selectedClientId,
      });
      if (error) throw error;
      toast({ title: 'Student assigned' });
      setAssignStudentGroupId(null);
      setSelectedClientId('');
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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

            return (
              <Card key={group.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-heading">{group.name}</CardTitle>
                      {group.description && <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Teachers */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus className="h-3 w-3" /> Teachers
                      </p>
                      <Dialog open={assignTeacherGroupId === group.id} onOpenChange={(o) => { if (!o) setAssignTeacherGroupId(null); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssignTeacherGroupId(group.id)}>
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Assign Teacher</DialogTitle></DialogHeader>
                          <div className="space-y-4 pt-2">
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a team member…" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableTeachers.map(m => (
                                  <SelectItem key={m.user_id} value={m.user_id}>
                                    {m.user_id.slice(0, 8)}… ({m.role})
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
                          <span className="text-xs">{t.user_id.slice(0, 8)}…</span>
                          <button onClick={() => handleRemoveTeacher(t.id)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Students */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="h-3 w-3" /> Students
                        <Badge variant="outline" className="text-[10px] ml-1">{group.students.length}</Badge>
                      </p>
                      <Dialog open={assignStudentGroupId === group.id} onOpenChange={(o) => { if (!o) setAssignStudentGroupId(null); }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssignStudentGroupId(group.id)}>
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Assign Student</DialogTitle></DialogHeader>
                          <div className="space-y-4 pt-2">
                            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a student…" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableStudents.map(c => (
                                  <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
                                ))}
                                {availableStudents.length === 0 && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">All students assigned</div>
                                )}
                              </SelectContent>
                            </Select>
                            <Button onClick={handleAssignStudent} disabled={!selectedClientId} className="w-full">Assign</Button>
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
