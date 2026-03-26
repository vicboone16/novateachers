/**
 * GameSettings — Teacher controls for game mode, theme, teams, and board settings.
 * Reads/writes Cloud-owned tables using actual DB column names.
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Settings, Users, Link2, Gamepad2, Palette, Trash2, Plus, Copy, ExternalLink, Map, Zap } from 'lucide-react';
import { useGameTrack } from '@/hooks/useGameTrack';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const TEAM_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];
const TEAM_ICONS = ['🔴', '🔵', '🟢', '🟡', '🟣', '🩷'];

// Settings state maps to actual DB columns
interface SettingsState {
  group_id: string;
  agency_id: string;
  game_mode: string;
  mode_id: string | null;
  theme_id: string | null;
  track_id: string | null;
  show_avatars: boolean;
  show_leaderboard: boolean;
  allow_team_mode: boolean;
  total_steps: number;
  movement_style: string;
}

const MOVEMENT_STYLES = [
  { value: 'glide', label: '🌊 Glide', desc: 'Smooth ease-in-out movement' },
  { value: 'bounce', label: '🏀 Bounce', desc: 'Bouncy hop between positions' },
  { value: 'dash', label: '⚡ Dash', desc: 'Quick snap movement' },
  { value: 'float', label: '🎈 Float', desc: 'Gentle floating with wobble' },
];

const GameSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { groupId: sharedGroupId, loading: classroomLoading } = useActiveClassroom();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SettingsState>({
    group_id: '',
    agency_id: '',
    game_mode: 'race',
    mode_id: null,
    theme_id: null,
    track_id: null,
    show_avatars: true,
    show_leaderboard: true,
    allow_team_mode: false,
    total_steps: 20,
    movement_style: 'glide',
  });
  const [modes, setModes] = useState<any[]>([]);
  const [themes, setThemes] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [publicLink, setPublicLink] = useState<any>(null);
  const [publicLinkEnabled, setPublicLinkEnabled] = useState(false);
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
    if (s) {
      setSettings({
        group_id: groupId,
        agency_id: effectiveAgencyId,
        game_mode: s.game_mode || 'race',
        mode_id: s.mode_id || null,
        theme_id: s.theme_id || null,
        track_id: s.track_id || null,
        show_avatars: s.show_avatars ?? true,
        show_leaderboard: s.show_leaderboard ?? true,
        allow_team_mode: s.allow_team_mode ?? false,
        total_steps: s.total_steps || 20,
        movement_style: (s as any).movement_style || 'glide',
      });
    } else {
      setSettings(prev => ({ ...prev, group_id: groupId, agency_id: effectiveAgencyId }));
    }
    setModes(m);
    setThemes(th);
    setTeams(t);
    setPublicLink(pl);
    setPublicLinkEnabled(!!pl);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!groupId || !effectiveAgencyId) {
      toast({ title: 'Error', description: 'Missing classroom or agency. Please reload.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = { ...settings, group_id: groupId, agency_id: effectiveAgencyId };
    console.log('[GameSettings] Saving:', payload);
    const res = await upsertClassroomGameSettings(payload);
    if (res.ok) {
      toast({ title: 'Saved', description: 'Game settings updated.' });
    } else {
      console.error('[GameSettings] Save error:', res.error);
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    const idx = teams.length % TEAM_COLORS.length;
    await createTeam({
      group_id: groupId,
      agency_id: effectiveAgencyId,
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
    setPublicLinkEnabled(true);
    toast({ title: 'Link created', description: 'Public classroom link generated.' });
  };

  const copyLink = () => {
    if (!publicLink) return;
    const url = `${window.location.origin}/class/${publicLink.slug}/live`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: 'Link copied to clipboard.' });
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
            value={settings.mode_id || ''}
            onValueChange={v => setSettings(prev => ({ ...prev, mode_id: v || null }))}
          >
            <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
            <SelectContent>
              {modes.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
              {modes.length === 0 && <SelectItem value="_none" disabled>No modes available</SelectItem>}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Track Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Map className="h-4 w-4" /> Track</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TrackSelectSection groupId={groupId} trackId={settings.track_id} onTrackChange={(tid) => setSettings(prev => ({ ...prev, track_id: tid }))} />
          <div className="space-y-2">
            <Label className="text-xs">Total Track Steps</Label>
            <Input
              type="number"
              min={5}
              max={100}
              value={settings.total_steps}
              onChange={e => setSettings(prev => ({ ...prev, total_steps: parseInt(e.target.value) || 20 }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Movement Style */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Movement Style</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {MOVEMENT_STYLES.map(ms => (
              <button
                key={ms.value}
                onClick={() => setSettings(prev => ({ ...prev, movement_style: ms.value }))}
                className={cn(
                  "rounded-xl p-3 text-left border-2 transition-all",
                  settings.movement_style === ms.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/40 hover:border-primary/30"
                )}
              >
                <p className="text-sm font-semibold">{ms.label}</p>
                <p className="text-[10px] text-muted-foreground">{ms.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" /> Theme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={settings.theme_id || ''}
            onValueChange={v => setSettings(prev => ({ ...prev, theme_id: v || null }))}
          >
            <SelectTrigger><SelectValue placeholder="Select theme" /></SelectTrigger>
            <SelectContent>
              {themes.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
              {themes.length === 0 && <SelectItem value="_none" disabled>No themes yet</SelectItem>}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'show_leaderboard' as const, label: 'Leaderboard' },
            { key: 'show_avatars' as const, label: 'Show Avatars' },
            { key: 'allow_team_mode' as const, label: 'Team Mode' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <Label className="text-sm">{item.label}</Label>
              <Switch
                checked={!!settings[item.key]}
                onCheckedChange={v => setSettings(prev => ({ ...prev, [item.key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Teams */}
      {settings.allow_team_mode && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.map((t: any) => (
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Public Classroom Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {publicLink ? (
            <>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                  {window.location.origin}/class/{publicLink.slug}/live
                </code>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`/class/${publicLink.slug}/live`, '_blank')}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={handleGenerateLink}>
                Reset Link
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleGenerateLink}>
              <Link2 className="h-3 w-3 mr-1" /> Generate Link
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GameSettings;
