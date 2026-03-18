/**
 * ReinforcerStore — Reward catalog and point redemption UI.
 * Reads rewards from Core (beacon_rewards), writes redemptions to Core (beacon_reward_redemptions),
 * and deducts points from Cloud (beacon_points_ledger).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { writePointEntry } from '@/lib/beacon-points';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Gift, Star, Plus, ShoppingBag, Sparkles, Check, AlertCircle, Package, Trophy, Loader2,
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
}

export function ReinforcerStore({ agencyId, classroomId, students, onRedemption }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('10');
  const [newCategory, setNewCategory] = useState('privilege');
  const [newEmoji, setNewEmoji] = useState('🎁');
  const [newDescription, setNewDescription] = useState('');

  const loadRewards = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('beacon_rewards' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('point_cost', { ascending: true });
      setRewards((data || []) as any as Reward[]);
    } catch { /* silent */ }
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  const createReward = async () => {
    if (!newName.trim() || !user) return;
    try {
      const { error } = await supabase
        .from('beacon_rewards' as any)
        .insert({
          agency_id: agencyId,
          classroom_id: classroomId || null,
          name: newName.trim(),
          description: newDescription.trim() || null,
          point_cost: parseInt(newCost) || 10,
          category: newCategory,
          emoji: newEmoji || '🎁',
          created_by: user.id,
        });
      if (error) throw error;
      setCreateOpen(false);
      setNewName('');
      setNewCost('10');
      setNewDescription('');
      loadRewards();
      toast({ title: 'Reward added to store' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const startRedeem = (reward: Reward) => {
    setSelectedReward(reward);
    setSelectedStudentId('');
    setRedeemOpen(true);
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
      // 1) Record redemption on Core
      const { error: redeemErr } = await supabase
        .from('beacon_reward_redemptions' as any)
        .insert({
          student_id: selectedStudentId,
          reward_id: selectedReward.id,
          agency_id: agencyId,
          points_spent: selectedReward.point_cost,
          redeemed_by: user.id,
        });
      if (redeemErr) throw redeemErr;

      // 2) Deduct points on Cloud ledger
      await writePointEntry({
        studentId: selectedStudentId,
        staffId: user.id,
        agencyId,
        points: -selectedReward.point_cost,
        reason: `Redeemed: ${selectedReward.name}`,
        source: 'reward_redeem',
      });

      // 3) Decrease stock if limited
      if (selectedReward.stock !== null) {
        await supabase
          .from('beacon_rewards' as any)
          .update({ stock: Math.max(0, selectedReward.stock - 1) })
          .eq('id', selectedReward.id);
      }

      toast({
        title: '🎉 Reward redeemed!',
        description: `${student.name} exchanged ${selectedReward.point_cost} pts for ${selectedReward.name}`,
      });
      setRedeemOpen(false);
      loadRewards();
      onRedemption?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRedeeming(false);
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const canAfford = selectedStudent && selectedReward
    ? selectedStudent.balance >= selectedReward.point_cost
    : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-heading flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          Reward Store
        </h3>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Reward
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rewards.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-8 text-center">
            <Gift className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No rewards yet. Add some!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map(reward => {
            const catConfig = CATEGORIES.find(c => c.value === reward.category);
            const outOfStock = reward.stock !== null && reward.stock <= 0;
            return (
              <Card
                key={reward.id}
                className={cn(
                  'transition-all cursor-pointer hover:shadow-md border-border/40',
                  outOfStock && 'opacity-50'
                )}
                onClick={() => !outOfStock && startRedeem(reward)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{reward.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{reward.name}</p>
                      {reward.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{reward.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className="gap-1 text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                          {reward.point_cost}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {catConfig?.emoji} {catConfig?.label}
                        </Badge>
                        {reward.stock !== null && (
                          <Badge variant="outline" className={cn("text-[9px]", outOfStock && "text-destructive border-destructive/30")}>
                            <Package className="h-2 w-2 mr-0.5" />
                            {outOfStock ? 'Out' : `${reward.stock} left`}
                          </Badge>
                        )}
                      </div>
                    </div>
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
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Add Reward
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Extra Recess" />
              </div>
              <div className="space-y-1 w-16">
                <Label className="text-xs">Emoji</Label>
                <Input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} className="text-center text-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Point Cost</Label>
                <Input type="number" value={newCost} onChange={e => setNewCost(e.target.value)} min="1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Short description…" />
            </div>
            <Button onClick={createReward} disabled={!newName.trim()} className="w-full gap-1.5">
              <Plus className="h-4 w-4" /> Add to Store
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Redeem Reward
            </DialogTitle>
          </DialogHeader>
          {selectedReward && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span className="text-3xl">{selectedReward.emoji}</span>
                <div>
                  <p className="font-semibold">{selectedReward.name}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    {selectedReward.point_cost} points
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="Choose a student…" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          <Badge variant="outline" className="text-[9px] gap-0.5">
                            <Star className="h-2 w-2 fill-amber-500 text-amber-500" />
                            {s.balance}
                          </Badge>
                          {s.balance < selectedReward.point_cost && (
                            <AlertCircle className="h-3 w-3 text-destructive" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStudent && (
                <div className="rounded-lg border border-border/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Balance</span>
                    <span className="font-bold">{selectedStudent.balance} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reward Cost</span>
                    <span className="font-bold text-destructive">−{selectedReward.point_cost} pts</span>
                  </div>
                  <div className="border-t border-border/40 pt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className={cn("font-bold", canAfford ? "text-accent" : "text-destructive")}>
                      {selectedStudent.balance - selectedReward.point_cost} pts
                    </span>
                  </div>
                  {!canAfford && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Not enough points
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={handleRedeem}
                disabled={!canAfford || redeeming || !selectedStudentId}
                className="w-full gap-1.5"
              >
                {redeeming ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Redeeming…</>
                ) : (
                  <><Check className="h-4 w-4" /> Redeem for {selectedStudent?.name || 'Student'}</>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
