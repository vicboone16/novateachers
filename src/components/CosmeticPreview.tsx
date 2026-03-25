/**
 * CosmeticPreview — Renders equipped cosmetics on student avatars/cards.
 * Used in game board, student portal, and classroom cards.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EquippedCosmetic {
  slot: string;
  cosmetic_id: string;
  name: string;
  icon_emoji: string;
  category: string;
  rarity: string;
}

interface Props {
  studentId: string;
  showBadges?: boolean;
  showTrail?: boolean;
  showTheme?: boolean;
  compact?: boolean;
  className?: string;
}

const RARITY_GLOW: Record<string, string> = {
  common: '',
  uncommon: 'ring-1 ring-green-400/30',
  rare: 'ring-1 ring-blue-400/40',
  epic: 'ring-2 ring-purple-400/50',
  legendary: 'ring-2 ring-amber-400/60 shadow-amber-200/20',
};

export function CosmeticPreview({ studentId, showBadges = true, showTrail = true, showTheme, compact = false, className }: Props) {
  const [equipped, setEquipped] = useState<EquippedCosmetic[]>([]);

  useEffect(() => {
    if (!studentId) return;
    loadEquipped();
  }, [studentId]);

  const loadEquipped = async () => {
    const { data: loadout } = await cloudSupabase
      .from('student_cosmetic_loadout')
      .select('slot, cosmetic_id')
      .eq('student_id', studentId);

    if (!loadout || loadout.length === 0) { setEquipped([]); return; }

    const cosmeticIds = (loadout as any[]).map(l => l.cosmetic_id);
    const { data: cosmetics } = await cloudSupabase
      .from('cosmetic_catalog')
      .select('id, name, icon_emoji, category, rarity')
      .in('id', cosmeticIds);

    const cosmeticMap = new Map((cosmetics || []).map((c: any) => [c.id, c]));
    setEquipped((loadout as any[]).map(l => {
      const c = cosmeticMap.get(l.cosmetic_id) || {};
      return { slot: l.slot, cosmetic_id: l.cosmetic_id, ...c } as EquippedCosmetic;
    }));
  };

  if (equipped.length === 0) return null;

  const avatarCosmetic = equipped.find(e => e.slot === 'avatar');
  const trailCosmetic = equipped.find(e => e.slot === 'trail');
  const badgeCosmetics = equipped.filter(e => e.slot === 'badge');
  const themeCosmetic = equipped.find(e => e.slot === 'theme');

  if (compact) {
    return (
      <div className={cn('flex items-center gap-0.5', className)}>
        {equipped.map(e => (
          <span key={e.cosmetic_id} className="text-[10px]" title={e.name}>
            {e.icon_emoji}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Avatar frame effect */}
      {avatarCosmetic && (
        <div className={cn(
          'rounded-full p-0.5',
          RARITY_GLOW[avatarCosmetic.rarity] || ''
        )} title={`${avatarCosmetic.name} (Avatar)`}>
          <span className="text-xs">{avatarCosmetic.icon_emoji}</span>
        </div>
      )}

      {/* Trail effect indicator */}
      {showTrail && trailCosmetic && (
        <Badge variant="outline" className="text-[8px] px-1 py-0 gap-0.5 border-purple-300/50">
          {trailCosmetic.icon_emoji}
        </Badge>
      )}

      {/* Badge cosmetics */}
      {showBadges && badgeCosmetics.map(b => (
        <Badge
          key={b.cosmetic_id}
          variant="outline"
          className={cn('text-[8px] px-1 py-0', RARITY_GLOW[b.rarity])}
          title={b.name}
        >
          {b.icon_emoji}
        </Badge>
      ))}

      {/* Theme indicator */}
      {showTheme && themeCosmetic && (
        <Badge variant="outline" className="text-[8px] px-1 py-0 gap-0.5">
          🎨 {themeCosmetic.name}
        </Badge>
      )}
    </div>
  );
}

/**
 * Hook to get trail effect CSS class for a student
 */
export function useStudentTrailEffect(studentId: string): string | null {
  const [trailClass, setTrailClass] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    cloudSupabase
      .from('student_cosmetic_loadout')
      .select('cosmetic_id')
      .eq('student_id', studentId)
      .eq('slot', 'trail')
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) { setTrailClass(null); return; }
        const { data: cosmetic } = await cloudSupabase
          .from('cosmetic_catalog')
          .select('item_key, rarity')
          .eq('id', (data as any).cosmetic_id)
          .maybeSingle();
        if (cosmetic) {
          const key = (cosmetic as any).item_key;
          // Map trail keys to CSS effects
          const trailMap: Record<string, string> = {
            'trail_fire': 'animate-pulse text-orange-500',
            'trail_ice': 'animate-pulse text-blue-400',
            'trail_sparkle': 'animate-bounce text-amber-400',
            'trail_rainbow': 'animate-pulse text-purple-500',
            'trail_shadow': 'opacity-80',
          };
          setTrailClass(trailMap[key] || null);
        }
      });
  }, [studentId]);

  return trailClass;
}
