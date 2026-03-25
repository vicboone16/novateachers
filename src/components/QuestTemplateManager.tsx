/**
 * QuestTemplateManager — Teacher UI for creating and managing quest templates.
 * Supports daily, weekly, challenge, and social quest types.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Scroll, Trash2, Star, Target, Flame, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestTemplate {
  id: string;
  title: string;
  description: string | null;
  quest_type: string;
  quest_category: string;
  target_value: number;
  reward_points: number;
  is_active: boolean;
  group_id: string | null;
}

interface Props {
  agencyId: string;
  groupId?: string;
}

export function QuestTemplateManager({ agencyId, groupId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', quest_type: 'daily', quest_category: 'points', target_value: 10, reward_points: 5 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [agencyId, groupId]);

  const loadTemplates = async () => {
    let query = cloudSupabase.from('classroom_quest_templates').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false });
    if (groupId) query = query.or(`group_id.eq.${groupId},group_id.is.null`);
    const { data } = await query;
    setTemplates((data || []) as any[]);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const { error } = await cloudSupabase.from('classroom_quest_templates').insert({
        agency_id: agencyId,
        group_id: groupId || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        quest_type: form.quest_type,
        quest_category: form.quest_category,
        target_value: form.target_value,
        reward_points: form.reward_points,
        created_by: user?.id || null,
      });
      if (error) throw error;
      toast({ title: '✓ Quest template created' });
      setShowCreate(false);
      setForm({ title: '', description: '', quest_type: 'daily', quest_category: 'points', target_value: 10, reward_points: 5 });
      loadTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await cloudSupabase.from('classroom_quest_templates').update({ is_active: !active }).eq('id', id);
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    await cloudSupabase.from('classroom_quest_templates').delete().eq('id', id);
    loadTemplates();
    toast({ title: 'Template removed' });
  };

  const TYPE_ICONS: Record<string, any> = { daily: Star, weekly: Target, challenge: Flame, social: Users };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2"><Scroll className="h-4 w-4 text-primary" /> Quest Templates</h3>
        <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setShowCreate(true)}>
          <Plus className="h-3 w-3" /> New Quest
        </Button>
      </div>

      {templates.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-4 text-center">No quest templates yet. Create one to get started.</p>
      )}

      {templates.map(t => {
        const Icon = TYPE_ICONS[t.quest_type] || Star;
        return (
          <Card key={t.id} className={cn('border-border/40', !t.is_active && 'opacity-50')}>
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-[10px] text-muted-foreground">{t.quest_type} · {t.quest_category} · {t.target_value} target · +{t.reward_points} pts</p>
              </div>
              <Switch checked={t.is_active} onCheckedChange={() => handleToggle(t.id, t.is_active)} />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Quest Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Earn 20 points today" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details…" className="min-h-[60px]" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.quest_type} onValueChange={v => setForm(f => ({ ...f, quest_type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="challenge">Challenge</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.quest_category} onValueChange={v => setForm(f => ({ ...f, quest_category: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="checkpoint">Checkpoint</SelectItem>
                    <SelectItem value="streak">Streak</SelectItem>
                    <SelectItem value="token_complete">Token Complete</SelectItem>
                    <SelectItem value="no_deductions">No Deductions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Target Value</Label><Input type="number" value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: Number(e.target.value) }))} min={1} /></div>
              <div><Label className="text-xs">Reward Points</Label><Input type="number" value={form.reward_points} onChange={e => setForm(f => ({ ...f, reward_points: Number(e.target.value) }))} min={0} /></div>
            </div>
            <Button onClick={handleCreate} disabled={saving || !form.title.trim()} className="w-full">{saving ? 'Creating…' : 'Create Quest'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
