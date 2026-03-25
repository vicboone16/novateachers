/**
 * GameModeSelector — Advanced multi-game mode selection and configuration.
 * Supports: Race, Tower Climb, Collect-a-thon, Survival, and custom modes.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Flag, Mountain, Package, Shield, Sparkles, Gamepad2, Settings, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GameModeConfig {
  slug: string;
  name: string;
  description: string;
  icon: any;
  emoji: string;
  color: string;
  features: string[];
  settings: {
    checkpoint_rewards: boolean;
    comeback_enabled: boolean;
    momentum_enabled: boolean;
    max_daily_points: number | null;
    difficulty_scaling: 'none' | 'adaptive' | 'progressive';
    game_speed: number;
  };
}

const PRESET_MODES: GameModeConfig[] = [
  {
    slug: 'race',
    name: 'Race Track',
    description: 'Classic race to the finish! Students advance along a track as they earn points.',
    icon: Flag,
    emoji: '🏁',
    color: 'text-blue-500',
    features: ['Checkpoints', 'Lap counting', 'Speed zones', 'Leaderboard'],
    settings: { checkpoint_rewards: true, comeback_enabled: true, momentum_enabled: true, max_daily_points: null, difficulty_scaling: 'none', game_speed: 1 },
  },
  {
    slug: 'tower',
    name: 'Tower Climb',
    description: 'Build your way up! Each point adds a block. Reach the top to earn a bonus.',
    icon: Mountain,
    emoji: '🏗️',
    color: 'text-purple-500',
    features: ['Floor milestones', 'Building animation', 'Height badges', 'Sky zones'],
    settings: { checkpoint_rewards: true, comeback_enabled: false, momentum_enabled: true, max_daily_points: null, difficulty_scaling: 'progressive', game_speed: 1 },
  },
  {
    slug: 'collect',
    name: 'Collect-a-thon',
    description: 'Gather treasures! Points unlock collectible items on a treasure map.',
    icon: Package,
    emoji: '💎',
    color: 'text-amber-500',
    features: ['Item collection', 'Treasure map', 'Rarity tiers', 'Set completion bonuses'],
    settings: { checkpoint_rewards: false, comeback_enabled: true, momentum_enabled: false, max_daily_points: null, difficulty_scaling: 'none', game_speed: 1 },
  },
  {
    slug: 'survival',
    name: 'Survival Mode',
    description: 'Stay strong! Maintain positive behavior to keep your health bar full.',
    icon: Shield,
    emoji: '🛡️',
    color: 'text-green-500',
    features: ['Health bar', 'Shield powerups', 'Recovery mechanics', 'Endurance badges'],
    settings: { checkpoint_rewards: false, comeback_enabled: true, momentum_enabled: true, max_daily_points: 100, difficulty_scaling: 'adaptive', game_speed: 1 },
  },
];

interface Props {
  groupId: string;
  agencyId: string;
  currentModeSlug?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: GameModeConfig) => void;
}

export function GameModeSelector({ groupId, agencyId, currentModeSlug, open, onOpenChange, onModeChange }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameModeConfig | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [customSettings, setCustomSettings] = useState<GameModeConfig['settings'] | null>(null);
  const [dbModes, setDbModes] = useState<any[]>([]);

  useEffect(() => {
    cloudSupabase
      .from('game_modes')
      .select('*')
      .eq('is_preset', true)
      .order('name')
      .then(({ data }) => setDbModes(data || []));
  }, []);

  const handleSelect = (mode: GameModeConfig) => {
    setSelectedMode(mode);
    setCustomSettings({ ...mode.settings });
  };

  const handleApply = async () => {
    if (!selectedMode) return;
    // Upsert to classroom_game_settings
    const { data: existing } = await cloudSupabase
      .from('classroom_game_settings')
      .select('id')
      .eq('group_id', groupId)
      .maybeSingle();

    const payload = {
      group_id: groupId,
      agency_id: agencyId,
      game_mode: selectedMode.slug,
    };

    if (existing) {
      await cloudSupabase.from('classroom_game_settings').update(payload).eq('group_id', groupId);
    } else {
      await cloudSupabase.from('classroom_game_settings').insert(payload);
    }

    onModeChange(selectedMode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" /> Game Modes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {PRESET_MODES.map(mode => {
            const Icon = mode.icon;
            const isActive = currentModeSlug === mode.slug;
            const isSelected = selectedMode?.slug === mode.slug;

            return (
              <Card
                key={mode.slug}
                className={cn(
                  'cursor-pointer transition-all hover-lift',
                  isSelected && 'ring-2 ring-primary/50',
                  isActive && 'border-accent/50 bg-accent/5',
                )}
                onClick={() => handleSelect(mode)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-xl',
                      isActive ? 'bg-accent/20' : 'bg-muted'
                    )}>
                      {mode.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{mode.name}</p>
                        {isActive && (
                          <Badge className="text-[9px] bg-accent/20 text-accent-foreground gap-0.5">
                            <CheckCircle className="h-2 w-2" /> Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {mode.features.map(f => (
                          <Badge key={f} variant="outline" className="text-[9px] py-0">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedMode && (
          <div className="space-y-3 pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setCustomizing(!customizing)}
            >
              <Settings className="h-3 w-3" /> {customizing ? 'Hide' : 'Customize'} Settings
            </Button>

            {customizing && customSettings && (
              <div className="space-y-4 bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Checkpoint Rewards</Label>
                  <Switch
                    checked={customSettings.checkpoint_rewards}
                    onCheckedChange={v => setCustomSettings(prev => prev ? { ...prev, checkpoint_rewards: v } : prev)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Comeback Mechanics</Label>
                  <Switch
                    checked={customSettings.comeback_enabled}
                    onCheckedChange={v => setCustomSettings(prev => prev ? { ...prev, comeback_enabled: v } : prev)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Momentum Tracking</Label>
                  <Switch
                    checked={customSettings.momentum_enabled}
                    onCheckedChange={v => setCustomSettings(prev => prev ? { ...prev, momentum_enabled: v } : prev)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Game Speed: {customSettings.game_speed}x</Label>
                  <Slider
                    value={[customSettings.game_speed]}
                    onValueChange={([v]) => setCustomSettings(prev => prev ? { ...prev, game_speed: v } : prev)}
                    min={0.5}
                    max={3}
                    step={0.5}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleApply} className="w-full gap-1.5">
              <Sparkles className="h-4 w-4" /> Apply {selectedMode.name}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
