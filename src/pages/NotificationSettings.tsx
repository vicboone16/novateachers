import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_LABELS, type NotificationKey } from '@/lib/notifications';
import { registerPush, isPushAvailable } from '@/lib/push';
import { ArrowLeft, Bell, BellOff, Clock, Smartphone } from 'lucide-react';

interface NotifDefault {
  notification_key: string;
  label: string;
  description: string | null;
  default_enabled: boolean;
  default_schedule_time: string | null;
  category: string;
  sort_order: number;
}

interface UserPref {
  notification_key: string;
  enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  schedule_time: string | null;
}

const NotificationSettings = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [defaults, setDefaults] = useState<NotifDefault[]>([]);
  const [prefs, setPrefs] = useState<Map<string, UserPref>>(new Map());
  const [loading, setLoading] = useState(true);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [registeringPush, setRegisteringPush] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load platform defaults
      const { data: defs } = await (supabase as any)
        .from('notification_defaults')
        .select('*')
        .order('sort_order');
      setDefaults(defs || []);

      // Load user preferences
      const { data: userPrefs } = await (supabase as any)
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id);

      const prefMap = new Map<string, UserPref>();
      (userPrefs || []).forEach((p: any) => {
        prefMap.set(p.notification_key, p);
        // Extract quiet hours from first pref that has them
        if (p.quiet_start) setQuietStart(p.quiet_start.slice(0, 5));
        if (p.quiet_end) setQuietEnd(p.quiet_end.slice(0, 5));
      });
      setPrefs(prefMap);

      // Check push token
      const { data: tokens } = await (supabase as any)
        .from('push_tokens')
        .select('token')
        .eq('user_id', user.id)
        .limit(1);
      if (tokens?.length) setPushToken(tokens[0].token);
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveValue = (key: string, field: keyof UserPref): any => {
    const pref = prefs.get(key);
    if (pref) return pref[field];
    const def = defaults.find(d => d.notification_key === key);
    if (field === 'enabled') return def?.default_enabled ?? true;
    if (field === 'push_enabled') return true;
    if (field === 'in_app_enabled') return true;
    if (field === 'schedule_time') return def?.default_schedule_time ?? null;
    return null;
  };

  const togglePref = async (key: string, field: 'enabled' | 'push_enabled' | 'in_app_enabled' | 'email_enabled', newVal: boolean) => {
    if (!user) return;
    const existing = prefs.get(key);
    const row: any = {
      user_id: user.id,
      agency_id: currentWorkspace?.agency_id || null,
      notification_key: key,
      enabled: existing?.enabled ?? getEffectiveValue(key, 'enabled'),
      push_enabled: existing?.push_enabled ?? true,
      in_app_enabled: existing?.in_app_enabled ?? true,
      email_enabled: existing?.email_enabled ?? false,
      quiet_start: quietStart + ':00',
      quiet_end: quietEnd + ':00',
      updated_at: new Date().toISOString(),
      [field]: newVal,
    };

    const { error } = await (supabase as any)
      .from('notification_preferences')
      .upsert(row, { onConflict: 'user_id,notification_key' });

    if (error) {
      toast({ title: 'Error saving preference', description: error.message, variant: 'destructive' });
    } else {
      setPrefs(prev => {
        const next = new Map(prev);
        next.set(key, { ...row });
        return next;
      });
    }
  };

  const saveQuietHours = async () => {
    if (!user) return;
    // Update all existing prefs with new quiet hours
    const keys = defaults.map(d => d.notification_key);
    for (const key of keys) {
      const existing = prefs.get(key);
      const row: any = {
        user_id: user.id,
        agency_id: currentWorkspace?.agency_id || null,
        notification_key: key,
        enabled: existing?.enabled ?? getEffectiveValue(key, 'enabled'),
        push_enabled: existing?.push_enabled ?? true,
        in_app_enabled: existing?.in_app_enabled ?? true,
        email_enabled: existing?.email_enabled ?? false,
        quiet_start: quietStart + ':00',
        quiet_end: quietEnd + ':00',
        updated_at: new Date().toISOString(),
      };
      await (supabase as any)
        .from('notification_preferences')
        .upsert(row, { onConflict: 'user_id,notification_key' });
    }
    toast({ title: 'Quiet hours updated' });
  };

  const handleRegisterPush = async () => {
    if (!user) return;
    setRegisteringPush(true);
    const token = await registerPush(user.id);
    if (token) {
      setPushToken(token);
      toast({ title: 'Push notifications enabled', description: 'APNs token registered' });
    } else {
      toast({ title: 'Push not available', description: 'Push notifications require the native iOS app', variant: 'destructive' });
    }
    setRegisteringPush(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight font-heading">Notification Settings</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Configure alerts, reminders, and quiet hours</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Push Registration */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Push Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pushToken ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">Registered</Badge>
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{pushToken.slice(0, 20)}…</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {isPushAvailable()
                      ? 'Enable push notifications to receive alerts on your device.'
                      : 'Push notifications are available in the native iOS app.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleRegisterPush}
                    disabled={registeringPush}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {registeringPush ? 'Registering…' : 'Enable Push Notifications'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BellOff className="h-4 w-4 text-primary" />
                Quiet Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Silence all notifications during these hours.</p>
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={quietStart}
                    onChange={e => setQuietStart(e.target.value)}
                    className="h-8 text-sm w-28"
                  />
                </div>
                <span className="text-muted-foreground mt-5">→</span>
                <div className="space-y-1">
                  <Label className="text-xs">End</Label>
                  <Input
                    type="time"
                    value={quietEnd}
                    onChange={e => setQuietEnd(e.target.value)}
                    className="h-8 text-sm w-28"
                  />
                </div>
                <Button variant="outline" size="sm" className="mt-5" onClick={saveQuietHours}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Toggles by Category */}
          {Object.entries(NOTIFICATION_CATEGORIES).map(([catKey, cat]) => (
            <Card key={catKey} className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {cat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cat.keys.map(key => {
                  const def = defaults.find(d => d.notification_key === key);
                  const enabled = getEffectiveValue(key, 'enabled') as boolean;
                  const pushOn = getEffectiveValue(key, 'push_enabled') as boolean;
                  const inAppOn = getEffectiveValue(key, 'in_app_enabled') as boolean;

                  return (
                    <div key={key} className="rounded-lg border border-border/60 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{NOTIFICATION_LABELS[key] || def?.label || key}</p>
                          {def?.description && (
                            <p className="text-xs text-muted-foreground">{def.description}</p>
                          )}
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(val) => togglePref(key, 'enabled', val)}
                        />
                      </div>
                      {enabled && (
                        <div className="flex items-center gap-4 pl-1">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Switch
                              checked={pushOn}
                              onCheckedChange={(val) => togglePref(key, 'push_enabled', val)}
                              className="scale-75"
                            />
                            Push
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Switch
                              checked={inAppOn}
                              onCheckedChange={(val) => togglePref(key, 'in_app_enabled', val)}
                              className="scale-75"
                            />
                            In-App
                          </label>
                          {def?.default_schedule_time && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              Default: {def.default_schedule_time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

export default NotificationSettings;
