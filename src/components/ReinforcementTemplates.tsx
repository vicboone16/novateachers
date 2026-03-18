/**
 * Reinforcement Templates — preset and custom reinforcement profiles
 * that teachers can browse, preview, and apply to their classroom.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Star, Zap, Shield, Heart, Trophy, GraduationCap,
  Check, ChevronRight, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateConfig {
  display_currency: string;
  engagement_points: number;
  probe_correct_points: number;
  dro_interval_minutes: number | null;
  dro_points: number;
  response_cost_enabled: boolean;
  behaviors: { name: string; points: number }[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  age_band: string;
  category: string;
  is_preset: boolean;
  config: TemplateConfig;
}

const CATEGORY_ICONS: Record<string, any> = {
  early_learner: Star,
  externalizing_sdc: Shield,
  internalizing: Heart,
  pbis: Trophy,
  middle_xp: Zap,
  high_credits: GraduationCap,
  custom: Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  early_learner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  externalizing_sdc: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  internalizing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  pbis: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  middle_xp: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high_credits: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  custom: 'bg-muted text-muted-foreground',
};

const AGE_LABELS: Record<string, string> = {
  k2: 'K–2',
  '3to5': '3–5',
  '6to8': '6–8',
  '9to12': '9–12',
  all: 'All Ages',
};

const CURRENCY_ICONS: Record<string, string> = {
  stars: '⭐',
  points: '⚡',
  xp: '🔷',
  credits: '🟣',
};

interface Props {
  groupId: string;
  agencyId: string;
  onApplied?: (template: Template) => void;
}

export default function ReinforcementTemplates({ groupId, agencyId, onApplied }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    loadTemplates();
    loadCurrentTemplate();
  }, [groupId]);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('beacon_reinforcement_templates' as any)
      .select('*')
      .order('is_preset', { ascending: false })
      .order('name');
    setTemplates((data || []) as any);
    setLoading(false);
  };

  const loadCurrentTemplate = async () => {
    const { data } = await supabase
      .from('beacon_classroom_templates' as any)
      .select('template_id')
      .eq('group_id', groupId)
      .maybeSingle();
    if (data) setCurrentTemplateId((data as any).template_id);
  };

  const applyTemplate = async (template: Template) => {
    if (!user) return;
    setApplying(true);
    try {
      // Upsert — one template per classroom
      const { error } = await supabase
        .from('beacon_classroom_templates' as any)
        .upsert(
          { group_id: groupId, template_id: template.id, applied_by: user.id },
          { onConflict: 'group_id' }
        );
      if (error) throw error;
      setCurrentTemplateId(template.id);
      toast({ title: `Applied "${template.name}"` });
      onApplied?.(template);
    } catch (err: any) {
      toast({ title: 'Error applying template', description: err.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const presets = templates.filter(t => t.is_preset);
  const custom = templates.filter(t => !t.is_preset);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold font-heading flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Reinforcement Templates
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a preset reinforcement profile for your classroom or create your own.
        </p>
      </div>

      {/* Preset templates grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map(template => {
          const Icon = CATEGORY_ICONS[template.category] || Sparkles;
          const isActive = currentTemplateId === template.id;
          const config = template.config;
          const currency = CURRENCY_ICONS[config.display_currency] || '⚡';

          return (
            <Card
              key={template.id}
              className={cn(
                'relative transition-all cursor-pointer hover:shadow-md',
                isActive && 'ring-2 ring-primary border-primary/50',
              )}
              onClick={() => setPreviewTemplate(template)}
            >
              {isActive && (
                <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', CATEGORY_COLORS[template.category])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold truncate">{template.name}</CardTitle>
                    <Badge variant="outline" className="text-[9px] mt-0.5">
                      {AGE_LABELS[template.age_band] || template.age_band}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-[11px] text-muted-foreground line-clamp-2">{template.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>{currency} {config.display_currency}</span>
                  <span>·</span>
                  <span>{config.behaviors?.length || 0} behaviors</span>
                  {config.dro_interval_minutes && (
                    <>
                      <span>·</span>
                      <span>DRO {config.dro_interval_minutes}m</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Template preview dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-md">
          {previewTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => { const Icon = CATEGORY_ICONS[previewTemplate.category] || Sparkles; return <Icon className="h-5 w-5 text-primary" />; })()}
                  {previewTemplate.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Currency</p>
                    <p className="font-medium">{CURRENCY_ICONS[previewTemplate.config.display_currency]} {previewTemplate.config.display_currency}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Response Cost</p>
                    <p className="font-medium">{previewTemplate.config.response_cost_enabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Engagement</p>
                    <p className="font-medium">+{previewTemplate.config.engagement_points} pts</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Probe Correct</p>
                    <p className="font-medium">+{previewTemplate.config.probe_correct_points} pts</p>
                  </div>
                  {previewTemplate.config.dro_interval_minutes && (
                    <div className="rounded-lg bg-muted/50 p-2.5 col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">DRO Interval</p>
                      <p className="font-medium">Every {previewTemplate.config.dro_interval_minutes} min → +{previewTemplate.config.dro_points} pts</p>
                    </div>
                  )}
                </div>

                {previewTemplate.config.behaviors?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1.5">Reinforced Behaviors</p>
                    <div className="space-y-1">
                      {previewTemplate.config.behaviors.map((b, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
                          <span className="text-sm">{b.name}</span>
                          <Badge variant="outline" className="text-xs font-bold">+{b.points}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full gap-1.5"
                  onClick={() => { applyTemplate(previewTemplate); setPreviewTemplate(null); }}
                  disabled={applying || currentTemplateId === previewTemplate.id}
                >
                  {currentTemplateId === previewTemplate.id ? (
                    <><Check className="h-4 w-4" /> Currently Active</>
                  ) : (
                    <><ChevronRight className="h-4 w-4" /> Apply to Classroom</>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
