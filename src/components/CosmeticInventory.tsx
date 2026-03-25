/**
 * CosmeticInventory — Student cosmetic unlock inventory with equip/unequip.
 * Categories: avatar, trail, badge, theme
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Lock, CheckCircle, Palette, Wand2, Award, Paintbrush } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CosmeticItem {
  id: string;
  category: string;
  item_key: string;
  name: string;
  description: string | null;
  icon_emoji: string;
  rarity: string;
  unlock_method: string;
  unlock_threshold: number;
  is_unlocked: boolean;
  is_equipped: boolean;
}

const CATEGORIES = [
  { key: 'avatar', label: 'Avatar', icon: Sparkles },
  { key: 'trail', label: 'Trail', icon: Wand2 },
  { key: 'badge', label: 'Badge', icon: Award },
  { key: 'theme', label: 'Theme', icon: Palette },
];

const RARITY_COLORS: Record<string, string> = {
  common: 'border-border/40',
  uncommon: 'border-green-500/40',
  rare: 'border-blue-500/40',
  epic: 'border-purple-500/40',
  legendary: 'border-amber-500/40 ring-1 ring-amber-500/20',
};

interface Props {
  studentId: string;
  agencyId?: string;
  canEquip?: boolean;
  className?: string;
}

export function CosmeticInventory({ studentId, agencyId, canEquip = true, className }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [activeTab, setActiveTab] = useState('avatar');
  const [equipping, setEquipping] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    loadInventory();
  }, [studentId]);

  const loadInventory = async () => {
    // Load catalog
    let query = cloudSupabase.from('cosmetic_catalog').select('*').eq('is_active', true);
    if (agencyId) query = query.or(`agency_id.eq.${agencyId},agency_id.is.null`);
    else query = query.is('agency_id', null);
    const { data: catalog } = await query;

    // Load unlocks
    const { data: unlocks } = await cloudSupabase
      .from('student_cosmetic_unlocks')
      .select('cosmetic_id')
      .eq('student_id', studentId);
    const unlockedIds = new Set((unlocks || []).map((u: any) => u.cosmetic_id));

    // Load loadout
    const { data: loadout } = await cloudSupabase
      .from('student_cosmetic_loadout')
      .select('cosmetic_id, slot')
      .eq('student_id', studentId);
    const equippedIds = new Set((loadout || []).map((l: any) => l.cosmetic_id));

    setItems((catalog || []).map((c: any) => ({
      ...c,
      is_unlocked: unlockedIds.has(c.id),
      is_equipped: equippedIds.has(c.id),
    })));
  };

  const handleEquip = async (item: CosmeticItem) => {
    if (!item.is_unlocked || !canEquip) return;
    setEquipping(item.id);
    try {
      if (item.is_equipped) {
        // Unequip
        await cloudSupabase.from('student_cosmetic_loadout').delete().eq('student_id', studentId).eq('cosmetic_id', item.id);
        toast({ title: `Unequipped ${item.name}` });
      } else {
        // Equip (replace existing in same slot)
        await cloudSupabase.from('student_cosmetic_loadout').upsert({
          student_id: studentId,
          slot: item.category,
          cosmetic_id: item.id,
          equipped_at: new Date().toISOString(),
        }, { onConflict: 'student_id,slot' });
        toast({ title: `Equipped ${item.icon_emoji} ${item.name}!` });
      }
      loadInventory();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setEquipping(null);
  };

  const filtered = items.filter(i => i.category === activeTab);
  const unlockedCount = items.filter(i => i.is_unlocked).length;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Paintbrush className="h-4 w-4 text-primary" /> Cosmetics
        </h3>
        <Badge variant="outline" className="text-[10px]">{unlockedCount}/{items.length} unlocked</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c.key} value={c.key} className="text-xs gap-1 flex-1">
              <c.icon className="h-3 w-3" /> {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(cat => (
          <TabsContent key={cat.key} value={cat.key} className="mt-3">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6 italic">No {cat.label.toLowerCase()} cosmetics available yet.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(item => (
                <Card key={item.id} className={cn(
                  'transition-all cursor-pointer',
                  RARITY_COLORS[item.rarity] || RARITY_COLORS.common,
                  !item.is_unlocked && 'opacity-50',
                  item.is_equipped && 'ring-2 ring-primary/50 bg-primary/5',
                )} onClick={() => item.is_unlocked && handleEquip(item)}>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl mb-1">{item.is_unlocked ? item.icon_emoji : '🔒'}</div>
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{item.rarity}</p>
                    {item.is_equipped && (
                      <Badge className="text-[8px] mt-1 bg-primary/20 text-primary">Equipped</Badge>
                    )}
                    {!item.is_unlocked && (
                      <p className="text-[9px] text-muted-foreground mt-1">
                        {item.unlock_method === 'level' ? `Level ${item.unlock_threshold}` : `${item.unlock_threshold} ${item.unlock_method}`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
