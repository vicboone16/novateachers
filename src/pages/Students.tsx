import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Search, User, Eye, EyeOff, CalendarClock, TrendingUp, Sparkles, Users, Share2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName, displayInitials } from '@/lib/student-utils';
import { fetchAccessibleClients, fetchGroupedRoster } from '@/lib/client-access';
import type { Client, ClassroomGroup } from '@/lib/types';
import type { GroupedStudentRoster, ClassroomGroupWithStudents } from '@/lib/client-access';

const GRADE_OPTIONS = ['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SETTING_OPTIONS = ['General Education', 'Resource Room', 'Self-Contained', 'Inclusion', 'Other'];

interface AddStudentForm {
  first_name: string;
  last_name: string;
  grade: string;
  school_name: string;
  district_name: string;
  primary_setting: string;
  iep_date: string;
  next_iep_review_date: string;
  diagnoses: string;
  funding_mode: string;
}

const emptyForm: AddStudentForm = {
  first_name: '',
  last_name: '',
  grade: '',
  school_name: '',
  district_name: '',
  primary_setting: '',
  iep_date: '',
  next_iep_review_date: '',
  diagnoses: '',
  funding_mode: 'education',
};

type ChipFilter = 'all' | 'iep_due' | 'new';

const Students = () => {
  const { currentWorkspace, isSoloMode, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [groupedRoster, setGroupedRoster] = useState<GroupedStudentRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [chipFilter, setChipFilter] = useState<ChipFilter>('all');
  const [viewAll, setViewAll] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddStudentForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace, viewAll]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      if (isSoloMode || isAdmin) {
        // Solo or admin: flat list
        const data = await fetchAccessibleClients({
          currentWorkspace,
          isSoloMode,
          userId: user?.id,
          viewAll,
        });
        setClients(normalizeClients(data));
        setGroupedRoster(null);
      } else if (user?.id) {
        // Connected teacher: grouped roster
        const roster = await fetchGroupedRoster({
          currentWorkspace,
          userId: user.id,
        });
        setGroupedRoster(roster);
        setClients(roster.all);
      }
    } catch (err: any) {
      console.error('Failed to load clients:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!currentWorkspace || !form.first_name.trim() || !form.last_name.trim() || !form.grade) {
      toast({ title: 'First name, last name, and grade are required', variant: 'destructive' });
      return;
    }
    setSaving(true);

    try {
      const diagnosesArr = form.diagnoses
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const { error } = await supabase.from('students').insert({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        grade: form.grade,
        school_name: form.school_name.trim() || null,
        district_name: form.district_name.trim() || null,
        primary_setting: form.primary_setting || null,
        iep_date: form.iep_date || null,
        next_iep_review_date: form.next_iep_review_date || null,
        diagnoses: diagnosesArr.length > 0 ? diagnosesArr : null,
        funding_mode: form.funding_mode || 'education',
        agency_id: currentWorkspace.agency_id,
        student_origin: 'solo_teacher',
        created_in_app: 'novatrack_teacher',
      });

      if (error) throw error;

      toast({ title: 'Student added' });
      setShowAdd(false);
      setForm(emptyForm);
      loadClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof AddStudentForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = (list: Client[]) => {
    let result = list;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => displayName(c).toLowerCase().includes(q));
    }

    if (gradeFilter !== 'all') {
      result = result.filter((c) => c.grade === gradeFilter);
    }

    const now = new Date();
    if (chipFilter === 'iep_due') {
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      result = result.filter((c) => {
        if (!c.next_iep_review_date) return false;
        return new Date(c.next_iep_review_date) <= thirtyDays;
      });
    } else if (chipFilter === 'new') {
      const sevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter((c) => new Date(c.created_at) >= sevenDays);
    }

    return result;
  };

  const filtered = useMemo(() => applyFilters(clients), [clients, search, gradeFilter, chipFilter]);

  const availableGrades = useMemo(() => {
    const grades = new Set(clients.map((c) => c.grade).filter(Boolean));
    return Array.from(grades).sort((a, b) => {
      const ai = GRADE_OPTIONS.indexOf(a!);
      const bi = GRADE_OPTIONS.indexOf(b!);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [clients]);

  const hasActiveFilters = search || gradeFilter !== 'all' || chipFilter !== 'all';
  const showGroupedView = !isSoloMode && !isAdmin && groupedRoster && !hasActiveFilters;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading">Students</h2>
          <p className="text-sm text-muted-foreground">
            {isSoloMode ? 'Manage your classroom roster' : 'View your assigned students'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/classrooms')}>
              <Settings className="h-4 w-4" />
              Classrooms
            </Button>
          )}
          {isSoloMode && (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Student</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>First Name *</Label>
                      <Input value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name *</Label>
                      <Input value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Grade *</Label>
                      <Select value={form.grade} onValueChange={(v) => updateField('grade', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADE_OPTIONS.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Primary Setting</Label>
                      <Select value={form.primary_setting} onValueChange={(v) => updateField('primary_setting', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select setting" />
                        </SelectTrigger>
                        <SelectContent>
                          {SETTING_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>School Name</Label>
                      <Input value={form.school_name} onChange={(e) => updateField('school_name', e.target.value)} placeholder="Optional" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>District Name</Label>
                      <Input value={form.district_name} onChange={(e) => updateField('district_name', e.target.value)} placeholder="Optional" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>IEP Date</Label>
                      <Input type="date" value={form.iep_date} onChange={(e) => updateField('iep_date', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Next IEP Review</Label>
                      <Input type="date" value={form.next_iep_review_date} onChange={(e) => updateField('next_iep_review_date', e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Diagnoses</Label>
                    <Input
                      value={form.diagnoses}
                      onChange={(e) => updateField('diagnoses', e.target.value)}
                      placeholder="Comma-separated, e.g. ADHD, ASD"
                    />
                  </div>

                  <Button onClick={handleAdd} disabled={saving} className="w-full">
                    {saving ? 'Adding…' : 'Add Student'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {availableGrades.map((g) => (
              <SelectItem key={g} value={g!}>Grade {g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1.5">
          <Button variant={chipFilter === 'all' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setChipFilter('all')}>All</Button>
          <Button variant={chipFilter === 'iep_due' ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1" onClick={() => setChipFilter('iep_due')}>
            <CalendarClock className="h-3 w-3" />IEP Due Soon
          </Button>
          <Button variant={chipFilter === 'new' ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1" onClick={() => setChipFilter('new')}>
            <Sparkles className="h-3 w-3" />New
          </Button>
        </div>

        {!isSoloMode && isAdmin && (
          <Button
            variant={viewAll ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 whitespace-nowrap h-8 text-xs"
            onClick={() => setViewAll((v) => !v)}
          >
            {viewAll ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {viewAll ? 'Current Agency' : 'View All'}
          </Button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : showGroupedView ? (
        <GroupedRosterView
          roster={groupedRoster}
          onStudentClick={(id) => navigate(`/students/${id}`)}
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <User className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? 'No students match your filters' : 'No students yet'}
          </p>
          {isSoloMode && !search && chipFilter === 'all' && (
            <Button variant="link" className="mt-2" onClick={() => setShowAdd(true)}>
              Add your first student
            </Button>
          )}
        </div>
      ) : (
        <StudentGrid clients={filtered} onStudentClick={(id) => navigate(`/students/${id}`)} />
      )}
    </div>
  );
};

// ── Sub-components ──

const StudentGrid = ({ clients, onStudentClick }: { clients: Client[]; onStudentClick: (id: string) => void }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {clients.map((client) => (
      <StudentCard key={client.id} client={client} onClick={() => onStudentClick(client.id)} />
    ))}
  </div>
);

const StudentCard = ({ client, onClick }: { client: Client; onClick: () => void }) => (
  <Card
    className="cursor-pointer border-border/50 transition-all hover:shadow-md hover:border-primary/20"
    onClick={onClick}
  >
    <CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
        <span className="text-sm font-semibold">{displayInitials(client)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{displayName(client)}</p>
        <div className="flex items-center gap-2">
          {client.grade && (
            <span className="text-xs text-muted-foreground">Grade {client.grade}</span>
          )}
          {client.next_iep_review_date && (() => {
            const review = new Date(client.next_iep_review_date);
            const soon = review <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            return soon ? (
              <Badge variant="outline" className="text-[10px] h-5 border-destructive/30 text-destructive">
                IEP Due
              </Badge>
            ) : null;
          })()}
        </div>
      </div>
    </CardContent>
  </Card>
);

const GroupedRosterView = ({
  roster,
  onStudentClick,
}: {
  roster: GroupedStudentRoster;
  onStudentClick: (id: string) => void;
}) => {
  const hasClassrooms = roster.classrooms.length > 0;
  const hasShared = roster.sharedWithMe.length > 0;

  if (!hasClassrooms && !hasShared) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
        <User className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No students assigned to you yet</p>
        <p className="text-xs text-muted-foreground mt-1">Ask your admin to add you to a classroom group or share students with you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {hasClassrooms && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold font-heading">My Classrooms</h3>
          </div>
          {roster.classrooms.map((cg) => (
            <div key={cg.group.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-foreground">{cg.group.name}</h4>
                <Badge variant="secondary" className="text-[10px]">{cg.clients.length} students</Badge>
                {cg.group.description && (
                  <span className="text-xs text-muted-foreground">— {cg.group.description}</span>
                )}
              </div>
              {cg.clients.length > 0 ? (
                <StudentGrid clients={cg.clients} onStudentClick={onStudentClick} />
              ) : (
                <p className="text-xs text-muted-foreground pl-1">No students in this classroom yet.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {hasShared && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" />
            <h3 className="text-lg font-semibold font-heading">Shared with Me</h3>
            <Badge variant="secondary" className="text-[10px]">{roster.sharedWithMe.length}</Badge>
          </div>
          <StudentGrid clients={roster.sharedWithMe} onStudentClick={onStudentClick} />
        </div>
      )}
    </div>
  );
};

export default Students;
