import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Search, User, Eye, EyeOff, CalendarClock, Sparkles, Users, Share2, Settings, KeyRound, Link2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName, displayInitials } from '@/lib/student-utils';
import { fetchAccessibleClients, fetchGroupedRoster } from '@/lib/client-access';
import type { Client, ClassroomGroup } from '@/lib/types';
import type { GroupedStudentRoster } from '@/lib/client-access';

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
  first_name: '', last_name: '', grade: '', school_name: '', district_name: '',
  primary_setting: '', iep_date: '', next_iep_review_date: '', diagnoses: '', funding_mode: 'education',
};

type ChipFilter = 'all' | 'iep_due' | 'new';
type RosterTab = 'all' | 'classrooms' | 'shared';

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
  const [rosterTab, setRosterTab] = useState<RosterTab>('all');
  const [viewAll, setViewAll] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
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
        const data = await fetchAccessibleClients({
          currentWorkspace, isSoloMode, userId: user?.id, viewAll,
        });
        setClients(normalizeClients(data));
        setGroupedRoster(null);
      } else if (user?.id) {
        // Try v_teacher_roster first
        try {
          const { data: rosterRows, error: rosterErr } = await supabase
            .from('v_teacher_roster')
            .select('*')
            .eq('user_id', user.id)
            .eq('agency_id', currentWorkspace.agency_id)
            .order('display_name');

          if (!rosterErr && rosterRows) {
            // Build grouped roster from the view
            const classroomIds = new Set<string>();
            const sharedIds = new Set<string>();
            const groupMap = new Map<string, { group_id: string; group_name: string; clientIds: string[] }>();

            for (const row of rosterRows as any[]) {
              if (row.access_source === 'classroom_group') {
                classroomIds.add(row.client_id);
                const gid = row.group_id;
                if (gid) {
                  if (!groupMap.has(gid)) groupMap.set(gid, { group_id: gid, group_name: row.group_name || 'Classroom', clientIds: [] });
                  groupMap.get(gid)!.clientIds.push(row.client_id);
                }
              } else {
                sharedIds.add(row.client_id);
              }
            }

            // Fetch full client records
            const allIds = Array.from(new Set([...classroomIds, ...sharedIds]));
            let clientRecords: Client[] = [];
            if (allIds.length > 0) {
              let res = await supabase.from('clients').select('*').in('id', allIds).eq('agency_id', currentWorkspace.agency_id).order('last_name');
              if (res.error) res = await supabase.from('students').select('*').in('id', allIds).eq('agency_id', currentWorkspace.agency_id).order('last_name');
              clientRecords = normalizeClients(res.data || []);
            }
            const clientMap = new Map(clientRecords.map(c => [c.id, c]));

            const classrooms = Array.from(groupMap.values()).map(g => ({
              group: { group_id: g.group_id, agency_id: currentWorkspace.agency_id, name: g.group_name, created_by: '', created_at: '' } as ClassroomGroup,
              clients: g.clientIds.map(id => clientMap.get(id)).filter(Boolean) as Client[],
            }));

            const sharedWithMe = Array.from(sharedIds).map(id => clientMap.get(id)).filter(Boolean) as Client[];

            const roster: GroupedStudentRoster = {
              classrooms,
              sharedWithMe,
              all: clientRecords,
            };

            setGroupedRoster(roster);
            setClients(roster.all);
            setLoading(false);
            return;
          }
        } catch {
          // v_teacher_roster doesn't exist, fall back
        }

        // Fallback
        const roster = await fetchGroupedRoster({ currentWorkspace, userId: user.id });
        setGroupedRoster(roster);
        setClients(roster.all);
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to load clients:', err);
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
      const diagnosesArr = form.diagnoses.split(',').map(d => d.trim()).filter(Boolean);
      const { error } = await supabase.from('students').insert({
        first_name: form.first_name.trim(), last_name: form.last_name.trim(), grade: form.grade,
        school_name: form.school_name.trim() || null, district_name: form.district_name.trim() || null,
        primary_setting: form.primary_setting || null, iep_date: form.iep_date || null,
        next_iep_review_date: form.next_iep_review_date || null,
        diagnoses: diagnosesArr.length > 0 ? diagnosesArr : null,
        funding_mode: form.funding_mode || 'education',
        agency_id: currentWorkspace.agency_id, student_origin: 'solo_teacher', created_in_app: 'novatrack_teacher',
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

  const handleCsvImport = async () => {
    if (!csvFile || !currentWorkspace) return;
    setCsvImporting(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const firstNameIdx = headers.findIndex(h => h.includes('first'));
      const lastNameIdx = headers.findIndex(h => h.includes('last'));
      const gradeIdx = headers.findIndex(h => h === 'grade');
      const schoolIdx = headers.findIndex(h => h.includes('school'));
      const districtIdx = headers.findIndex(h => h.includes('district'));
      const settingIdx = headers.findIndex(h => h.includes('setting'));
      const diagnosesIdx = headers.findIndex(h => h.includes('diagnos'));

      if (firstNameIdx === -1 || lastNameIdx === -1) {
        throw new Error('CSV must have "first_name" and "last_name" columns');
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const firstName = cols[firstNameIdx]?.trim();
        const lastName = cols[lastNameIdx]?.trim();
        if (!firstName || !lastName) continue;

        rows.push({
          first_name: firstName,
          last_name: lastName,
          grade: gradeIdx !== -1 ? cols[gradeIdx] || null : null,
          school_name: schoolIdx !== -1 ? cols[schoolIdx] || null : null,
          district_name: districtIdx !== -1 ? cols[districtIdx] || null : null,
          primary_setting: settingIdx !== -1 ? cols[settingIdx] || null : null,
          diagnoses: diagnosesIdx !== -1 && cols[diagnosesIdx] ? cols[diagnosesIdx].split(';').map(d => d.trim()).filter(Boolean) : null,
          agency_id: currentWorkspace.agency_id,
          student_origin: 'solo_teacher',
          created_in_app: 'novatrack_teacher',
          funding_mode: 'education',
        });
      }

      if (rows.length === 0) throw new Error('No valid rows found in CSV');

      const { error } = await supabase.from('students').insert(rows);
      if (error) throw error;

      toast({ title: `${rows.length} student(s) imported` });
      setShowCsvImport(false);
      setCsvFile(null);
      loadClients();
    } catch (err: any) {
      toast({ title: 'Import error', description: err.message, variant: 'destructive' });
    } finally {
      setCsvImporting(false);
    }
  };

  const updateField = (field: keyof AddStudentForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const applyFilters = (list: Client[]) => {
    let result = list;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => displayName(c).toLowerCase().includes(q));
    }
    if (gradeFilter !== 'all') result = result.filter(c => c.grade === gradeFilter);
    const now = new Date();
    if (chipFilter === 'iep_due') {
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      result = result.filter(c => c.next_iep_review_date && new Date(c.next_iep_review_date) <= thirtyDays);
    } else if (chipFilter === 'new') {
      const sevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(c => new Date(c.created_at) >= sevenDays);
    }
    return result;
  };

  // Get the client list for the current tab
  const tabClients = useMemo(() => {
    if (!groupedRoster || isSoloMode || isAdmin) return clients;
    if (rosterTab === 'classrooms') {
      const ids = new Set(groupedRoster.classrooms.flatMap(cg => cg.clients.map(c => c.id)));
      return clients.filter(c => ids.has(c.id));
    }
    if (rosterTab === 'shared') {
      const ids = new Set(groupedRoster.sharedWithMe.map(c => c.id));
      return clients.filter(c => ids.has(c.id));
    }
    return clients;
  }, [clients, groupedRoster, rosterTab, isSoloMode, isAdmin]);

  const filtered = useMemo(() => applyFilters(tabClients), [tabClients, search, gradeFilter, chipFilter]);

  const availableGrades = useMemo(() => {
    const grades = new Set(clients.map(c => c.grade).filter(Boolean));
    return Array.from(grades).sort((a, b) => {
      const ai = GRADE_OPTIONS.indexOf(a!);
      const bi = GRADE_OPTIONS.indexOf(b!);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [clients]);

  const hasActiveFilters = search || gradeFilter !== 'all' || chipFilter !== 'all';
  const showRosterTabs = !isSoloMode && !isAdmin && groupedRoster &&
    (groupedRoster.classrooms.length > 0 || groupedRoster.sharedWithMe.length > 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight font-heading">Students</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isSoloMode ? 'Manage your classroom roster' : 'View your assigned students'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/join')}>
            <KeyRound className="h-3.5 w-3.5" />
            Join
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/invites')}>
                <Link2 className="h-3.5 w-3.5" />
                Invite
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/classrooms')}>
                <Settings className="h-3.5 w-3.5" />
                Classrooms
              </Button>
            </>
          )}
          {isSoloMode && (
            <div className="flex gap-2">
              <Dialog open={showCsvImport} onOpenChange={setShowCsvImport}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Upload className="h-4 w-4" />
                    CSV Import
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Students from CSV</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Upload a CSV with columns: <strong>first_name</strong>, <strong>last_name</strong> (required), and optionally: grade, school_name, district_name, primary_setting, diagnoses (semicolon-separated).
                    </p>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={e => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <Button onClick={handleCsvImport} disabled={csvImporting || !csvFile} className="w-full">
                      {csvImporting ? 'Importing…' : 'Import Students'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
                        <Input value={form.first_name} onChange={e => updateField('first_name', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Last Name *</Label>
                        <Input value={form.last_name} onChange={e => updateField('last_name', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Grade *</Label>
                        <Select value={form.grade} onValueChange={v => updateField('grade', v)}>
                          <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                          <SelectContent>
                            {GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Primary Setting</Label>
                        <Select value={form.primary_setting} onValueChange={v => updateField('primary_setting', v)}>
                          <SelectTrigger><SelectValue placeholder="Select setting" /></SelectTrigger>
                          <SelectContent>
                            {SETTING_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>School Name</Label>
                        <Input value={form.school_name} onChange={e => updateField('school_name', e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>District Name</Label>
                        <Input value={form.district_name} onChange={e => updateField('district_name', e.target.value)} placeholder="Optional" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>IEP Date</Label>
                        <Input type="date" value={form.iep_date} onChange={e => updateField('iep_date', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Next IEP Review</Label>
                        <Input type="date" value={form.next_iep_review_date} onChange={e => updateField('next_iep_review_date', e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Diagnoses</Label>
                      <Input value={form.diagnoses} onChange={e => updateField('diagnoses', e.target.value)} placeholder="Comma-separated, e.g. ADHD, ASD" />
                    </div>
                    <Button onClick={handleAdd} disabled={saving} className="w-full">
                      {saving ? 'Adding…' : 'Add Student'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Roster Tabs (connected teachers only) */}
      {showRosterTabs && (
        <Tabs value={rosterTab} onValueChange={v => setRosterTab(v as RosterTab)}>
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="all" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all text-sm">
              All
              <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{clients.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="classrooms" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all text-sm">
              <Users className="h-3.5 w-3.5" />
              My Classrooms
              <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">
                {groupedRoster?.classrooms.reduce((n, cg) => n + cg.clients.length, 0) || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="shared" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all text-sm">
              <Share2 className="h-3.5 w-3.5" />
              Shared with Me
              <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">
                {groupedRoster?.sharedWithMe.length || 0}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Grade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {availableGrades.map(g => <SelectItem key={g} value={g!}>Grade {g}</SelectItem>)}
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
          <Button variant={viewAll ? 'default' : 'outline'} size="sm" className="gap-1.5 whitespace-nowrap h-8 text-xs" onClick={() => setViewAll(v => !v)}>
            {viewAll ? <Eye className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {viewAll ? 'Current Agency' : 'View All'}
          </Button>
        )}
      </div>

      {/* Classroom headers when on classrooms tab */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rosterTab === 'classrooms' && groupedRoster && groupedRoster.classrooms.length > 0 ? (
        <div className="space-y-6">
          {groupedRoster.classrooms.map(cg => {
            const cgFiltered = applyFilters(cg.clients);
            if (cgFiltered.length === 0 && hasActiveFilters) return null;
            return (
              <div key={cg.group.group_id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">{cg.group.name}</h4>
                  <Badge variant="secondary" className="text-[10px]">{cgFiltered.length} students</Badge>
                </div>
                {cgFiltered.length > 0 ? (
                  <StudentGrid clients={cgFiltered} onStudentClick={id => navigate(`/students/${id}`)} />
                ) : (
                  <p className="text-xs text-muted-foreground pl-6">No students in this classroom.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <User className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? 'No students match your filters' :
              rosterTab === 'shared' ? 'No students shared with you yet' :
              rosterTab === 'classrooms' ? 'No classroom assignments yet' : 'No students yet'}
          </p>
          {isSoloMode && !search && chipFilter === 'all' && (
            <Button variant="link" className="mt-2" onClick={() => setShowAdd(true)}>Add your first student</Button>
          )}
          {!isSoloMode && !isAdmin && (
            <Button variant="link" className="mt-2" onClick={() => navigate('/join')}>
              <KeyRound className="h-3.5 w-3.5 mr-1" /> Redeem an invite code
            </Button>
          )}
        </div>
      ) : (
        <StudentGrid clients={filtered} onStudentClick={id => navigate(`/students/${id}`)} />
      )}
    </div>
  );
};

// ── Sub-components ──

const StudentGrid = ({ clients, onStudentClick }: { clients: Client[]; onStudentClick: (id: string) => void }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {clients.map(client => (
      <StudentCard key={client.id} client={client} onClick={() => onStudentClick(client.id)} />
    ))}
  </div>
);

const StudentCard = ({ client, onClick }: { client: Client; onClick: () => void }) => (
  <Card className="cursor-pointer border-border/50 transition-all hover:shadow-md hover:border-primary/20" onClick={onClick}>
    <CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
        <span className="text-sm font-semibold">{displayInitials(client)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{displayName(client)}</p>
        <div className="flex items-center gap-2">
          {client.grade && <span className="text-xs text-muted-foreground">Grade {client.grade}</span>}
          {client.next_iep_review_date && (() => {
            const soon = new Date(client.next_iep_review_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            return soon ? (
              <Badge variant="outline" className="text-[10px] h-5 border-destructive/30 text-destructive">IEP Due</Badge>
            ) : null;
          })()}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default Students;
