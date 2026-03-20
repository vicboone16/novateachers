import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import type { TeacherTarget } from '@/lib/types';

interface Props {
  clientId?: string;
  agencyId?: string;
  targets: TeacherTarget[];
  onRefresh: () => void;
  readOnly: boolean;
}

const TARGET_TYPES = [
  { value: 'skill', label: 'Skill' },
  { value: 'behavior', label: 'Behavior' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'manual', label: 'Manual' },
] as const;

const SOURCE_TABLES = [
  { value: 'teacher_data_events', label: 'Data Event' },
  { value: 'teacher_frequency_entries', label: 'Frequency' },
  { value: 'teacher_duration_entries', label: 'Duration' },
  { value: 'abc_logs', label: 'ABC Log' },
  { value: 'manual', label: 'Manual' },
] as const;

export const TargetManager = ({ clientId, agencyId, targets, onRefresh, readOnly }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<string>('behavior');
  const [sourceTable, setSourceTable] = useState<string>('teacher_frequency_entries');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id;

  const handleAdd = async () => {
    if (!name.trim() || !effectiveAgencyId || !user) return;
    setSaving(true);

    const { error } = await supabase.from('teacher_targets').insert({
      agency_id: effectiveAgencyId,
      client_id: clientId || null,
      name: name.trim(),
      target_type: targetType,
      source_table: sourceTable,
      created_by: user.id,
    } as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Target added' });
      setName('');
      onRefresh();
    }
    setSaving(false);
  };

  const handleEdit = async (target: TeacherTarget) => {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from('teacher_targets')
      .update({ name: editName.trim() } as any)
      .eq('id', target.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Target updated' });
      setEditingId(null);
      onRefresh();
    }
  };

  const handleToggleActive = async (target: TeacherTarget) => {
    const { error } = await supabase
      .from('teacher_targets')
      .update({ active: !(target.active ?? true) } as any)
      .eq('id', target.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: target.active === false ? 'Target activated' : 'Target deactivated' });
      onRefresh();
    }
  };

  const handleDelete = async (targetId: string) => {
    const { error } = await supabase
      .from('teacher_targets')
      .delete()
      .eq('id', targetId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Target deleted' });
      setDeletingId(null);
      onRefresh();
    }
  };

  const typeColor = (t: string) => {
    switch (t) {
      case 'behavior': return 'destructive';
      case 'skill': return 'default';
      case 'replacement': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Targets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No targets defined yet.</p>
        ) : (
          <div className="space-y-1.5">
            {targets.map(t => (
              <div key={t.id} className="flex items-center gap-2 group">
                {editingId === t.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleEdit(t)}
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(t)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : deletingId === t.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-destructive">Delete "{t.name}"?</span>
                    <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={() => handleDelete(t.id)}>Yes</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setDeletingId(null)}>No</Button>
                  </div>
                ) : (
                  <>
                    {t.icon && <span className="text-sm">{t.icon}</span>}
                    <Badge variant={typeColor(t.target_type)} className={t.active === false ? 'opacity-50 line-through' : ''}>
                      {t.name}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">{t.target_type}</Badge>
                    {t.source_table && t.source_table !== 'manual' && (
                      <Badge variant="outline" className="text-[9px]">{t.source_table.replace('teacher_', '').replace('_entries', '')}</Badge>
                    )}
                    {!readOnly && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingId(t.id); setEditName(t.name); }}>
                          <Pencil className="h-2.5 w-2.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleToggleActive(t)}>
                          {t.active === false ? <Check className="h-2.5 w-2.5 text-green-500" /> : <X className="h-2.5 w-2.5 text-muted-foreground" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => setDeletingId(t.id)}>
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!readOnly && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. On-task behavior" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map(tt => (
                      <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Select value={sourceTable} onValueChange={setSourceTable}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TABLES.map(st => (
                      <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving || !name.trim()} size="sm" className="gap-1">
              <Plus className="h-3 w-3" />
              {saving ? 'Adding…' : 'Add Target'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
