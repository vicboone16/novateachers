/**
 * RewardEconomySettings — Teacher/admin controls for the dynamic reward economy.
 * Manages: dynamic pricing toggle, demand/scarcity weights, price caps, per-reward overrides.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Settings2, TrendingUp, TrendingDown, Package, Zap, Save, Loader2, BarChart3,
} from 'lucide-react';

interface EconomySettings {
  id?: string;
  dynamic_pricing_enabled: boolean;
  price_update_interval_hours: number;
  demand_weight: number;
  scarcity_weight: number;
  max_price_increase_pct: number;
  max_price_decrease_pct: number;
}

const DEFAULT_SETTINGS: EconomySettings = {
  dynamic_pricing_enabled: false,
  price_update_interval_hours: 24,
  demand_weight: 0.3,
  scarcity_weight: 0.2,
  max_price_increase_pct: 50,
  max_price_decrease_pct: 30,
};

interface Props {
  agencyId: string;
  classroomId?: string;
}

export function RewardEconomySettings({ agencyId, classroomId }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<EconomySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      let q = cloudSupabase
        .from('reward_economy_settings' as any)
        .select('*')
        .eq('agency_id', agencyId);
      if (classroomId) {
        q = q.eq('classroom_id', classroomId);
      } else {
        q = q.is('classroom_id', null);
      }
      const { data } = await q.limit(1).single();
      if (data) {
        setSettings(data as any);
      }
    } catch {
      // No settings yet, use defaults
    }
    setLoading(false);
  }, [agencyId, classroomId]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        agency_id: agencyId,
        classroom_id: classroomId || null,
        dynamic_pricing_enabled: settings.dynamic_pricing_enabled,
        price_update_interval_hours: settings.price_update_interval_hours,
        demand_weight: settings.demand_weight,
        scarcity_weight: settings.scarcity_weight,
        max_price_increase_pct: settings.max_price_increase_pct,
        max_price_decrease_pct: settings.max_price_decrease_pct,
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        await cloudSupabase.from('reward_economy_settings' as any).update(payload).eq('id', settings.id);
      } else {
        const { data } = await cloudSupabase.from('reward_economy_settings' as any).insert(payload).select('id').single();
        if (data) setSettings(prev => ({ ...prev, id: (data as any).id }));
      }
      toast({ title: 'Economy settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Economy Settings
        </CardTitle>
        <CardDescription className="text-xs">
          Control how reward prices adjust based on demand and scarcity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Master toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Dynamic Pricing</p>
              <p className="text-[10px] text-muted-foreground">Prices adjust based on demand & inventory</p>
            </div>
          </div>
          <Switch
            checked={settings.dynamic_pricing_enabled}
            onCheckedChange={(v) => setSettings(prev => ({ ...prev, dynamic_pricing_enabled: v }))}
          />
        </div>

        {settings.dynamic_pricing_enabled && (
          <>
            {/* Demand weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-primary" /> Demand Sensitivity
                </Label>
                <Badge variant="outline" className="text-[9px]">{Math.round(settings.demand_weight * 100)}%</Badge>
              </div>
              <Slider
                value={[settings.demand_weight * 100]}
                onValueChange={([v]) => setSettings(prev => ({ ...prev, demand_weight: v / 100 }))}
                min={0} max={100} step={5}
                className="w-full"
              />
              <p className="text-[10px] text-muted-foreground">Higher = prices react more to popular items</p>
            </div>

            {/* Scarcity weight */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Package className="h-3 w-3 text-primary" /> Scarcity Factor
                </Label>
                <Badge variant="outline" className="text-[9px]">{Math.round(settings.scarcity_weight * 100)}%</Badge>
              </div>
              <Slider
                value={[settings.scarcity_weight * 100]}
                onValueChange={([v]) => setSettings(prev => ({ ...prev, scarcity_weight: v / 100 }))}
                min={0} max={100} step={5}
                className="w-full"
              />
              <p className="text-[10px] text-muted-foreground">Higher = low-stock items cost more</p>
            </div>

            {/* Price caps */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-destructive" /> Max Increase
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={settings.max_price_increase_pct}
                    onChange={e => setSettings(prev => ({ ...prev, max_price_increase_pct: parseInt(e.target.value) || 0 }))}
                    className="h-8 text-xs"
                    min={0} max={200}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-accent" /> Max Discount
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={settings.max_price_decrease_pct}
                    onChange={e => setSettings(prev => ({ ...prev, max_price_decrease_pct: parseInt(e.target.value) || 0 }))}
                    className="h-8 text-xs"
                    min={0} max={80}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </>
        )}

        <Button onClick={saveSettings} disabled={saving} className="w-full gap-1.5" size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
