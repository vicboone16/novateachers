/**
 * ReinforcerStore — Reward catalog with full CRUD + redemption.
 * States: Locked (can't afford), Available (can afford), Redeemed (history).
 * Reads rewards from Core (beacon_rewards), writes redemptions to Core (beacon_reward_redemptions),
 * and deducts points from Cloud (beacon_points_ledger).
 *
 * Core schema:
 *   beacon_rewards: id, scope_type, scope_id, name, description, cost, image_url, active, time_sensitive_until, stock_count, created_at
 *   beacon_reward_redemptions: id, student_id, reward_id, staff_id, points_spent, status, redeemed_at, agency_id
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/lib/cloud-functions';
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
  cost: number;
  category: string;
  emoji: string;
  stock_count: number | null;
  active: boolean;
  // mapped from Core schema
  scope_type?: string;
  scope_id?: string;
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
  redeemed_at: string;
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
      // Use core-bridge to read rewards (bypasses Core RLS)
      const result = await invokeCloudFunction<{ rewards: any[] }>('core-bridge', {
        action: 'list_rewards',
        scope_type: 'agency',
        scope_id: agencyId,
        include_inactive: !!showInactive,
      });
      setRewards((result?.rewards || []) as any as Reward[]);

      // Load redemptions via core-bridge
      const redeemResult = await invokeCloudFunction<{ redemptions: any[] }>('core-bridge', {
        action: 'list_redemptions',
        agency_id: agencyId,
      });
      setRedemptions((redeemResult?.redemptions || []) as any as Redemption[]);
    } catch (err: any) {
      console.warn('[ReinforcerStore] loadRewards exception:', err.message);
      // Fallback: try direct read (may work for SELECT even if INSERT is blocked)
      try {
        const { data } = await supabase
          .from('beacon_rewards' as any)
          .select('*')
          .eq('scope_type', 'agency')
          .eq('scope_id', agencyId)
          .order('cost', { ascending: true });
        setRewards((data || []) as any as Reward[]);
      } catch { setRewards([]); }
    }
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
        scope_type: 'agency',
        scope_id: agencyId,
        name: formName.trim(),
        description: formDescription.trim() || null,
        cost: parseInt(formCost) || 10,
        active: true,
      });
      if (error) throw error;
      setCreateOpen(false); resetForm(); loadRewards();
      toast({ title: 'Reward added to store' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const openEdit = (reward: Reward) => {
    setSelectedReward(reward);
    setFormName(reward.name); setFormCost(String(reward.cost));
    setFormCategory(reward.category || 'privilege'); setFormEmoji(reward.emoji || '🎁');
    setFormDescription(reward.description || ''); setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedReward || !formName.trim()) return;
    try {
      const { error } = await supabase.from('beacon_rewards' as any).update({
        name: formName.trim(), description: formDescription.trim() || null,
        cost: parseInt(formCost) || 10,
      }).eq('id', selectedReward.id);
      if (error) throw error;
      setEditOpen(false); resetForm(); loadRewards();
      toast({ title: 'Reward updated' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const toggleActive = async (reward: Reward) => {
    try {
      await supabase.from('beacon_rewards' as any).update({ active: !reward.active }).eq('id', reward.id);
      loadRewards();
      toast({ title: reward.active ? 'Reward deactivated' : 'Reward activated' });
    } catch { /* silent */ }
  };

  const startRedeem = (reward: Reward) => {
    setSelectedReward(reward); setSelectedStudentId(''); setRedeemSuccess(false); setRedeemOpen(true);
  };

  const handleRedeem = async () => {
    if (!selectedReward || !selectedStudentId || !user) return;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;
    if (student.balance < selectedReward.cost) {
      toast({ title: 'Insufficient points', description: `${student.name} needs ${selectedReward.cost - student.balance} more points.`, variant: 'destructive' });
      return;
    }
    setRedeeming(true);
    try {
      const { error: redeemErr } = await supabase.from('beacon_reward_redemptions' as any).insert({
        student_id: selectedStudentId,
        reward_id: selectedReward.id,
        agency_id: agencyId,
        staff_id: user.id,
        points_spent: selectedReward.cost,
        status: 'completed',
      });
      if (redeemErr) throw redeemErr;
      await writePointEntry({
        studentId: selectedStudentId, staffId: user.id, agencyId,
        points: -selectedReward.cost, reason: `Redeemed: ${selectedReward.name}`, source: 'reward_redeem',
      });
      if (selectedReward.stock_count !== null) {
        await supabase.from('beacon_rewards' as any).update({ stock_count: Math.max(0, selectedReward.stock_count - 1) }).eq('id', selectedReward.id);
      }
      setRedeemSuccess(true);
      toast({ title: '🎉 Reward redeemed!', description: `${student.name} exchanged ${selectedReward.cost} pts for ${selectedReward.name}` });
      loadRewards();
      onRedemption?.();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setRedeeming(false); }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const canAfford = selectedStudent && selectedReward ? selectedStudent.balance >= selectedReward.cost : false;

  const getBestStudent = (reward: Reward) => {
    if (students.length === 0) return null;
    return students.reduce((best, s) => (Math.abs(reward.cost - s.balance) < Math.abs(reward.cost - best.balance) ? s : best));
  };

  // Derive emoji from name or use default
  const getRewardEmoji = (r: Reward) => r.emoji || '🎁';

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
            const catConfig = CATEGORIES.find(c => c.value === (reward.category || 'tangible'));
            const outOfStock = reward.stock_count !== null && reward.stock_count <= 0;
            const best = getBestStudent(reward);
            const pointsAway = best ? Math.max(0, reward.cost - best.balance) : reward.cost;
            const anyCanAfford = students.some(s => s.balance >= reward.cost);
            const redeemCount = redemptions.filter(r => r.reward_id === reward.id).length;

            const isLocked = !anyCanAfford && reward.active && !outOfStock;
            const isAvailable = anyCanAfford && reward.active && !outOfStock;

            return (
              <Card key={reward.id} className={cn(
                'transition-all border-border/40 overflow-hidden',
                !reward.active && 'opacity-40 border-dashed',
                outOfStock && 'opacity-50',
                isAvailable && 'border-accent/40 shadow-sm shadow-accent/10',
                isLocked && 'border-border/30',
              )}>
                <div className={cn(
                  'h-1',
                  isAvailable && 'bg-accent',
                  isLocked && 'bg-muted-foreground/20',
                  !reward.active && 'bg-muted-foreground/10',
                  outOfStock && 'bg-destructive/30',
                )} />
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "text-3xl rounded-xl w-12 h-12 flex items-center justify-center shrink-0",
                      isAvailable ? "bg-accent/10" : "bg-muted/50"
                    )}>{getRewardEmoji(reward)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm truncate">{reward.name}</p>
                        {isAvailable && <Badge className="text-[8px] bg-accent/20 text-accent-foreground border-accent/30 shrink-0 gap-0.5"><CheckCircle className="h-2 w-2" />Ready</Badge>}
                        {isLocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />}
                      </div>
                      {reward.description && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{reward.description}</p>}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge className="gap-0.5 text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {reward.cost}
                        </Badge>
                        {catConfig && <Badge variant="outline" className="text-[9px]">{catConfig.emoji} {catConfig.label}</Badge>}
                        {reward.stock_count !== null && (
                          <Badge variant="outline" className={cn("text-[9px]", outOfStock && "text-destructive border-destructive/30")}>
                            <Package className="h-2 w-2 mr-0.5" /> {outOfStock ? 'Out' : `${reward.stock_count} left`}
                          </Badge>
                        )}
                        {redeemCount > 0 && (
                          <Badge variant="outline" className="text-[9px] gap-0.5"><History className="h-2 w-2" />{redeemCount} redeemed</Badge>
                        )}
                      </div>
                      {best && pointsAway > 0 && pointsAway <= reward.cost && (
                        <p className="text-[10px] text-primary font-medium mt-1.5">{best.name}: <strong>{pointsAway} pts away</strong></p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2.5">
                    <Button size="sm" variant={isAvailable ? "default" : "outline"} className={cn("flex-1 h-7 text-xs gap-1", isAvailable && "bg-accent hover:bg-accent/90 text-accent-foreground")} onClick={() => !outOfStock && reward.active && startRedeem(reward)} disabled={outOfStock || !reward.active}>
                      <Gift className="h-3 w-3" /> Redeem
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(reward)} title="Edit"><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className={cn("h-7 w-7 p-0", !reward.active && "text-muted-foreground")} onClick={() => toggleActive(reward)} title={reward.active ? 'Deactivate' : 'Activate'}><Power className="h-3 w-3" /></Button>
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
                <span className="text-3xl">{getRewardEmoji(selectedReward)}</span>
                <div>
                  <p className="font-semibold">{selectedReward.name}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {selectedReward.cost} points
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="Choose a student…" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => {
                      const away = Math.max(0, selectedReward.cost - s.balance);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            <Badge variant="outline" className="text-[9px] gap-0.5"><Star className="h-2 w-2 fill-amber-500 text-amber-500" />{s.balance}</Badge>
                            {away > 0 && <span className="text-[9px] text-muted-foreground">{away} away</span>}
                            {s.balance < selectedReward.cost && <AlertCircle className="h-3 w-3 text-destructive" />}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {selectedStudent && (
                <div className="rounded-lg border border-border/40 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current balance</span>
                    <span className="font-semibold">{selectedStudent.balance} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-semibold text-destructive">−{selectedReward.cost} pts</span>
                  </div>
                  <Progress value={canAfford ? 100 : (selectedStudent.balance / selectedReward.cost) * 100} className="h-1.5" />
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">After</span>
                    <span className={cn("font-bold", canAfford ? "text-accent" : "text-destructive")}>
                      {canAfford ? selectedStudent.balance - selectedReward.cost : selectedStudent.balance - selectedReward.cost} pts
                    </span>
                  </div>
                </div>
              )}
              <Button onClick={handleRedeem} disabled={!canAfford || redeeming} className="w-full gap-1.5">
                {redeeming ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><Gift className="h-4 w-4" /> Redeem for {selectedStudent?.name || 'Student'}</>}
              </Button>
              {selectedStudent && !canAfford && (
                <p className="text-xs text-destructive text-center flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Not enough points ({selectedReward.cost - selectedStudent.balance} more needed)
                </p>
              )}
            </div>
          )}
          {redeemSuccess && selectedReward && (
            <div className="text-center py-4 space-y-3">
              <div className="text-5xl animate-bounce">{getRewardEmoji(selectedReward)}</div>
              <p className="font-semibold text-lg">{selectedReward.name}</p>
              <p className="text-sm text-muted-foreground">Successfully redeemed!</p>
              <Button variant="outline" onClick={() => { setRedeemOpen(false); setRedeemSuccess(false); }}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Reward Form ── */
function RewardForm({ name, onNameChange, cost, onCostChange, category, onCategoryChange, emoji, onEmojiChange, description, onDescriptionChange, onSubmit, submitLabel, disabled }: {
  name: string; onNameChange: (v: string) => void;
  cost: string; onCostChange: (v: string) => void;
  category: string; onCategoryChange: (v: string) => void;
  emoji: string; onEmojiChange: (v: string) => void;
  description: string; onDescriptionChange: (v: string) => void;
  onSubmit: () => void; submitLabel: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Extra Computer Time" /></div>
        <div className="space-y-1"><Label className="text-xs">Emoji</Label><Input value={emoji} onChange={e => onEmojiChange(e.target.value)} className="text-center text-lg" maxLength={4} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Point Cost</Label><Input type="number" value={cost} onChange={e => onCostChange(e.target.value)} min={1} /></div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Description (optional)</Label><Input value={description} onChange={e => onDescriptionChange(e.target.value)} placeholder="Short description…" /></div>
      <Button onClick={onSubmit} disabled={disabled} className="w-full">{submitLabel}</Button>
    </div>
  );
}
