/**
 * GameSettings — Teacher controls for game mode, theme, teams, privacy, portals, public links.
 * Reads/writes Core-owned Phase 5 tables.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import {
  getClassroomGameSettings,
  upsertClassroomGameSettings,
  getGameModes,
  getGameThemes,
  getClassroomTeams,
  createTeam,
  deleteTeam,
  getClassroomPublicLink,
  generatePublicLink,
} from '@/lib/game-data';
import type { ClassroomGameSettings, ClassroomTeam, GameMode, GameTheme, ClassroomPublicLink } from '@/lib/game-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Settings, Users, Link2, Gamepad2, Palette, Eye, Trash2, Plus, Copy, ExternalLink } from 'lucide-react';

const PRIVACY_OPTIONS = [
  { value: 'first_names', label: 'First Names' },
  { value: 'initials', label: 'Initials Only' },
  { value: 'avatars_only', label: 'Avatars Only' },
];

const POINT_TYPES = [
  { value: 'stars', label: '⭐ Stars' },
  { value: 'coins', label: '🪙 Coins' },
  { value: 'xp', label: '⚡ XP' },
  { value: 'energy', label: '🔋 Energy' },
];

const TEAM_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];
const TEAM_ICONS = ['🔴', '🔵', '🟢', '🟡', '🟣', '🩷'];

const GameSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { groupId: sharedGroupId, loading: classroomLoading } = useActiveClassroom();
  const { toast } = useToast();

  const [settings, setSettings] = useState<Partial<ClassroomGameSettings>>({});
  const [modes, setModes] = useState<GameMode[]>([]);
  const [themes, setThemes] = useState<GameTheme[]>([]);
  const [teams, setTeams] = useState<ClassroomTeam[]>([]);
  const [publicLink, setPublicLink] = useState<ClassroomPublicLink | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const groupId = sharedGroupId || '';
  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  useEffect(() => {
    if (groupId) loadAll();
  }, [groupId]);

  const loadAll = async () => {
    setLoading(true);
    const [s, m, th, t, pl] = await Promise.all([
      getClassroomGameSettings(groupId),
      getGameModes(),
      getGameThemes(),
      getClassroomTeams(groupId),
      getClassroomPublicLink(groupId),
    ]);
    setSettings(s || {
      group_id: groupId,
      agency_id: effectiveAgencyId,
      teams_enabled: false,
      leaderboard_enabled: true,
      animations_enabled: true,
      student_portal_enabled: false,
      public_link_enabled: false,
      allow_student_mode_override: false,
      shared_board_enabled: true,
      privacy_mode: 'first_names',
      point_display_type: 'stars',
      mission_of_the_day: '',
      word_of_the_week: '',
    });
    setModes(m);
    setThemes(th);
    setTeams(t);
    setPublicLink(pl);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await upsertClassroomGameSettings({
      ...settings,
      group_id: groupId,
      agency_id: effectiveAgencyId,
    } as any);
    if (res.ok) {
      toast({ title: 'Saved', description: 'Game settings updated.' });
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    const idx = teams.length % TEAM_COLORS.length;
    await createTeam({
      group_id: groupId,
      team_name: newTeamName.trim(),
      team_color: TEAM_COLORS[idx],
      team_icon: TEAM_ICONS[idx],
    });
    setNewTeamName('');
    const t = await getClassroomTeams(groupId);
    setTeams(t);
  };

  const handleDeleteTeam = async (id: string) => {
    await deleteTeam(id);
    const t = await getClassroomTeams(groupId);
    setTeams(t);
  };

  const handleGenerateLink = async () => {
    const link = await generatePublicLink(groupId, effectiveAgencyId);
    setPublicLink(link);
    toast({ title: 'Link created', description: 'Public classroom link generated.' });
  };

  const copyLink = () => {
    if (!publicLink) return;
    const url = `${window.location.origin}/class/${publicLink.slug}/live`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: 'Link copied to clipboard.' });
  };

  const updateSetting = <K extends keyof ClassroomGameSettings>(key: K, val: ClassroomGameSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  if (classroomLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!groupId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Gamepad2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No classroom found. Create a classroom group first.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>Go to Admin</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/classroom')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-bold font-heading">🎮 Game Settings</h1>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Game Mode */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Gamepad2 className="h-4 w-4" /> Game Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={settings.game_mode_id || ''}
            onValueChange={v => updateSetting('game_mode_id', v || null)}
          >
            <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
            <SelectContent>
              {modes.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.icon_emoji} {m.name}</SelectItem>
              ))}
              {modes.length === 0 && <SelectItem value="race" disabled>No modes available</SelectItem>}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" /> Theme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={settings.game_theme_id || ''}
            onValueChange={v => updateSetting('game_theme_id', v || null)}
          >
            <SelectTrigger><SelectValue placeholder="Select theme" /></SelectTrigger>
            <SelectContent>
              {themes.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.preview_emoji} {t.name}</SelectItem>
              ))}
              {themes.length === 0 && <SelectItem value="default" disabled>No themes yet</SelectItem>}
            </SelectContent>
          </Select>

          <div className="space-y-2">
            <Label className="text-xs">Point Display</Label>
            <Select
              value={settings.point_display_type || 'stars'}
              onValueChange={v => updateSetting('point_display_type', v as any)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POINT_TYPES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'shared_board_enabled', label: 'Shared Class Board' },
            { key: 'leaderboard_enabled', label: 'Leaderboard' },
            { key: 'animations_enabled', label: 'Animations' },
            { key: 'teams_enabled', label: 'Team Mode' },
            { key: 'allow_student_mode_override', label: 'Student-specific Mode Override' },
            { key: 'student_portal_enabled', label: 'Student Portal' },
            { key: 'public_link_enabled', label: 'Public Classroom Link' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <Label className="text-sm">{item.label}</Label>
              <Switch
                checked={!!(settings as any)[item.key]}
                onCheckedChange={v => updateSetting(item.key as any, v)}
              />
            </div>
          ))}

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Eye className="h-3 w-3" /> Privacy Mode</Label>
            <Select
              value={settings.privacy_mode || 'first_names'}
              onValueChange={v => updateSetting('privacy_mode', v as any)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIVACY_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs">Mission of the Day</Label>
            <Input
              value={settings.mission_of_the_day || ''}
              onChange={e => updateSetting('mission_of_the_day', e.target.value)}
              placeholder="e.g. Raise hand before speaking"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Word of the Week</Label>
            <Input
              value={settings.word_of_the_week || ''}
              onChange={e => updateSetting('word_of_the_week', e.target.value)}
              placeholder="e.g. Respect"
            />
          </div>
        </CardContent>
      </Card>

      {/* Teams */}
      {settings.teams_enabled && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <span className="text-lg">{t.team_icon}</span>
                <span className="flex-1 text-sm font-medium" style={{ color: t.team_color }}>{t.team_name}</span>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteTeam(t.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="New team name"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
              />
              <Button size="sm" variant="outline" onClick={handleAddTeam}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Link */}
      {settings.public_link_enabled && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Public Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {publicLink ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                  /class/{publicLink.slug}/live
                </code>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`/class/${publicLink.slug}/live`, '_blank')}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleGenerateLink}>
                <Link2 className="h-3 w-3 mr-1" /> Generate Link
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleGenerateLink}>
              Reset Link
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GameSettings;
