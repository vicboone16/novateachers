import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Save, X, Clock, AlertTriangle } from 'lucide-react';
import type { Client } from '@/lib/types';

interface Props {
  client: Client;
  onRefresh: () => void;
}

const EDITABLE_FIELDS: { key: keyof Client; label: string }[] = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'grade', label: 'Grade' },
  { key: 'school_name', label: 'School' },
  { key: 'district_name', label: 'District' },
  { key: 'primary_setting', label: 'Primary Setting' },
];

const StudentInfoEditor = ({ client, onRefresh }: Props) => {
  const { user } = useAuth();
  const { isSoloMode, currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  const isCoreOwned = client.student_origin !== 'solo_teacher';

  const startEditing = () => {
    const initial: Record<string, string> = {};
    EDITABLE_FIELDS.forEach(f => {
      initial[f.key] = (client[f.key] as string) || '';
    });
    setDraft(initial);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft({});
  };

  const handleSave = async () => {
    if (!user || !currentWorkspace) return;
    setSaving(true);

    // Find changed fields
    const changes: Record<string, { old: string | null; new: string }> = {};
    EDITABLE_FIELDS.forEach(f => {
      const oldVal = (client[f.key] as string) || '';
      const newVal = draft[f.key] || '';
      if (oldVal !== newVal) {
        changes[f.key] = { old: oldVal || null, new: newVal };
      }
    });

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      if (isCoreOwned) {
        // Submit as pending change for supervisor approval
        const { error } = await supabase.from('pending_student_changes').insert({
          agency_id: currentWorkspace.agency_id,
          client_id: client.id,
          requested_by: user.id,
          change_type: 'update',
          field_changes: changes,
          status: 'pending',
        });
        if (error) throw error;
        setPendingChanges(Object.fromEntries(
          Object.entries(changes).map(([k, v]) => [k, v.new])
        ));
        toast({
          title: 'Change submitted for review',
          description: 'Your supervisor will be notified to approve these changes.',
        });
      } else {
        // Solo-owned student — save directly
        const updates: Record<string, string> = {};
        Object.entries(changes).forEach(([k, v]) => {
          updates[k] = v.new;
        });
        let result = await supabase.from('clients').update(updates).eq('id', client.id);
        if (result.error) {
          result = await supabase.from('students').update(updates).eq('id', client.id);
        }
        if (result.error) throw result.error;
        toast({ title: 'Student updated' });
        onRefresh();
      }
      setEditing(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Student Information</CardTitle>
        <div className="flex items-center gap-2">
          {isCoreOwned && !editing && (
            <Badge variant="outline" className="text-[10px] gap-1 bg-muted/50">
              <AlertTriangle className="h-3 w-3" />
              Core-managed
            </Badge>
          )}
          {!editing ? (
            <Button size="sm" variant="outline" onClick={startEditing} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : isCoreOwned ? 'Submit for Review' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isCoreOwned && editing && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning flex items-start gap-2">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              This student is managed by NovaTrack Core. Your edits will be submitted as a
              pending change and require supervisor approval before taking effect.
            </span>
          </div>
        )}

        {Object.keys(pendingChanges).length > 0 && !editing && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary flex items-start gap-2">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Pending changes submitted: {Object.keys(pendingChanges).join(', ')}. Awaiting supervisor approval.
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EDITABLE_FIELDS.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {f.label}
              </Label>
              {editing ? (
                <Input
                  value={draft[f.key] || ''}
                  onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {(client[f.key] as string) || '—'}
                </p>
              )}
            </div>
          ))}
          {!editing && client.date_of_birth && (
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Date of Birth
              </Label>
              <p className="text-sm font-medium text-foreground">
                {new Date(client.date_of_birth).toLocaleDateString()}
              </p>
            </div>
          )}
          {!editing && client.funding_mode && (
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Funding Mode
              </Label>
              <p className="text-sm font-medium text-foreground">{client.funding_mode}</p>
            </div>
          )}
        </div>

        {!editing && Array.isArray(client.diagnoses) && client.diagnoses.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border/40">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Diagnoses</p>
            <div className="flex flex-wrap gap-1.5">
              {client.diagnoses.map((d, i) => (
                <Badge key={i} variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                  {d}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentInfoEditor;
