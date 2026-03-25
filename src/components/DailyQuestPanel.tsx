/**
 * DailyQuestPanel — Shows active quests with progress bars.
 * Used on classroom page, student portal, and game board side panel.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scroll, Plus, CheckCircle, Target, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface DailyQuest {
  id: string;
  title: string;
  description: string | null;
  quest_type: string;
  target_value: number;
  reward_bonus: number;
  active_date: string;
  is_active: boolean;
}

export interface QuestProgress {
  quest_id: string;
  student_id: string;
  current_value: number;
  completed: boolean;
  bonus_awarded: boolean;
}

const QUEST_TYPES = [
  { value: 'points_total', label: 'Points Earned', emoji: '⭐', desc: 'Earn a total number of points' },
  { value: 'replacement_points', label: 'Replacement Behavior', emoji: '🎯', desc: 'Earn points from replacement behaviors' },
  { value: 'token_completion', label: 'Token Board Complete', emoji: '🏆', desc: 'Complete a token board' },
  { value: 'checkpoint_reached', label: 'Checkpoint Reached', emoji: '🚩', desc: 'Reach a checkpoint on the track' },
];

// Teacher quest creation
interface CreateQuestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  agencyId: string;
  onCreated?: () => void;
}

export function CreateQuestDialog({ open, onOpenChange, groupId, agencyId, onCreated }: CreateQuestProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questType, setQuestType] = useState('points_total');
  const [targetValue, setTargetValue] = useState(10);
  const [rewardBonus, setRewardBonus] = useState(5);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await cloudSupabase.from('daily_quests').insert({
      agency_id: agencyId,
      group_id: groupId,
      title: title.trim(),
      description: description.trim() || null,
      quest_type: questType,
      target_value: targetValue,
      reward_bonus: rewardBonus,
      active_date: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Error creating quest', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🎯 Quest created!' });
      setTitle(''); setDescription(''); setTargetValue(10); setRewardBonus(5);
      onOpenChange(false);
      onCreated?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Scroll className="h-5 w-5 text-primary" /> New Daily Quest
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quest title…" className="h-9" maxLength={60} />
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className="h-9" maxLength={120} />
          <Select value={questType} onValueChange={setQuestType}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUEST_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-sm">
                  {t.emoji} {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Target</label>
              <Input type="number" value={targetValue} onChange={e => setTargetValue(Number(e.target.value))} className="h-9" min={1} max={1000} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Bonus Reward</label>
              <Input type="number" value={rewardBonus} onChange={e => setRewardBonus(Number(e.target.value))} className="h-9" min={0} max={100} />
            </div>
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? 'Creating…' : 'Create Quest'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Quest display panel
interface QuestPanelProps {
  groupId: string;
  agencyId: string;
  studentId?: string; // if viewing as student
  showCreateButton?: boolean;
  compact?: boolean;
}

export function DailyQuestPanel({ groupId, agencyId, studentId, showCreateButton = false, compact = false }: QuestPanelProps) {
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const loadQuests = useCallback(async () => {
    const { data } = await cloudSupabase
      .from('daily_quests')
      .select('*')
      .eq('group_id', groupId)
      .eq('active_date', today)
      .eq('is_active', true)
      .order('created_at');
    setQuests((data || []) as DailyQuest[]);

    if (studentId && data && data.length > 0) {
      const questIds = (data as any[]).map(q => q.id);
      const { data: progData } = await cloudSupabase
        .from('daily_quest_progress')
        .select('*')
        .eq('student_id', studentId)
        .in('quest_id', questIds);
      setProgress((progData || []) as QuestProgress[]);
    }
  }, [groupId, studentId, today]);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  // Realtime quest progress updates
  useEffect(() => {
    if (!studentId) return;
    const channel = cloudSupabase
      .channel(`quest-progress-${studentId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'daily_quest_progress',
      }, () => { loadQuests(); })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [studentId, loadQuests]);

  if (quests.length === 0 && !showCreateButton) return null;

  const getQuestTypeConfig = (type: string) =>
    QUEST_TYPES.find(t => t.value === type) || QUEST_TYPES[0];

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <div className="flex items-center justify-between">
        <h3 className={cn('font-bold flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
          <Scroll className={cn('text-primary', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          Daily Quests
        </h3>
        {showCreateButton && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3" /> Add Quest
          </Button>
        )}
      </div>

      {quests.length === 0 && (
        <Card className="border-dashed border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">No quests today. Create one to motivate your class!</p>
          </CardContent>
        </Card>
      )}

      {quests.map(quest => {
        const typeConfig = getQuestTypeConfig(quest.quest_type);
        const prog = progress.find(p => p.quest_id === quest.id);
        const currentVal = prog?.current_value || 0;
        const pct = Math.min(100, Math.round((currentVal / quest.target_value) * 100));
        const isCompleted = prog?.completed || false;

        return (
          <Card key={quest.id} className={cn(
            'border-border/40 transition-all',
            isCompleted && 'border-accent/40 bg-accent/5',
          )}>
            <CardContent className={cn('p-3', compact && 'p-2.5')}>
              <div className="flex items-start gap-2.5">
                <span className={cn('shrink-0', compact ? 'text-lg' : 'text-xl')}>
                  {isCompleted ? '✅' : typeConfig.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('font-semibold truncate', compact ? 'text-xs' : 'text-sm')}>{quest.title}</p>
                    {isCompleted && (
                      <Badge className="text-[8px] bg-accent/20 text-accent-foreground gap-0.5 py-0">
                        <CheckCircle className="h-2 w-2" /> Done!
                      </Badge>
                    )}
                  </div>
                  {quest.description && !compact && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{quest.description}</p>
                  )}
                  <div className="mt-1.5">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className={cn(compact ? 'h-1.5' : 'h-2', 'flex-1')} />
                      <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                        {currentVal}/{quest.target_value}
                      </span>
                    </div>
                  </div>
                  {quest.reward_bonus > 0 && !isCompleted && (
                    <p className="text-[9px] text-primary font-medium mt-1 flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5" /> +{quest.reward_bonus} bonus on completion
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {showCreateButton && (
        <CreateQuestDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          groupId={groupId}
          agencyId={agencyId}
          onCreated={loadQuests}
        />
      )}
    </div>
  );
}
