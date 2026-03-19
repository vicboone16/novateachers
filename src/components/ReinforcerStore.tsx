/**
 * ReinforcerStore — Reward catalog with full CRUD + redemption.
 * States: Locked (can't afford), Available (can afford), Redeemed (history).
 * Reads rewards from Core (beacon_rewards), writes redemptions to Core (beacon_reward_redemptions),
 * and deducts points from Cloud (beacon_points_ledger).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { writePointEntry } from '@/lib/beacon-points';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Gift, Star, Plus, ShoppingBag, Check, AlertCircle, Package, Trophy, Loader2, Pencil, Power, Lock, CheckCircle, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Reward {
  id: string;
  name: string;
  description: string | null;
  point_cost: number;
  category: string;
  emoji: string;
  stock: number | null;
  is_active: boolean;
}

interface StudentOption {
  id: string;
  name: string;
  balance: number;
}

interface Redemption {
  id: string;
  student_id: string;
  reward_id: string;
  points_spent: number;
  created_at: string;
}

const CATEGORIES = [
  { value: 'privilege', label: 'Privilege', emoji: '🌟' },
  { value: 'tangible', label: 'Tangible', emoji: '🎁' },
  { value: 'activity', label: 'Activity', emoji: '🎮' },
  { value: 'social', label: 'Social', emoji: '🤝' },
];

interface Props {
  agencyId: string;
  classroomId?: string;
  students: StudentOption[];
  onRedemption?: () => void;
  showInactive?: boolean;
}

export function ReinforcerStore({ agencyId, classroomId, students, onRedemption, showInactive }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Create/Edit form
  const [formName, setFormName] = useState('');
  const [formCost, setFormCost] = useState('10');
  const [formCategory, setFormCategory] = useState('privilege');
  const [formEmoji, setFormEmoji] = useState('🎁');
  const [formDescription, setFormDescription] = useState('');

  const loadRewards = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('beacon_rewards' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .order('point_cost', { ascending: true });
      if (!showInactive) q = q.eq('is_active', true);
      const { data } = await q;
      setRewards((data || []) as any as Reward[]);

      // Load recent redemptions
      const { data: redeemData } = await supabase
        .from('beacon_reward_redemptions' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(30);
      setRedemptions((redeemData || []) as any as Redemption[]);
    } catch { /* silent */ }
    setLoading(false);
  }, [agencyId, showInactive]);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  const resetForm = () => {
    setFormName(''); setFormCost('10'); setFormCategory('privilege'); setFormEmoji('🎁'); setFormDescription('');
  };

  const createReward = async () => {
    if (!formName.trim() || !user) return;
    try {
      const { error } = await supabase.from('beacon_rewards' as any).insert({
        agency_id: agencyId, classroom_id: classroomId || null,
        name: formName.trim(), description: formDescription.trim() || null,
        point_cost: parseInt(formCost) || 10, category: formCategory,
        emoji: formEmoji || '🎁', created_by: user.id,
      });
      if (error) throw error;
      setCreateOpen(false); resetForm(); loadRewards();
      toast({ title: 'Reward added to store' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const openEdit = (reward: Reward) => {
    setSelectedReward(reward);
    setFormName(reward.name); setFormCost(String(reward.point_cost));
    setFormCategory(reward.category); setFormEmoji(reward.emoji);
    setFormDescription(reward.description || ''); setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedReward || !formName.trim()) return;
    try {
      const { error } = await supabase.from('beacon_rewards' as any).update({
        name: formName.trim(), description: formDescription.trim() || null,
        point_cost: parseInt(formCost) || 10, category: formCategory, emoji: formEmoji || '🎁',
      }).eq('id', selectedReward.id);
      if (error) throw error;
      setEditOpen(false); resetForm(); loadRewards();
      toast({ title: 'Reward updated' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const toggleActive = async (reward: Reward) => {
    try {
      await supabase.from('beacon_rewards' as any).update({ is_active: !reward.is_active }).eq('id', reward.id);
      loadRewards();
      toast({ title: reward.is_active ? 'Reward deactivated' : 'Reward activated' });
    } catch { /* silent */ }
  };

  const startRedeem = (reward: Reward) => {
    setSelectedReward(reward); setSelectedStudentId(''); setRedeemSuccess(false); setRedeemOpen(true);
  };

  const handleRedeem = async () => {
    if (!selectedReward || !selectedStudentId || !user) return;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;
    if (student.balance < selectedReward.point_cost) {
      toast({ title: 'Insufficient points', description: `${student.name} needs ${selectedReward.point_cost - student.balance} more points.`, variant: 'destructive' });
      return;
    }
    setRedeeming(true);
    try {
      const { error: redeemErr } = await supabase.from('beacon_reward_redemptions' as any).insert({
        student_id: selectedStudentId, reward_id: selectedReward.id, agency_id: agencyId,
        points_spent: selectedReward.point_cost, redeemed_by: user.id,
      });
      if (redeemErr) throw redeemErr;
      await writePointEntry({
        studentId: selectedStudentId, staffId: user.id, agencyId,
        points: -selectedReward.point_cost, reason: `Redeemed: ${selectedReward.name}`, source: 'reward_redeem',
      });
      if (selectedReward.stock !== null) {
        await supabase.from('beacon_rewards' as any).update({ stock: Math.max(0, selectedReward.stock - 1) }).eq('id', selectedReward.id);
      }
      setRedeemSuccess(true);
      toast({ title: '🎉 Reward redeemed!', description: `${student.name} exchanged ${selectedReward.point_cost} pts for ${selectedReward.name}` });
      loadRewards();
      onRedemption?.();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setRedeeming(false); }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const canAfford = selectedStudent && selectedReward ? selectedStudent.balance >= selectedReward.point_cost : false;

  // Best student (closest to affording) for each reward
  const getBestStudent = (reward: Reward) => {
    if (students.length === 0) return null;
    return students.reduce((best, s) => (Math.abs(reward.point_cost - s.balance) < Math.abs(reward.point_cost - best.balance) ? s : best));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-heading flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" /> Reward Store
        </h3>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Reward
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : rewards.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-8 text-center">
            <Gift className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No rewards yet. Add some!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map(reward => {
            const catConfig = CATEGORIES.find(c => c.value === reward.category);
            const outOfStock = reward.stock !== null && reward.stock <= 0;
            const best = getBestStudent(reward);
            const pointsAway = best ? Math.max(0, reward.point_cost - best.balance) : reward.point_cost;
            const anyCanAfford = students.some(s => s.balance >= reward.point_cost);
            const redeemCount = redemptions.filter(r => r.reward_id === reward.id).length;

            // States: inactive, out of stock, available, locked
            const isLocked = !anyCanAfford && reward.is_active && !outOfStock;
            const isAvailable = anyCanAfford && reward.is_active && !outOfStock;

            return (
              <Card key={reward.id} className={cn(
                'transition-all border-border/40 overflow-hidden',
                !reward.is_active && 'opacity-40 border-dashed',
                outOfStock && 'opacity-50',
                isAvailable && 'border-accent/40 shadow-sm shadow-accent/10',
                isLocked && 'border-border/30',
              )}>
                {/* State indicator strip */}
                <div className={cn(
                  'h-1',
                  isAvailable && 'bg-accent',
                  isLocked && 'bg-muted-foreground/20',
                  !reward.is_active && 'bg-muted-foreground/10',
                  outOfStock && 'bg-destructive/30',
                )} />
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "text-3xl rounded-xl w-12 h-12 flex items-center justify-center shrink-0",
                      isAvailable ? "bg-accent/10" : "bg-muted/50"
                    )}>{reward.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm truncate">{reward.name}</p>
                        {isAvailable && <Badge className="text-[8px] bg-accent/20 text-accent-foreground border-accent/30 shrink-0 gap-0.5"><CheckCircle className="h-2 w-2" />Ready</Badge>}
                        {isLocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />}
                      </div>
                      {reward.description && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{reward.description}</p>}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge className="gap-0.5 text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {reward.point_cost}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">{catConfig?.emoji} {catConfig?.label}</Badge>
                        {reward.stock !== null && (
                          <Badge variant="outline" className={cn("text-[9px]", outOfStock && "text-destructive border-destructive/30")}>
                            <Package className="h-2 w-2 mr-0.5" /> {outOfStock ? 'Out' : `${reward.stock} left`}
                          </Badge>
                        )}
                        {redeemCount > 0 && (
                          <Badge variant="outline" className="text-[9px] gap-0.5"><History className="h-2 w-2" />{redeemCount} redeemed</Badge>
                        )}
                      </div>
                      {best && pointsAway > 0 && pointsAway <= reward.point_cost && (
                        <p className="text-[10px] text-primary font-medium mt-1.5">{best.name}: <strong>{pointsAway} pts away</strong></p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2.5">
                    <Button size="sm" variant={isAvailable ? "default" : "outline"} className={cn("flex-1 h-7 text-xs gap-1", isAvailable && "bg-accent hover:bg-accent/90 text-accent-foreground")} onClick={() => !outOfStock && reward.is_active && startRedeem(reward)} disabled={outOfStock || !reward.is_active}>
                      <Gift className="h-3 w-3" /> Redeem
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(reward)} title="Edit"><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className={cn("h-7 w-7 p-0", !reward.is_active && "text-muted-foreground")} onClick={() => toggleActive(reward)} title={reward.is_active ? 'Deactivate' : 'Activate'}><Power className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Reward Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Add Reward</DialogTitle></DialogHeader>
          <RewardForm name={formName} onNameChange={setFormName} cost={formCost} onCostChange={setFormCost} category={formCategory} onCategoryChange={setFormCategory} emoji={formEmoji} onEmojiChange={setFormEmoji} description={formDescription} onDescriptionChange={setFormDescription} onSubmit={createReward} submitLabel="Add to Store" disabled={!formName.trim()} />
        </DialogContent>
      </Dialog>

      {/* Edit Reward Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" /> Edit Reward</DialogTitle></DialogHeader>
          <RewardForm name={formName} onNameChange={setFormName} cost={formCost} onCostChange={setFormCost} category={formCategory} onCategoryChange={setFormCategory} emoji={formEmoji} onEmojiChange={setFormEmoji} description={formDescription} onDescriptionChange={setFormDescription} onSubmit={saveEdit} submitLabel="Save Changes" disabled={!formName.trim()} />
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={redeemOpen} onOpenChange={(o) => { setRedeemOpen(o); if (!o) setRedeemSuccess(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              {redeemSuccess ? <CheckCircle className="h-5 w-5 text-accent" /> : <Trophy className="h-5 w-5 text-amber-500" />}
              {redeemSuccess ? 'Redeemed!' : 'Redeem Reward'}
            </DialogTitle>
          </DialogHeader>
          {selectedReward && !redeemSuccess && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span className="text-3xl">{selectedReward.emoji}</span>
                <div>
                  <p className="font-semibold">{selectedReward.name}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {selectedReward.point_cost} points
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="Choose a student…" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => {
                      const away = Math.max(0, selectedReward.point_cost - s.balance);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            <Badge variant="outline" className="text-[9px] gap-0.5"><Star className="h-2 w-2 fill-amber-500 text-amber-500" />{s.balance}</Badge>
                            {away > 0 && <span className="text-[9px] text-muted-foreground">{away} away</span>}
                            {s.balance < selectedReward.point_cost && <AlertCircle className="h-3 w-3 text-destructive" />}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {selectedStudent && (
                <div className="rounded-lg border border-border/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Balance</span>
                    <span className="font-bold text-lg">{selectedStudent.balance} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reward Cost</span>
                    <span className="font-bold text-destructive">−{selectedReward.point_cost} pts</span>
                  </div>
                  <div className="border-t border-border/40 pt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className={cn("font-bold text-lg", canAfford ? "text-accent" : "text-destructive")}>
                      {selectedStudent.balance - selectedReward.point_cost} pts
                    </span>
                  </div>
                  {!canAfford && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Not enough points ({selectedReward.point_cost - selectedStudent.balance} more needed)
                    </p>
                  )}
                </div>
              )}
              <Button onClick={handleRedeem} disabled={!canAfford || redeeming || !selectedStudentId} className="w-full gap-1.5">
                {redeeming ? <><Loader2 className="h-4 w-4 animate-spin" /> Redeeming…</> : <><Check className="h-4 w-4" /> Redeem for {selectedStudent?.name || 'Student'}</>}
              </Button>
            </div>
          )}
          {selectedReward && redeemSuccess && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-5xl">{selectedReward.emoji}</span>
              </div>
              <div>
                <p className="text-lg font-bold">🎉 {selectedStudent?.name} got {selectedReward.name}!</p>
                <p className="text-sm text-muted-foreground mt-1">−{selectedReward.point_cost} points deducted</p>
              </div>
              <Button onClick={() => { setRedeemOpen(false); setRedeemSuccess(false); }} variant="outline" className="w-full">Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Shared form for create/edit */
function RewardForm({ name, onNameChange, cost, onCostChange, category, onCategoryChange, emoji, onEmojiChange, description, onDescriptionChange, onSubmit, submitLabel, disabled }: {
  name: string; onNameChange: (v: string) => void; cost: string; onCostChange: (v: string) => void;
  category: string; onCategoryChange: (v: string) => void; emoji: string; onEmojiChange: (v: string) => void;
  description: string; onDescriptionChange: (v: string) => void; onSubmit: () => void; submitLabel: string; disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="space-y-1 flex-1"><Label className="text-xs">Name</Label><Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="e.g. Extra Recess" /></div>
        <div className="space-y-1 w-16"><Label className="text-xs">Emoji</Label><Input value={emoji} onChange={e => onEmojiChange(e.target.value)} className="text-center text-lg" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Point Cost</Label><Input type="number" value={cost} onChange={e => onCostChange(e.target.value)} min="1" /></div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Description (optional)</Label><Input value={description} onChange={e => onDescriptionChange(e.target.value)} placeholder="Short description…" /></div>
      <Button onClick={onSubmit} disabled={disabled} className="w-full gap-1.5">{submitLabel}</Button>
    </div>
  );
}
