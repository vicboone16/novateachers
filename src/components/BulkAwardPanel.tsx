/**
 * BulkAwardPanel — Award points to ALL students in a classroom at once.
 * Also includes class point goal editor.
 */
import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { writePointEntry } from '@/lib/beacon-points';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Users, Star, Target, Loader2, Pencil, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkAwardPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  groupId: string;
  staffId: string;
  studentIds: string[];
  /** Current class goal settings */
  classGoal: { target: number; label: string };
  onClassGoalChange: (goal: { target: number; label: string }) => void;
  onPointsAwarded: (totalPerStudent: number) => void;
}

const BULK_PRESETS = [
  { points: 1, label: '+1 each', emoji: '⭐' },
  { points: 2, label: '+2 each', emoji: '🌟' },
  { points: 5, label: '+5 each', emoji: '✨' },
  { points: 10, label: '+10 each', emoji: '🎉' },
];

export function BulkAwardPanel({
  open, onOpenChange, agencyId, groupId, staffId,
  studentIds, classGoal, onClassGoalChange, onPointsAwarded,
}: BulkAwardPanelProps) {
  const { toast } = useToast();
  const [awarding, setAwarding] = useState(false);
  const [customPoints, setCustomPoints] = useState('');
  const [reason, setReason] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(classGoal.target));
  const [goalLabelDraft, setGoalLabelDraft] = useState(classGoal.label);
  const [savingGoal, setSavingGoal] = useState(false);

  const handleBulkAward = async (points: number) => {
    if (studentIds.length === 0 || !staffId) return;
    setAwarding(true);
    try {
      const promises = studentIds.map(studentId =>
        writePointEntry({
          studentId, staffId, agencyId,
          points,
          reason: reason || `Class award +${points}`,
          source: 'manual_award',
          entryKind: 'manual',
        })
      );
      await Promise.all(promises);
      onPointsAwarded(points);
      toast({ title: `⭐ +${points} awarded to ${studentIds.length} students!` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error awarding points', description: err.message, variant: 'destructive' });
    } finally {
      setAwarding(false);
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    const newTarget = Math.max(1, parseInt(goalDraft) || 100);
    const newLabel = goalLabelDraft.trim() || 'Class Goal';
    try {
      await cloudSupabase
        .from('classroom_settings')
        .upsert({
          group_id: groupId,
          agency_id: agencyId,
          point_goal: newTarget,
          point_goal_label: newLabel,
        }, { onConflict: 'group_id' });
      onClassGoalChange({ target: newTarget, label: newLabel });
      setEditingGoal(false);
      toast({ title: '✓ Class goal updated' });
    } catch (err: any) {
      toast({ title: 'Error saving goal', description: err.message, variant: 'destructive' });
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
        <SheetHeader className="pb-3">
          <SheetTitle className="font-heading text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Class Award & Goal
          </SheetTitle>
        </SheetHeader>

        {/* Bulk award */}
        <div className="space-y-3">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Award points to all {studentIds.length} students
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {BULK_PRESETS.map(preset => (
              <button
                key={preset.points}
                onClick={() => handleBulkAward(preset.points)}
                disabled={awarding}
                className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card p-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-95 transition-all"
              >
                <span className="text-lg">{preset.emoji}</span>
                <span className="text-[10px] font-bold text-foreground">{preset.label}</span>
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Custom amount</Label>
              <Input
                type="number"
                min={1}
                value={customPoints}
                onChange={e => setCustomPoints(e.target.value)}
                placeholder="Points…"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Reason (optional)</Label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Great lineup!"
                className="h-9 text-sm"
              />
            </div>
            <Button
              onClick={() => handleBulkAward(parseInt(customPoints) || 1)}
              disabled={awarding || !customPoints}
              className="h-9 gap-1.5"
            >
              {awarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
              Award
            </Button>
          </div>
        </div>

        {/* Class Goal Editor */}
        <div className="space-y-2 pt-4 mt-4 border-t border-border/40">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Class Point Goal
            </Label>
            {!editingGoal && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={() => {
                setGoalDraft(String(classGoal.target));
                setGoalLabelDraft(classGoal.label);
                setEditingGoal(true);
              }}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
          </div>

          {editingGoal ? (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-[10px] text-muted-foreground">Goal label</Label>
                <Input value={goalLabelDraft} onChange={e => setGoalLabelDraft(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="w-24">
                <Label className="text-[10px] text-muted-foreground">Target pts</Label>
                <Input type="number" min={1} value={goalDraft} onChange={e => setGoalDraft(e.target.value)} className="h-8 text-xs" />
              </div>
              <Button size="sm" onClick={saveGoal} disabled={savingGoal} className="h-8 gap-1">
                {savingGoal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <Target className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">{classGoal.label}</p>
                <p className="text-[10px] text-muted-foreground">{classGoal.target} points target</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
