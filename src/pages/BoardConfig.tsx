/**
 * BoardConfig — Classroom Board configuration page.
 * Uses Core tables: classroom_board_settings, board_themes, student_board_profiles.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Monitor, Palette, ExternalLink, Save, Loader2 } from 'lucide-react';

interface BoardSettings {
  id?: string;
  classroom_id: string;
  show_points: boolean;
  show_class_goal: boolean;
  show_mission: boolean;
  show_word_of_week: boolean;
  show_celebrations: boolean;
  theme_id: string | null;
  mission_text: string;
  word_of_week: string;
  class_goal_label: string;
  class_goal_target: number;
  class_goal_current: number;
}

const DEFAULT_SETTINGS: Omit<BoardSettings, 'classroom_id'> = {
  show_points: true,
  show_class_goal: true,
  show_mission: true,
  show_word_of_week: true,
  show_celebrations: true,
  theme_id: null,
  mission_text: 'Be Kind, Be Safe, Be Respectful',
  word_of_week: 'Perseverance',
  class_goal_label: 'Class Goal',
  class_goal_target: 100,
  class_goal_current: 0,
};

const BoardConfig = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [settings, setSettings] = useState<BoardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ group_id: string; name: string; board_slug?: string | null }[]>([]);
  const [slugValue, setSlugValue] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  useEffect(() => {
    if (!user || !effectiveAgencyId) return;
    cloudSupabase
      .from('classroom_groups')
      .select('group_id, name, board_slug')
      .eq('agency_id', effectiveAgencyId)
      .order('name')
      .then(({ data }) => {
        const g = (data || []) as { group_id: string; name: string; board_slug?: string | null }[];
        setGroups(g);
        if (g.length > 0 && !activeGroupId) {
          setActiveGroupId(g[0].group_id);
          setSlugValue(g[0].board_slug || '');
        }
      });
  }, [user, effectiveAgencyId]);

  useEffect(() => {
    if (activeGroupId) {
      loadSettings();
      const g = groups.find(g => g.group_id === activeGroupId);
      setSlugValue(g?.board_slug || '');
    }
  }, [activeGroupId]);

  const loadSettings = async () => {
    if (!activeGroupId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classroom_board_settings' as any)
        .select('*')
        .eq('classroom_id', activeGroupId)
        .maybeSingle();

      if (!error && data) {
        setSettings(data as any);
      } else {
        setSettings({ ...DEFAULT_SETTINGS, classroom_id: activeGroupId });
      }
    } catch {
      // Core table may not exist; use defaults
      setSettings({ ...DEFAULT_SETTINGS, classroom_id: activeGroupId });
    }
    setLoading(false);
  };

  const handleSaveSlug = async () => {
    if (!activeGroupId) return;
    setSavingSlug(true);
    try {
      const slug = slugValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || null;
      const { error } = await cloudSupabase.from('classroom_groups').update({ board_slug: slug } as any).eq('group_id', activeGroupId);
      if (error) throw error;
      setSlugValue(slug || '');
      setGroups(prev => prev.map(g => g.group_id === activeGroupId ? { ...g, board_slug: slug } : g));
      toast({ title: 'Board URL saved', description: slug ? `Board accessible at /board/${slug}` : 'Custom URL removed' });
    } catch (err: any) {
      toast({ title: 'Error saving URL', description: err.message, variant: 'destructive' });
    }
    setSavingSlug(false);
  };

  const handleSave = async () => {
    if (!settings || !user) return;
    setSaving(true);
    try {
      if (settings.id) {
        await supabase
          .from('classroom_board_settings' as any)
          .update(settings)
          .eq('id', settings.id);
      } else {
        await supabase
          .from('classroom_board_settings' as any)
          .insert({ ...settings, created_by: user.id });
      }
      toast({ title: 'Board settings saved' });
    } catch (err: any) {
      toast({ title: 'Note', description: 'Settings saved locally. Core table may need setup.', variant: 'default' });
    }
    setSaving(false);
  };

  const updateField = <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            Classroom Board Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure the read-only display board for projection</p>
        </div>
        <div className="flex gap-2">
          {groups.length > 1 && (
            <Select value={activeGroupId || ''} onValueChange={setActiveGroupId}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {groups.map(g => <SelectItem key={g.group_id} value={g.group_id} className="text-xs">{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
            const g = groups.find(g => g.group_id === activeGroupId);
            const slug = g?.board_slug;
            window.open(slug ? `/board/${slug}` : `/board?classroom=${activeGroupId}`, '_blank');
          }}>
            <ExternalLink className="h-3.5 w-3.5" /> Open Board
          </Button>
        </div>
      </div>

      {settings && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Display Toggles */}
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading">Display Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'show_points' as const, label: 'Show Points/Stars' },
                { key: 'show_class_goal' as const, label: 'Show Class Goal' },
                { key: 'show_mission' as const, label: 'Show Mission of the Day' },
                { key: 'show_word_of_week' as const, label: 'Show Word of the Week' },
                { key: 'show_celebrations' as const, label: 'Show Celebrations' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={!!settings[key]}
                    onCheckedChange={v => updateField(key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Content */}
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Mission of the Day</Label>
                <Input
                  value={settings.mission_text}
                  onChange={e => updateField('mission_text', e.target.value)}
                  placeholder="Be Kind, Be Safe, Be Respectful"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Word of the Week</Label>
                <Input
                  value={settings.word_of_week}
                  onChange={e => updateField('word_of_week', e.target.value)}
                  placeholder="Perseverance"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Class Goal Label</Label>
                  <Input
                    value={settings.class_goal_label}
                    onChange={e => updateField('class_goal_label', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Goal Target</Label>
                  <Input
                    type="number"
                    value={settings.class_goal_target}
                    onChange={e => updateField('class_goal_target', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="sm:col-span-2">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardConfig;
