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
import { Plus } from 'lucide-react';
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
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<'behavior' | 'skill'>('behavior');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !currentWorkspace || !user) return;
    setSaving(true);

    const { error } = await supabase.from('teacher_targets').insert({
      agency_id: currentWorkspace.agency_id,
      client_id: clientId,
      name: name.trim(),
      description: description.trim() || null,
      target_type: targetType,
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Target added' });
      setName('');
      setDescription('');
      onRefresh();
    }
    setSaving(false);
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
          <div className="flex flex-wrap gap-1.5">
            {targets.map(t => (
              <Badge key={t.id} variant={t.target_type === 'behavior' ? 'destructive' : 'secondary'}>
                {t.name}
              </Badge>
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
