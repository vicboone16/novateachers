/**
 * ReinforcerStore — Dynamic reward economy with demand pricing, inventory, and premium UI.
 * Reads rewards from Cloud (beacon_rewards), writes redemptions via redeem_reward_dynamic RPC.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Gift, Star, Plus, ShoppingBag, Check, AlertCircle, Package, Trophy, Loader2,
  Pencil, Power, Lock, CheckCircle, History, Flame, TrendingDown, Zap, Tag,
  EyeOff, Eye, Archive, ArchiveRestore, Trash2, Building2, School,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Reward {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  base_cost: number | null;
  category: string;
  emoji: string;
  stock_count: number | null;
  active: boolean;
  reward_type: string;
  dynamic_pricing_enabled: boolean;
  min_cost: number | null;
  max_cost: number | null;
  current_dynamic_price: number | null;
  inventory_enabled: boolean;
  sort_order: number;
  metadata_json: Record<string, any> | null;
  redemption_count_24h: number;
  scope_type?: string;
  scope_id?: string;
  hidden?: boolean;
  archived?: boolean;
  deleted_at?: string | null;
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

const REWARD_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'class', label: 'Class-wide' },
];

type VisibilityFilter = 'active' | 'hidden' | 'archived' | 'all';

interface Props {
  agencyId: string;
  classroomId?: string;
  students: StudentOption[];
  onRedemption?: () => void;
  showInactive?: boolean;
  /** When true, shows admin management UI (hide/archive/delete). Default false for student views. */
  adminMode?: boolean;
}

export function ReinforcerStore({ agencyId, classroomId, students, onRedemption, showInactive, adminMode = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<any>(null);
  const [visFilter, setVisFilter] = useState<VisibilityFilter>('active');

  // Create/Edit form
  const [formName, setFormName] = useState('');
  const [formCost, setFormCost] = useState('10');
  const [formCategory, setFormCategory] = useState('privilege');
  const [formEmoji, setFormEmoji] = useState('🎁');
  const [formDescription, setFormDescription] = useState('');
  const [formRewardType, setFormRewardType] = useState('individual');
  const [formDynamic, setFormDynamic] = useState(false);
  const [formMinCost, setFormMinCost] = useState('');
  const [formMaxCost, setFormMaxCost] = useState('');
  const [formInventory, setFormInventory] = useState(false);
  const [formStock, setFormStock] = useState('');

  // Scoped loading: show agency-wide + classroom-specific rewards
  const scopeType = classroomId ? 'classroom' : 'agency';
  const scopeId = classroomId || agencyId;

  const loadRewards = useCallback(async () => {
    setLoading(true);
    try {
      // Use appropriate view: admin sees all (excl soft-deleted), students see only visible
      const table = (adminMode || showInactive) ? 'v_beacon_rewards_admin' : 'v_beacon_rewards_by_classroom';
      let q = cloudSupabase
        .from(table as any)
        .select('*')
        .order('sort_order', { ascending: true });

      if (classroomId) {
        q = q.or(`and(scope_type.eq.agency,scope_id.eq.${agencyId}),and(scope_type.eq.classroom,scope_id.eq.${classroomId})`);
      } else {
        q = q.eq('scope_type', 'agency').eq('scope_id', agencyId);
      }

      const { data } = await q;
      setRewards((data || []) as any as Reward[]);

      const { data: redeemData } = await cloudSupabase
        .from('beacon_reward_redemptions')
        .select('*')
        .eq('agency_id', agencyId);
      setRedemptions((redeemData || []) as any as Redemption[]);
    } catch (err: any) {
      console.warn('[ReinforcerStore] loadRewards error:', err.message);
      setRewards([]);
    }
    setLoading(false);
  }, [agencyId, classroomId, showInactive, adminMode]);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  const getEffectivePrice = (r: Reward): number => {
    if (r.dynamic_pricing_enabled && r.current_dynamic_price != null) return r.current_dynamic_price;
    return r.cost;
  };

  const getPriceModifier = (r: Reward): 'hot' | 'sale' | 'scarce' | null => {
    if (!r.dynamic_pricing_enabled) return null;
    const base = r.base_cost || r.cost;
    const current = getEffectivePrice(r);
    if (current > base * 1.1) return 'hot';
    if (current < base * 0.9) return 'sale';
    if (r.inventory_enabled && r.stock_count != null && r.stock_count > 0 && r.stock_count <= 3) return 'scarce';
    return null;
  };

  const resetForm = () => {
    setFormName(''); setFormCost('10'); setFormCategory('privilege'); setFormEmoji('🎁');
    setFormDescription(''); setFormRewardType('individual'); setFormDynamic(false);
    setFormMinCost(''); setFormMaxCost(''); setFormInventory(false); setFormStock('');
  };

  const createReward = async () => {
    if (!formName.trim() || !user) return;
    try {
      const baseCost = parseInt(formCost) || 10;
      const { error } = await cloudSupabase.from('beacon_rewards').insert({
        scope_type: scopeType,
        scope_id: scopeId,
        agency_id: agencyId,
        name: formName.trim(),
        description: formDescription.trim() || null,
        cost: baseCost,
        base_cost: baseCost,
        category: formCategory,
        emoji: formEmoji,
        created_by: user.id,
        reward_type: formRewardType,
        dynamic_pricing_enabled: formDynamic,
        min_cost: formMinCost ? parseInt(formMinCost) : null,
        max_cost: formMaxCost ? parseInt(formMaxCost) : null,
        inventory_enabled: formInventory,
        stock_count: formInventory && formStock ? parseInt(formStock) : null,
        metadata_json: formInventory && formStock ? { initial_stock: parseInt(formStock) } : {},
      } as any);
      if (error) throw error;
      setCreateOpen(false); resetForm(); loadRewards();
      toast({ title: 'Reward added to store' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const openEdit = (reward: Reward) => {
    setSelectedReward(reward);
    setFormName(reward.name); setFormCost(String(reward.base_cost || reward.cost));
    setFormCategory(reward.category || 'privilege'); setFormEmoji(reward.emoji || '🎁');
    setFormDescription(reward.description || '');
    setFormRewardType(reward.reward_type || 'individual');
    setFormDynamic(reward.dynamic_pricing_enabled);
    setFormMinCost(reward.min_cost != null ? String(reward.min_cost) : '');
    setFormMaxCost(reward.max_cost != null ? String(reward.max_cost) : '');
    setFormInventory(reward.inventory_enabled);
    setFormStock(reward.stock_count != null ? String(reward.stock_count) : '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedReward || !formName.trim()) return;
    try {
      const baseCost = parseInt(formCost) || 10;
      const { error } = await cloudSupabase.from('beacon_rewards').update({
        name: formName.trim(),
        description: formDescription.trim() || null,
        cost: baseCost,
        base_cost: baseCost,
        category: formCategory,
        emoji: formEmoji,
        reward_type: formRewardType,
        dynamic_pricing_enabled: formDynamic,
        min_cost: formMinCost ? parseInt(formMinCost) : null,
        max_cost: formMaxCost ? parseInt(formMaxCost) : null,
        inventory_enabled: formInventory,
        stock_count: formInventory && formStock ? parseInt(formStock) : null,
        updated_at: new Date().toISOString(),
      } as any).eq('id', selectedReward.id);
      if (error) throw error;
      setEditOpen(false); resetForm(); loadRewards();
      toast({ title: 'Reward updated' });
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const toggleActive = async (reward: Reward) => {
    try {
      const { error } = await cloudSupabase.from('beacon_rewards')
        .update({ active: !reward.active, updated_at: new Date().toISOString() } as any)
        .eq('id', reward.id);
      if (error) throw error;
      loadRewards();
      toast({ title: reward.active ? 'Reward deactivated' : 'Reward activated' });
    } catch { /* silent */ }
  };

  const toggleHidden = async (reward: Reward) => {
    try {
      await cloudSupabase.from('beacon_rewards')
        .update({ hidden: !reward.hidden, updated_at: new Date().toISOString() } as any)
        .eq('id', reward.id);
      loadRewards();
      toast({ title: reward.hidden ? 'Reward visible to students' : 'Reward hidden from students' });
    } catch { /* silent */ }
  };

  const toggleArchived = async (reward: Reward) => {
    try {
      await cloudSupabase.from('beacon_rewards')
        .update({ archived: !reward.archived, active: reward.archived ? true : false, updated_at: new Date().toISOString() } as any)
        .eq('id', reward.id);
      loadRewards();
      toast({ title: reward.archived ? 'Reward restored' : 'Reward archived' });
    } catch { /* silent */ }
  };

  const softDeleteReward = async (reward: Reward) => {
    try {
      await cloudSupabase.from('beacon_rewards')
        .update({ deleted_at: new Date().toISOString(), active: false, updated_at: new Date().toISOString() } as any)
        .eq('id', reward.id);
      loadRewards();
      toast({ title: 'Reward soft-deleted' });
    } catch { /* silent */ }
  };

  const hardDeleteReward = async (reward: Reward) => {
    // Check for redemption history first
    const { count } = await cloudSupabase.from('beacon_reward_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('reward_id', reward.id);
    if ((count || 0) > 0) {
      toast({ title: 'Cannot permanently delete', description: 'This reward has redemption history. Archiving instead.', variant: 'destructive' });
      await toggleArchived(reward);
      return;
    }
    if (!confirm(`Permanently delete "${reward.name}"? This cannot be undone.`)) return;
    try {
      await cloudSupabase.from('beacon_rewards').delete().eq('id', reward.id);
      loadRewards();
      toast({ title: 'Reward permanently deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const startRedeem = (reward: Reward) => {
    setSelectedReward(reward); setSelectedStudentId(''); setRedeemSuccess(false);
    setRedeemResult(null); setRedeemOpen(true);
  };

  const openDetail = (reward: Reward) => {
    setSelectedReward(reward); setDetailOpen(true);
  };

  const handleRedeem = async () => {
    if (!selectedReward || !selectedStudentId || !user) return;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const effectivePrice = getEffectivePrice(selectedReward);
    if (student.balance < effectivePrice) {
      toast({ title: 'Insufficient points', description: `${student.name} needs ${effectivePrice - student.balance} more points.`, variant: 'destructive' });
      return;
    }

    setRedeeming(true);
    try {
      const { data, error } = await (cloudSupabase.rpc as any)('redeem_reward_dynamic', {
        p_student_id: selectedStudentId,
        p_reward_id: selectedReward.id,
        p_staff_id: user.id,
        p_agency_id: agencyId,
      });
      if (error) throw error;
      if (data && !data.ok) throw new Error(data.error || 'Redemption failed');
      setRedeemResult(data);
      setRedeemSuccess(true);
      toast({ title: '🎉 Reward redeemed!', description: `${student.name} spent ${data?.final_price || effectivePrice} pts for ${selectedReward.name}` });
      loadRewards();
      onRedemption?.();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setRedeeming(false); }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedEffectivePrice = selectedReward ? getEffectivePrice(selectedReward) : 0;
  const canAfford = selectedStudent ? selectedStudent.balance >= selectedEffectivePrice : false;

  // Apply visibility filter
  const filteredRewards = rewards.filter(r => {
    if (visFilter === 'active') return r.active && !r.hidden && !r.archived;
    if (visFilter === 'hidden') return r.hidden;
    if (visFilter === 'archived') return r.archived;
    return true; // 'all'
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-bold font-heading flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" /> Reward Store
        </h3>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Reward
        </Button>
      </div>

      {/* Admin visibility filters */}
      {adminMode && (
        <div className="flex gap-1 flex-wrap">
          {(['active', 'hidden', 'archived', 'all'] as VisibilityFilter[]).map(f => (
            <Button key={f} size="sm" variant={visFilter === f ? 'default' : 'outline'} className="h-7 text-xs capitalize gap-1" onClick={() => setVisFilter(f)}>
              {f === 'hidden' && <EyeOff className="h-3 w-3" />}
              {f === 'archived' && <Archive className="h-3 w-3" />}
              {f} ({rewards.filter(r => {
                if (f === 'active') return r.active && !r.hidden && !r.archived;
                if (f === 'hidden') return r.hidden;
                if (f === 'archived') return r.archived;
                return true;
              }).length})
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : filteredRewards.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-8 text-center">
            <Gift className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{visFilter === 'active' ? 'No rewards yet. Add some!' : `No ${visFilter} rewards.`}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRewards.map(reward => {
            const effectivePrice = getEffectivePrice(reward);
            const basePrice = reward.base_cost || reward.cost;
            const modifier = getPriceModifier(reward);
            const outOfStock = reward.inventory_enabled && reward.stock_count !== null && reward.stock_count <= 0;
            const anyCanAfford = students.some(s => s.balance >= effectivePrice);
            const redeemCount = redemptions.filter(r => r.reward_id === reward.id).length;
            const isAvailable = anyCanAfford && reward.active && !outOfStock && !reward.hidden && !reward.archived;
            const isLocked = !anyCanAfford && reward.active && !outOfStock;
            const isAgencyWide = reward.scope_type === 'agency';

            const closestStudent = students.length > 0
              ? students.reduce((best, s) => (Math.abs(effectivePrice - s.balance) < Math.abs(effectivePrice - best.balance) ? s : best))
              : null;
            const pointsAway = closestStudent ? Math.max(0, effectivePrice - closestStudent.balance) : effectivePrice;

            return (
              <Card key={reward.id} className={cn(
                'transition-all border-border/40 overflow-hidden cursor-pointer hover:shadow-md',
                !reward.active && 'opacity-40 border-dashed',
                reward.hidden && 'opacity-50 border-dashed',
                reward.archived && 'opacity-40',
                outOfStock && 'opacity-50',
                isAvailable && 'border-accent/40 shadow-sm shadow-accent/10',
              )} onClick={() => openDetail(reward)}>
                {/* Top accent bar */}
                <div className={cn(
                  'h-1',
                  reward.archived && 'bg-muted-foreground/20',
                  reward.hidden && 'bg-muted-foreground/30',
                  !reward.archived && !reward.hidden && modifier === 'hot' && 'bg-destructive',
                  !reward.archived && !reward.hidden && modifier === 'sale' && 'bg-accent',
                  !reward.archived && !reward.hidden && !modifier && isAvailable && 'bg-accent',
                  !reward.archived && !reward.hidden && !modifier && isLocked && 'bg-muted-foreground/20',
                  !reward.active && !reward.archived && !reward.hidden && 'bg-muted-foreground/10',
                  outOfStock && !reward.archived && !reward.hidden && 'bg-destructive/30',
                )} />
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "text-3xl rounded-xl w-12 h-12 flex items-center justify-center shrink-0",
                      isAvailable ? "bg-accent/10" : "bg-muted/50"
                    )}>{reward.emoji || '🎁'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm truncate">{reward.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {reward.hidden && <Badge variant="outline" className="text-[8px] gap-0.5"><EyeOff className="h-2 w-2" />Hidden</Badge>}
                          {reward.archived && <Badge variant="outline" className="text-[8px] gap-0.5"><Archive className="h-2 w-2" />Archived</Badge>}
                          {!reward.hidden && !reward.archived && modifier === 'hot' && <Badge className="text-[8px] bg-destructive/20 text-destructive border-destructive/30 gap-0.5"><Flame className="h-2 w-2" />Hot</Badge>}
                          {!reward.hidden && !reward.archived && modifier === 'sale' && <Badge className="text-[8px] bg-accent/20 text-accent-foreground border-accent/30 gap-0.5"><TrendingDown className="h-2 w-2" />Sale</Badge>}
                          {!reward.hidden && !reward.archived && isAvailable && !modifier && <Badge className="text-[8px] bg-accent/20 text-accent-foreground border-accent/30 shrink-0 gap-0.5"><CheckCircle className="h-2 w-2" />Ready</Badge>}
                          {isLocked && !reward.hidden && !reward.archived && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </div>
                      {reward.description && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{reward.description}</p>}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge className="gap-0.5 text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Star className="h-2.5 w-2.5 fill-current" /> {effectivePrice}
                        </Badge>
                        {modifier && effectivePrice !== basePrice && (
                          <span className="text-[9px] text-muted-foreground line-through">{basePrice}</span>
                        )}
                        {/* Scope label */}
                        {adminMode && (
                          <Badge variant="outline" className="text-[8px] gap-0.5">
                            {isAgencyWide ? <><Building2 className="h-2 w-2" />Agency</> : <><School className="h-2 w-2" />Classroom</>}
                          </Badge>
                        )}
                        {reward.reward_type === 'class' && (
                          <Badge variant="outline" className="text-[9px] gap-0.5"><Zap className="h-2 w-2" />Class</Badge>
                        )}
                        {reward.inventory_enabled && reward.stock_count !== null && (
                          <Badge variant="outline" className={cn("text-[9px]", outOfStock && "text-destructive border-destructive/30")}>
                            <Package className="h-2 w-2 mr-0.5" /> {outOfStock ? 'Out' : `${reward.stock_count} left`}
                          </Badge>
                        )}
                        {redeemCount > 0 && (
                          <Badge variant="outline" className="text-[9px] gap-0.5"><History className="h-2 w-2" />{redeemCount}</Badge>
                        )}
                      </div>
                      {closestStudent && pointsAway > 0 && pointsAway <= effectivePrice && (
                        <p className="text-[10px] text-primary font-medium mt-1.5">{closestStudent.name}: <strong>{pointsAway} pts away</strong></p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2.5" onClick={e => e.stopPropagation()}>
                    {!reward.archived && (
                      <Button size="sm" variant={isAvailable ? "default" : "outline"} className={cn("flex-1 h-7 text-xs gap-1", isAvailable && "bg-accent hover:bg-accent/90 text-accent-foreground")} onClick={() => !outOfStock && reward.active && startRedeem(reward)} disabled={outOfStock || !reward.active || reward.hidden}>
                        <Gift className="h-3 w-3" /> Redeem
                      </Button>
                    )}
                    {reward.archived && (
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => toggleArchived(reward)}>
                        <ArchiveRestore className="h-3 w-3" /> Restore
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(reward)} title="Edit"><Pencil className="h-3 w-3" /></Button>
                    {adminMode && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleHidden(reward)} title={reward.hidden ? 'Unhide' : 'Hide'}>
                          {reward.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                        {!reward.archived && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleArchived(reward)} title="Archive">
                            <Archive className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => reward.archived ? hardDeleteReward(reward) : softDeleteReward(reward)} title={reward.archived ? 'Delete permanently' : 'Delete'}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {!adminMode && (
                      <Button size="sm" variant="ghost" className={cn("h-7 w-7 p-0", !reward.active && "text-muted-foreground")} onClick={() => toggleActive(reward)} title={reward.active ? 'Deactivate' : 'Activate'}><Power className="h-3 w-3" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Panel Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" /> Reward Details
            </DialogTitle>
          </DialogHeader>
          {selectedReward && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
                <span className="text-4xl">{selectedReward.emoji || '🎁'}</span>
                <div>
                  <p className="font-bold text-lg">{selectedReward.name}</p>
                  {selectedReward.description && <p className="text-xs text-muted-foreground">{selectedReward.description}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Price</span>
                  <span className="font-semibold">{selectedReward.base_cost || selectedReward.cost} ⭐</span>
                </div>
                {selectedReward.dynamic_pricing_enabled && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Price</span>
                      <span className={cn("font-bold", getPriceModifier(selectedReward) === 'sale' ? 'text-accent' : getPriceModifier(selectedReward) === 'hot' ? 'text-destructive' : '')}>
                        {getEffectivePrice(selectedReward)} ⭐
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price Status</span>
                      <Badge variant="outline" className="text-[9px]">
                        {getPriceModifier(selectedReward) === 'hot' && '🔥 High demand'}
                        {getPriceModifier(selectedReward) === 'sale' && '💚 Discounted'}
                        {getPriceModifier(selectedReward) === 'scarce' && '⚠️ Low stock premium'}
                        {!getPriceModifier(selectedReward) && '📊 Normal'}
                      </Badge>
                    </div>
                    {selectedReward.min_cost != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Min Price</span>
                        <span>{selectedReward.min_cost} ⭐</span>
                      </div>
                    )}
                    {selectedReward.max_cost != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Max Price</span>
                        <span>{selectedReward.max_cost} ⭐</span>
                      </div>
                    )}
                  </>
                )}
                {selectedReward.inventory_enabled && selectedReward.stock_count != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Inventory</span>
                    <span className={cn("font-semibold", selectedReward.stock_count <= 3 ? "text-amber-600" : "")}>
                      {selectedReward.stock_count} remaining
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{selectedReward.reward_type || 'individual'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recent Redemptions (24h)</span>
                  <span>{selectedReward.redemption_count_24h || 0}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 gap-1" onClick={() => { setDetailOpen(false); startRedeem(selectedReward); }} disabled={!selectedReward.active || (selectedReward.inventory_enabled && selectedReward.stock_count != null && selectedReward.stock_count <= 0)}>
                  <Gift className="h-4 w-4" /> Redeem
                </Button>
                <Button variant="outline" className="gap-1" onClick={() => { setDetailOpen(false); openEdit(selectedReward); }}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Reward Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Add Reward</DialogTitle></DialogHeader>
          <RewardForm
            name={formName} onNameChange={setFormName}
            cost={formCost} onCostChange={setFormCost}
            category={formCategory} onCategoryChange={setFormCategory}
            emoji={formEmoji} onEmojiChange={setFormEmoji}
            description={formDescription} onDescriptionChange={setFormDescription}
            rewardType={formRewardType} onRewardTypeChange={setFormRewardType}
            dynamicPricing={formDynamic} onDynamicPricingChange={setFormDynamic}
            minCost={formMinCost} onMinCostChange={setFormMinCost}
            maxCost={formMaxCost} onMaxCostChange={setFormMaxCost}
            inventoryEnabled={formInventory} onInventoryChange={setFormInventory}
            stock={formStock} onStockChange={setFormStock}
            onSubmit={createReward} submitLabel="Add to Store" disabled={!formName.trim()}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Reward Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" /> Edit Reward</DialogTitle></DialogHeader>
          <RewardForm
            name={formName} onNameChange={setFormName}
            cost={formCost} onCostChange={setFormCost}
            category={formCategory} onCategoryChange={setFormCategory}
            emoji={formEmoji} onEmojiChange={setFormEmoji}
            description={formDescription} onDescriptionChange={setFormDescription}
            rewardType={formRewardType} onRewardTypeChange={setFormRewardType}
            dynamicPricing={formDynamic} onDynamicPricingChange={setFormDynamic}
            minCost={formMinCost} onMinCostChange={setFormMinCost}
            maxCost={formMaxCost} onMaxCostChange={setFormMaxCost}
            inventoryEnabled={formInventory} onInventoryChange={setFormInventory}
            stock={formStock} onStockChange={setFormStock}
            onSubmit={saveEdit} submitLabel="Save Changes" disabled={!formName.trim()}
          />
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={redeemOpen} onOpenChange={(o) => { setRedeemOpen(o); if (!o) { setRedeemSuccess(false); setRedeemResult(null); } }}>
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
                <span className="text-3xl">{selectedReward.emoji || '🎁'}</span>
                <div>
                  <p className="font-semibold">{selectedReward.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    <span className="font-bold text-foreground">{selectedEffectivePrice}</span> points
                    {selectedEffectivePrice !== (selectedReward.base_cost || selectedReward.cost) && (
                      <span className="line-through text-[10px]">{selectedReward.base_cost || selectedReward.cost}</span>
                    )}
                    {getPriceModifier(selectedReward) === 'sale' && <Badge className="text-[8px] bg-accent/20 text-accent-foreground">Sale</Badge>}
                    {getPriceModifier(selectedReward) === 'hot' && <Badge className="text-[8px] bg-destructive/20 text-destructive">Hot</Badge>}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="Choose a student…" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => {
                      const away = Math.max(0, selectedEffectivePrice - s.balance);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            <Badge variant="outline" className="text-[9px] gap-0.5"><Star className="h-2 w-2 fill-amber-500 text-amber-500" />{s.balance}</Badge>
                            {away > 0 && <span className="text-[9px] text-muted-foreground">{away} away</span>}
                            {s.balance < selectedEffectivePrice && <AlertCircle className="h-3 w-3 text-destructive" />}
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
                    <span className="font-semibold text-destructive">−{selectedEffectivePrice} pts</span>
                  </div>
                  <Progress value={canAfford ? 100 : (selectedStudent.balance / selectedEffectivePrice) * 100} className="h-1.5" />
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">After</span>
                    <span className={cn("font-bold", canAfford ? "text-accent" : "text-destructive")}>
                      {selectedStudent.balance - selectedEffectivePrice} pts
                    </span>
                  </div>
                </div>
              )}
              <Button onClick={handleRedeem} disabled={!canAfford || redeeming} className="w-full gap-1.5">
                {redeeming ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><Gift className="h-4 w-4" /> Redeem for {selectedStudent?.name || 'Student'}</>}
              </Button>
              {selectedStudent && !canAfford && (
                <p className="text-xs text-destructive text-center flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Not enough points ({selectedEffectivePrice - selectedStudent.balance} more needed)
                </p>
              )}
            </div>
          )}
          {redeemSuccess && selectedReward && (
            <div className="text-center py-4 space-y-3">
              <div className="text-5xl animate-bounce">{selectedReward.emoji || '🎁'}</div>
              <p className="font-semibold text-lg">{selectedReward.name}</p>
              <p className="text-sm text-muted-foreground">Successfully redeemed!</p>
              {redeemResult && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Paid: {redeemResult.final_price} pts {redeemResult.modifier !== 'static' && redeemResult.modifier !== 'none' && `(${redeemResult.modifier} pricing)`}</p>
                  <p>Balance after: {redeemResult.balance_after} pts</p>
                </div>
              )}
              <Button variant="outline" onClick={() => { setRedeemOpen(false); setRedeemSuccess(false); setRedeemResult(null); }}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Reward Form with Economy Controls ── */
function RewardForm({ name, onNameChange, cost, onCostChange, category, onCategoryChange, emoji, onEmojiChange, description, onDescriptionChange, rewardType, onRewardTypeChange, dynamicPricing, onDynamicPricingChange, minCost, onMinCostChange, maxCost, onMaxCostChange, inventoryEnabled, onInventoryChange, stock, onStockChange, onSubmit, submitLabel, disabled }: {
  name: string; onNameChange: (v: string) => void;
  cost: string; onCostChange: (v: string) => void;
  category: string; onCategoryChange: (v: string) => void;
  emoji: string; onEmojiChange: (v: string) => void;
  description: string; onDescriptionChange: (v: string) => void;
  rewardType: string; onRewardTypeChange: (v: string) => void;
  dynamicPricing: boolean; onDynamicPricingChange: (v: boolean) => void;
  minCost: string; onMinCostChange: (v: string) => void;
  maxCost: string; onMaxCostChange: (v: string) => void;
  inventoryEnabled: boolean; onInventoryChange: (v: boolean) => void;
  stock: string; onStockChange: (v: string) => void;
  onSubmit: () => void; submitLabel: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Extra Computer Time" /></div>
        <div className="space-y-1"><Label className="text-xs">Emoji</Label><Input value={emoji} onChange={e => onEmojiChange(e.target.value)} className="text-center text-lg" maxLength={4} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Base Cost (pts)</Label><Input type="number" value={cost} onChange={e => onCostChange(e.target.value)} min={1} /></div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Type</Label>
        <Select value={rewardType} onValueChange={onRewardTypeChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{REWARD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label className="text-xs">Description (optional)</Label><Input value={description} onChange={e => onDescriptionChange(e.target.value)} placeholder="Short description…" /></div>

      {/* Economy section */}
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Economy</p>

        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-500" /> Dynamic Pricing</Label>
          <Switch checked={dynamicPricing} onCheckedChange={onDynamicPricingChange} />
        </div>

        {dynamicPricing && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Min Price</Label><Input type="number" value={minCost} onChange={e => onMinCostChange(e.target.value)} placeholder="No min" min={1} /></div>
            <div className="space-y-1"><Label className="text-xs">Max Price</Label><Input type="number" value={maxCost} onChange={e => onMaxCostChange(e.target.value)} placeholder="No max" min={1} /></div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5"><Package className="h-3 w-3 text-primary" /> Limited Inventory</Label>
          <Switch checked={inventoryEnabled} onCheckedChange={onInventoryChange} />
        </div>

        {inventoryEnabled && (
          <div className="space-y-1"><Label className="text-xs">Quantity Available</Label><Input type="number" value={stock} onChange={e => onStockChange(e.target.value)} placeholder="e.g. 5" min={0} /></div>
        )}
      </div>

      <Button onClick={onSubmit} disabled={disabled} className="w-full">{submitLabel}</Button>
    </div>
  );
}
