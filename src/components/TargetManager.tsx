import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import type { TeacherTarget } from '@/lib/types';

interface Props {
  clientId: string;
  targets: TeacherTarget[];
  onRefresh: () => void;
  readOnly: boolean;
}

export const TargetManager = ({ clientId, targets, onRefresh, readOnly }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<'behavior' | 'skill'>('behavior');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim() || !currentWorkspace || !user) return;
    setSaving(true);

    const { error } = await supabase.from('teacher_targets').insert({
      agency_id: currentWorkspace.agency_id,
      client_id: clientId,
      name: name.trim(),
      target_type: targetType,
      created_by: user.id,
    });

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
      .update({ name: editName.trim() })
      .eq('id', target.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Target updated' });
      setEditingId(null);
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
                    <Badge variant={t.target_type === 'behavior' ? 'destructive' : 'secondary'}>
                      {t.name}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">{t.target_type}</Badge>
                    {!readOnly && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingId(t.id); setEditName(t.name); }}>
                          <Pencil className="h-2.5 w-2.5" />
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
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. On-task behavior" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={targetType} onValueChange={v => setTargetType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behavior">Behavior</SelectItem>
                    <SelectItem value="skill">Skill</SelectItem>
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
