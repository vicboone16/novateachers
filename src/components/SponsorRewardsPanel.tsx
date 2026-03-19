/**
 * SponsorRewardsPanel — Browse sponsored rewards and classroom wishlists.
 * Reads from Core: v_sponsored_rewards, classroom_wishlists, sponsors.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Heart, Gift, Plus, Star, Package, CheckCircle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SponsoredReward {
  id: string;
  name: string;
  description: string | null;
  point_cost: number;
  category: string;
  emoji: string;
  stock: number | null;
  sponsor_name: string;
  sponsor_logo_url: string | null;
}

interface WishlistItem {
  id: string;
  item_name: string;
  description: string | null;
  estimated_cost: number | null;
  priority: string;
  status: string;
}

interface Props {
  agencyId: string;
  classroomId: string;
}

export function SponsorRewardsPanel({ agencyId, classroomId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rewards, setRewards] = useState<SponsoredReward[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newCost, setNewCost] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rewardRes, wishRes] = await Promise.all([
        supabase
          .from('v_sponsored_rewards' as any)
          .select('*')
          .eq('agency_id', agencyId),
        supabase
          .from('classroom_wishlists' as any)
          .select('*')
          .eq('classroom_id', classroomId)
          .order('created_at', { ascending: false }),
      ]);
      setRewards((rewardRes.data || []) as any[]);
      setWishlist((wishRes.data || []) as any[]);
    } catch { /* silent */ }
    setLoading(false);
  }, [agencyId, classroomId]);

  useEffect(() => { loadData(); }, [loadData]);

  const addWishlistItem = async () => {
    if (!newItem.trim() || !user) return;
    try {
      await supabase
        .from('classroom_wishlists' as any)
        .insert({
          classroom_id: classroomId,
          agency_id: agencyId,
          item_name: newItem.trim(),
          estimated_cost: newCost ? parseFloat(newCost) : null,
          created_by: user.id,
        });
      toast({ title: 'Wishlist item added' });
      setAddOpen(false);
      setNewItem('');
      setNewCost('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) return null;
  if (rewards.length === 0 && wishlist.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Sponsored Rewards */}
      {rewards.length > 0 && (
        <>
          <h3 className="text-base font-bold font-heading flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            Sponsored Rewards
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {rewards.map(r => (
              <Card key={r.id} className="border-border/40">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{r.name}</p>
                      {r.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{r.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {r.point_cost}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] gap-0.5">
                          <Heart className="h-2 w-2 text-pink-500" /> {r.sponsor_name}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Classroom Wishlist */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-heading flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Classroom Wishlist
        </h3>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Item
        </Button>
      </div>

      {wishlist.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No wishlist items yet</p>
      ) : (
        <div className="space-y-1.5">
          {wishlist.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{item.item_name}</p>
                {item.estimated_cost && (
                  <p className="text-[10px] text-muted-foreground">~${item.estimated_cost.toFixed(2)}</p>
                )}
              </div>
              <Badge className={cn('text-[9px]',
                item.status === 'fulfilled' ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {item.status === 'fulfilled' ? <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> : <Package className="h-2.5 w-2.5 mr-0.5" />}
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Add Wishlist Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Wishlist Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Item Name</Label>
              <Input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="e.g. Fidget tools set" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estimated Cost ($)</Label>
              <Input type="number" value={newCost} onChange={e => setNewCost(e.target.value)} placeholder="Optional" />
            </div>
            <Button onClick={addWishlistItem} disabled={!newItem.trim()} className="w-full">Add to Wishlist</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
