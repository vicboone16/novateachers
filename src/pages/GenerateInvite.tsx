import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Check, Link2 } from 'lucide-react';
import { z } from 'zod';

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
  { value: 'novatrack_teacher', label: 'NovaTrack Teacher' },
  { value: 'behavior_decoded_parent', label: 'Behavior Decoded (Parent)' },
] as const;

const formSchema = z.object({
  invite_scope: z.enum(['agency', 'group', 'student']),
  role_slug: z.string().min(1),
  app_context: z.string().min(1),
  max_uses: z.number().int().min(1).max(1000),
  expires_in_days: z.number().int().min(1).max(365),
  // Optional IDs
  group_id: z.string().uuid().optional().or(z.literal('')),
  client_id: z.string().uuid().optional().or(z.literal('')),
  // Permissions (for student scope)
  can_view_notes: z.boolean(),
  can_collect_data: z.boolean(),
  can_generate_reports: z.boolean(),
});

const GenerateInvite = () => {
  const { currentWorkspace, isAdmin } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [scope, setScope] = useState<string>('agency');
  const [roleSlug, setRoleSlug] = useState('teacher');
  const [appContext, setAppContext] = useState('novatrack_teacher');
  const [maxUses, setMaxUses] = useState(10);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [groupId, setGroupId] = useState('');
  const [clientId, setClientId] = useState('');
  const [canViewNotes, setCanViewNotes] = useState(true);
  const [canCollectData, setCanCollectData] = useState(true);
  const [canGenerateReports, setCanGenerateReports] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!currentWorkspace || !user) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const params: Record<string, any> = {
      p_agency_id: currentWorkspace.agency_id,
      p_invite_scope: scope,
      p_role_slug: roleSlug,
      p_app_context: appContext,
      p_max_uses: maxUses,
      p_expires_at: expiresAt.toISOString(),
      p_created_by: user.id,
    };

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

    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('create_invite_code', params);
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

            {/* Usage limits */}
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
                    {maxUses} use{maxUses > 1 ? 's' : ''} · {expiresInDays}d
                  </Badge>
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
