import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Check, Link2, User, Users } from 'lucide-react';

// Admin access is now enforced server-side in the create_invite_code function

const SCOPE_OPTIONS = [
  { value: 'agency', label: 'Agency — join the entire organization' },
  { value: 'group', label: 'Classroom Group — access a specific classroom' },
  { value: 'student', label: 'Student — access a single student' },
] as const;

const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'para', label: 'Paraprofessional' },
  { value: 'bcba', label: 'BCBA' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'parent', label: 'Parent' },
] as const;

const APP_CONTEXT_OPTIONS = [
  { value: 'novateachers', label: 'NovaTeachers' },
  { value: 'novatrack_teacher', label: 'NovaTrack Teacher (Legacy)' },
  { value: 'teacher_hub', label: 'Teacher Hub (Legacy)' },
  { value: 'behavior_decoded_parent', label: 'Behavior Decoded (Parent)' },
] as const;

interface ClassroomOption {
  id: string;
  name: string;
}

const GenerateInvite = () => {
  const { currentWorkspace, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [scope, setScope] = useState<string>('agency');
  const [roleSlug, setRoleSlug] = useState('teacher');
  const [appContext, setAppContext] = useState('novateachers');
  const [maxUses, setMaxUses] = useState(10);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [groupId, setGroupId] = useState('');
  const [clientId, setClientId] = useState('');

  // Permissions
  const [canViewNotes, setCanViewNotes] = useState(true);
  const [canCollectData, setCanCollectData] = useState(true);
  const [canGenerateReports, setCanGenerateReports] = useState(false);

  // Single-person targeting
  const [inviteMode, setInviteMode] = useState<'generic' | 'individual'>('generic');
  const [targetEmail, setTargetEmail] = useState('');

  // Auto-assignment to classrooms
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState<Set<string>>(new Set());

  // Result
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Load classrooms for auto-assignment
  useEffect(() => {
    if (!currentWorkspace) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('classroom_groups')
          .select('id, name')
          .eq('agency_id', currentWorkspace.agency_id)
          .order('name');
        setClassrooms((data || []) as ClassroomOption[]);
      } catch {
        // table may not exist
      }
    })();
  }, [currentWorkspace]);

  const toggleClassroom = (id: string) => {
    setSelectedClassrooms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!currentWorkspace || !user) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const params: Record<string, any> = {
      p_agency_id: currentWorkspace.agency_id,
      p_invite_scope: scope,
      p_role_slug: roleSlug,
      p_app_context: appContext,
      p_max_uses: inviteMode === 'individual' ? 1 : maxUses,
      p_expires_at: expiresAt.toISOString(),
      p_created_by: user.id,
    };

    // Individual targeting
    if (inviteMode === 'individual' && targetEmail.trim()) {
      params.p_target_email = targetEmail.trim().toLowerCase();
    }

    // Scope-specific IDs
    if (scope === 'group' && groupId) {
      params.p_group_id = groupId;
    }
    if (scope === 'student' && clientId) {
      params.p_client_id = clientId;
      params.p_permissions = {
        can_view_notes: canViewNotes,
        can_collect_data: canCollectData,
        can_generate_reports: canGenerateReports,
      };
    }

    // Auto-assignment classrooms
    if (selectedClassrooms.size > 0) {
      params.p_auto_assign_groups = Array.from(selectedClassrooms);
    }

    setGenerating(true);
    try {
      const { data, error } = await (supabase.rpc as any)('create_invite_code', params);
      if (error) throw error;

      const code = typeof data === 'string' ? data : (data as any)?.code || JSON.stringify(data);
      setGeneratedCode(code);
      toast({ title: 'Invite code generated!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Role-based admin check (server-side enforced via create_invite_code function)
  if (!isAdmin) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Only agency admins can generate invite codes.</p>
        <Button variant="link" onClick={() => navigate('/students')}>Back to Students</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading">Generate Invite Code</h2>
          <p className="text-sm text-muted-foreground">Create a shareable code for teachers, staff, or parents</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-heading">Invite Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Invite Mode */}
            <div className="space-y-1.5">
              <Label>Invite Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={inviteMode === 'generic' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setInviteMode('generic')}
                >
                  <Users className="h-3.5 w-3.5" />
                  Generic Code
                </Button>
                <Button
                  type="button"
                  variant={inviteMode === 'individual' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setInviteMode('individual')}
                >
                  <User className="h-3.5 w-3.5" />
                  For Specific Person
                </Button>
              </div>
            </div>

            {/* Target email (individual) */}
            {inviteMode === 'individual' && (
              <div className="space-y-1.5">
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  value={targetEmail}
                  onChange={e => setTargetEmail(e.target.value)}
                  placeholder="teacher@school.edu"
                />
                <p className="text-[10px] text-muted-foreground">Only this person can redeem the code (max 1 use)</p>
              </div>
            )}

            {/* Scope */}
            <div className="space-y-1.5">
              <Label>Invite Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={roleSlug} onValueChange={setRoleSlug}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* App Context */}
            <div className="space-y-1.5">
              <Label>App Context</Label>
              <Select value={appContext} onValueChange={setAppContext}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APP_CONTEXT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group ID (for group scope) */}
            {scope === 'group' && (
              <div className="space-y-1.5">
                <Label>Group ID</Label>
                <Input
                  value={groupId}
                  onChange={e => setGroupId(e.target.value.trim())}
                  placeholder="UUID of the classroom group"
                  maxLength={36}
                />
                <p className="text-[10px] text-muted-foreground">Paste the classroom group ID from the Classrooms page</p>
              </div>
            )}

            {/* Client ID (for student scope) */}
            {scope === 'student' && (
              <div className="space-y-1.5">
                <Label>Student ID</Label>
                <Input
                  value={clientId}
                  onChange={e => setClientId(e.target.value.trim())}
                  placeholder="UUID of the student"
                  maxLength={36}
                />
              </div>
            )}

            {/* Usage limits (only for generic) */}
            {inviteMode === 'generic' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Max Uses</Label>
                  <Input
                    type="number"
                    value={maxUses}
                    onChange={e => setMaxUses(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={1000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expires In (days)</Label>
                  <Input
                    type="number"
                    value={expiresInDays}
                    onChange={e => setExpiresInDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={365}
                  />
                </div>
              </div>
            )}

            {inviteMode === 'individual' && (
              <div className="space-y-1.5">
                <Label>Expires In (days)</Label>
                <Input
                  type="number"
                  value={expiresInDays}
                  onChange={e => setExpiresInDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={365}
                />
              </div>
            )}

            {/* Permissions (student scope) */}
            {scope === 'student' && (
              <div className="space-y-3 rounded-lg border border-border/40 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Permissions</p>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal">View Notes</Label>
                  <Switch checked={canViewNotes} onCheckedChange={setCanViewNotes} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal">Collect Data</Label>
                  <Switch checked={canCollectData} onCheckedChange={setCanCollectData} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal">Generate Reports</Label>
                  <Switch checked={canGenerateReports} onCheckedChange={setCanGenerateReports} />
                </div>
              </div>
            )}

            {/* Auto-assign to classrooms */}
            {classrooms.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border/40 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Auto-Assign to Classrooms</p>
                <p className="text-[10px] text-muted-foreground">When the code is redeemed, the user will be assigned to these classroom groups.</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {classrooms.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`classroom-${c.id}`}
                        checked={selectedClassrooms.has(c.id)}
                        onCheckedChange={() => toggleClassroom(c.id)}
                      />
                      <label htmlFor={`classroom-${c.id}`} className="text-sm cursor-pointer">{c.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? 'Generating…' : 'Generate Code'}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-heading">Generated Code</CardTitle>
            <CardDescription>Share this code with the person you want to invite</CardDescription>
          </CardHeader>
          <CardContent>
            {generatedCode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <Link2 className="h-5 w-5 text-primary shrink-0" />
                  <code className="flex-1 text-lg font-mono font-semibold text-primary break-all">
                    {generatedCode}
                  </code>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{scope}</Badge>
                  <Badge variant="secondary">{roleSlug}</Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    {inviteMode === 'individual' ? '1 use' : `${maxUses} use${maxUses > 1 ? 's' : ''}`} · {expiresInDays}d
                  </Badge>
                  {inviteMode === 'individual' && targetEmail && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {targetEmail}
                    </Badge>
                  )}
                  {selectedClassrooms.size > 0 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {selectedClassrooms.size} classroom{selectedClassrooms.size > 1 ? 's' : ''} auto-assigned
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setGeneratedCode('');
                    setCopied(false);
                  }}
                >
                  Generate Another
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Link2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Configure settings and generate a code</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GenerateInvite;
