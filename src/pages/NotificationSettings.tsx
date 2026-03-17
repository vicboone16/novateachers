import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { registerPush, isPushAvailable } from '@/lib/push';
import { rebuildLocalSchedules, getReminderSummary } from '@/lib/reminder-scheduler';
import { NOTIFICATION_LABELS, resolveNotificationKey } from '@/lib/notifications';
import { ArrowLeft, Bell, BellOff, Clock, Smartphone, Settings2, ChevronDown, ChevronUp, RefreshCw, Calendar, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface NotifPrefs {
  push_enabled: boolean;
  local_reminders_enabled: boolean;
  data_log_reminders: boolean;
  escalation_alerts: boolean;
  session_note_reminders: boolean;
  caregiver_messages: boolean;
  supervision_reminders: boolean;
  admin_alerts: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

interface DefaultSchedule {
  id: string;
  name: string;
  reminder_key: string;
  reminder_type: string;
  start_time: string | null;
  end_time: string | null;
  days_of_week: number[] | null;
  interval_minutes: number | null;
  allow_user_override: boolean;
  local_enabled: boolean;
  remote_enabled: boolean;
  message_title: string | null;
  message_body: string | null;
  scope_type: string;
  owner_user_id: string | null;
}

interface UserOverride {
  id: string;
  default_schedule_id: string;
  override_enabled: boolean;
  notifications_enabled: boolean;
  custom_start_time: string | null;
  custom_end_time: string | null;
  custom_days_of_week: number[] | null;
  custom_interval_minutes: number | null;
  local_enabled: boolean | null;
  remote_enabled: boolean | null;
}

interface ReminderInfo {
  key: string;
  name: string;
  nextFire: Date | null;
  source: string;
  enabled: boolean;
  type: string;
}

const PREF_TOGGLE_KEYS: { key: keyof NotifPrefs; label: string }[] = [
  { key: 'push_enabled', label: 'Push Notifications' },
  { key: 'local_reminders_enabled', label: 'Local Reminders' },
  { key: 'data_log_reminders', label: 'Data Log Reminders' },
  { key: 'escalation_alerts', label: 'Escalation Alerts' },
  { key: 'session_note_reminders', label: 'Session Note Reminders' },
  { key: 'caregiver_messages', label: 'Caregiver Messages' },
  { key: 'supervision_reminders', label: 'Supervision Reminders' },
  { key: 'admin_alerts', label: 'Admin Alerts' },
];

const NotificationSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [schedules, setSchedules] = useState<DefaultSchedule[]>([]);
  const [overrides, setOverrides] = useState<Map<string, UserOverride>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [registeringPush, setRegisteringPush] = useState(false);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const [reminderSummary, setReminderSummary] = useState<ReminderInfo[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    reminder_key: 'data_log_reminder',
    reminder_type: 'interval' as string,
    start_time: '08:00',
    end_time: '15:00',
    days_of_week: [1, 2, 3, 4, 5] as number[],
    interval_minutes: 30,
    local_enabled: true,
    remote_enabled: false,
    message_title: '',
    message_body: '',
  });

  useEffect(() => { if (user) loadSettings(); }, [user]);

  const loadReminderSummary = useCallback(async () => {
    const summary = await getReminderSummary();
    setReminderSummary(summary.map(s => ({
      ...s,
      nextFire: s.nextFire ? new Date(s.nextFire) : null,
    })));
  }, []);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: prefRows } = await (supabase as any)
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (prefRows?.length) {
        setPrefs(prefRows[0]);
      } else {
        const defaultPrefs: any = { user_id: user.id };
        await (supabase as any).from('notification_preferences').insert(defaultPrefs);
        const { data: newPrefs } = await (supabase as any)
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .limit(1);
        setPrefs(newPrefs?.[0] || null);
      }

      const { data: sched } = await (supabase as any)
        .from('default_reminder_schedules')
        .select('*')
        .eq('is_active', true)
        .order('created_at');
      setSchedules(sched || []);

      const { data: ov } = await (supabase as any)
        .from('user_reminder_overrides')
        .select('*')
        .eq('user_id', user.id);
      const ovMap = new Map<string, UserOverride>();
      (ov || []).forEach((o: any) => ovMap.set(o.default_schedule_id, o));
      setOverrides(ovMap);

      const { data: tokens } = await (supabase as any)
        .from('push_tokens')
        .select('device_token')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      if (tokens?.length) setPushToken(tokens[0].device_token);

      await loadReminderSummary();
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerRebuild = async () => {
    setRebuilding(true);
    try {
      const result = await rebuildLocalSchedules();
      toast({ title: `Schedules rebuilt`, description: `${result.scheduled} scheduled, ${result.skipped} skipped` });
      await loadReminderSummary();
    } catch (err: any) {
      toast({ title: 'Rebuild failed', description: err.message, variant: 'destructive' });
    } finally {
      setRebuilding(false);
    }
  };

  const updatePref = async (key: keyof NotifPrefs, value: boolean) => {
    if (!user || !prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    const { error } = await (supabase as any)
      .from('notification_preferences')
      .update({ [key]: value })
      .eq('user_id', user.id);
    if (error) toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    else await triggerRebuild();
  };

  const updateQuietHours = async (field: 'quiet_hours_enabled' | 'quiet_hours_start' | 'quiet_hours_end', value: any) => {
    if (!user || !prefs) return;
    const updated = { ...prefs, [field]: value };
    if (field === 'quiet_hours_enabled' && value === true && !prefs.quiet_hours_start) {
      updated.quiet_hours_start = '22:00:00';
      updated.quiet_hours_end = '07:00:00';
    }
    setPrefs(updated);
    const updateObj: any = { [field]: value };
    if (field === 'quiet_hours_enabled' && value === true && !prefs.quiet_hours_start) {
      updateObj.quiet_hours_start = '22:00:00';
      updateObj.quiet_hours_end = '07:00:00';
    }
    await (supabase as any).from('notification_preferences').update(updateObj).eq('user_id', user.id);
    await triggerRebuild();
  };

  const upsertOverride = async (scheduleId: string, changes: Partial<UserOverride>) => {
    if (!user) return;
    const existing = overrides.get(scheduleId);
    if (existing) {
      await (supabase as any)
        .from('user_reminder_overrides')
        .update(changes)
        .eq('id', existing.id);
      setOverrides(prev => {
        const next = new Map(prev);
        next.set(scheduleId, { ...existing, ...changes });
        return next;
      });
    } else {
      const row = {
        user_id: user.id,
        default_schedule_id: scheduleId,
        override_enabled: false,
        notifications_enabled: true,
        ...changes,
      };
      const { data } = await (supabase as any)
        .from('user_reminder_overrides')
        .insert(row)
        .select()
        .single();
      if (data) {
        setOverrides(prev => {
          const next = new Map(prev);
          next.set(scheduleId, data);
          return next;
        });
      }
    }
    await triggerRebuild();
  };

  const createCustomSchedule = async () => {
    if (!user || !newSchedule.name.trim()) return;
    setCreating(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const row = {
        scope_type: 'user',
        owner_user_id: user.id,
        created_by: user.id,
        role_scope: 'teacher',
        name: newSchedule.name.trim(),
        reminder_key: newSchedule.reminder_key,
        reminder_type: newSchedule.reminder_type,
        timezone: tz,
        is_active: true,
        allow_user_override: true,
        local_enabled: newSchedule.local_enabled,
        remote_enabled: newSchedule.remote_enabled,
        start_time: newSchedule.start_time + ':00',
        end_time: newSchedule.end_time + ':00',
        days_of_week: newSchedule.days_of_week,
        interval_minutes: newSchedule.reminder_type === 'interval' ? newSchedule.interval_minutes : null,
        message_title: newSchedule.message_title || newSchedule.name.trim(),
        message_body: newSchedule.message_body || 'Tap to take action.',
        app_environment: 'beta',
      };
      const { error } = await (supabase as any).from('default_reminder_schedules').insert(row);
      if (error) throw error;
      toast({ title: 'Schedule created', description: newSchedule.name });
      setShowCreateForm(false);
      setNewSchedule(s => ({ ...s, name: '', message_title: '', message_body: '' }));
      await loadSettings();
    } catch (err: any) {
      toast({ title: 'Failed to create', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const deleteCustomSchedule = async (schedId: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from('default_reminder_schedules')
      .delete()
      .eq('id', schedId)
      .eq('owner_user_id', user.id)
      .eq('scope_type', 'user');
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Schedule deleted' });
      await loadSettings();
    }
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

  const formatTime = (t: string | null) => t ? t.slice(0, 5) : '--:--';
  const formatDays = (days: number[] | null) => {
    if (!days?.length) return 'No days';
    return days.map(d => DAY_LABELS[d] || d).join(', ');
  };

  const getNextFireForSchedule = (scheduleId: string): Date | null => {
    const sched = schedules.find(s => s.id === scheduleId);
    if (!sched) return null;
    const key = resolveNotificationKey(sched.reminder_key);
    const info = reminderSummary.find(r => r.key === key);
    return info?.nextFire || null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight font-heading">Notification Settings</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Configure alerts, reminders, and quiet hours</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={triggerRebuild} disabled={rebuilding}>
          <RefreshCw className={`h-3.5 w-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
          Rebuild
        </Button>
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
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">
                  {isPushAvailable() ? '✅ Native' : '📱 Web only'}
                </Badge>
                {pushToken && (
                  <>
                    <Badge variant="outline" className="text-xs text-primary border-primary/30">Registered</Badge>
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">{pushToken.slice(0, 20)}…</span>
                  </>
                )}
              </div>
              {!pushToken && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRegisterPush} disabled={registeringPush}>
                  <Bell className="h-3.5 w-3.5" />
                  {registeringPush ? 'Registering…' : 'Enable Push Notifications'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Global Toggles */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Global Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {PREF_TOGGLE_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={prefs?.[key] as boolean ?? true}
                    onCheckedChange={(val) => updatePref(key, val)}
                  />
                </div>
              ))}
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
              <div className="flex items-center justify-between">
                <Label className="text-sm">Enable Quiet Hours</Label>
                <Switch
                  checked={prefs?.quiet_hours_enabled ?? false}
                  onCheckedChange={(val) => updateQuietHours('quiet_hours_enabled', val)}
                />
              </div>
              {prefs?.quiet_hours_enabled && (
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input
                      type="time"
                      value={(prefs.quiet_hours_start || '22:00:00').slice(0, 5)}
                      onChange={e => updateQuietHours('quiet_hours_start', e.target.value + ':00')}
                      className="h-8 text-sm w-28"
                    />
                  </div>
                  <span className="text-muted-foreground mt-5">→</span>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <Input
                      type="time"
                      value={(prefs.quiet_hours_end || '07:00:00').slice(0, 5)}
                      onChange={e => updateQuietHours('quiet_hours_end', e.target.value + ':00')}
                      className="h-8 text-sm w-28"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reminder Schedules with Override Controls */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Reminder Schedules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Override default reminder schedules. Locked reminders cannot be customized.
              </p>
              {schedules.map(sched => {
                const ov = overrides.get(sched.id);
                const isExpanded = expandedSchedule === sched.id;
                const isEnabled = ov?.notifications_enabled ?? true;
                const isOverridden = ov?.override_enabled ?? false;
                const canOverride = sched.allow_user_override;
                const nextFire = getNextFireForSchedule(sched.id);
                const resolvedKey = resolveNotificationKey(sched.reminder_key);
                const summaryItem = reminderSummary.find(r => r.key === resolvedKey);

                return (
                  <div key={sched.id} className="rounded-lg border border-border/60 overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedSchedule(isExpanded ? null : sched.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{sched.name}</p>
                          <Badge variant="outline" className="text-[9px]">{sched.reminder_type.replace(/_/g, ' ')}</Badge>
                          {sched.local_enabled && <Badge variant="secondary" className="text-[9px]">Local</Badge>}
                          {sched.remote_enabled && <Badge variant="secondary" className="text-[9px]">Remote</Badge>}
                          {!canOverride && <Badge variant="destructive" className="text-[9px]">Locked</Badge>}
                          {sched.scope_type === 'user' && <Badge className="text-[9px] bg-accent text-accent-foreground">My Schedule</Badge>}
                          {summaryItem && (
                            <Badge variant="outline" className="text-[8px] text-muted-foreground">
                              src: {summaryItem.source}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {sched.interval_minutes ? `Every ${sched.interval_minutes}min` : ''}
                          {sched.start_time ? ` ${formatTime(sched.start_time)}` : ''}
                          {sched.end_time ? `–${formatTime(sched.end_time)}` : ''}
                          {sched.days_of_week ? ` · ${formatDays(sched.days_of_week)}` : ''}
                          {nextFire && (
                            <span className="ml-2 text-primary">
                              ⏱ Next: {nextFire.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sched.scope_type === 'user' && sched.owner_user_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteCustomSchedule(sched.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(val) => upsertOverride(sched.id, { notifications_enabled: val })}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isExpanded && isEnabled && (
                      <div className="border-t border-border/40 p-3 space-y-3 bg-muted/10">
                        {canOverride ? (
                          <>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs flex items-center gap-1.5">
                                <Settings2 className="h-3 w-3" /> Customize My Schedule
                              </Label>
                              <Switch
                                checked={isOverridden}
                                onCheckedChange={(val) => upsertOverride(sched.id, { override_enabled: val })}
                              />
                            </div>

                            {isOverridden && (
                              <div className="space-y-3 pl-1">
                                {sched.interval_minutes !== null && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Interval (minutes)</Label>
                                    <Input
                                      type="number"
                                      min={5}
                                      max={240}
                                      value={ov?.custom_interval_minutes ?? sched.interval_minutes ?? ''}
                                      onChange={e => upsertOverride(sched.id, { custom_interval_minutes: parseInt(e.target.value) || null })}
                                      className="h-8 text-sm w-24"
                                    />
                                  </div>
                                )}
                                <div className="flex gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Start Time</Label>
                                    <Input
                                      type="time"
                                      value={(ov?.custom_start_time || sched.start_time || '').slice(0, 5)}
                                      onChange={e => upsertOverride(sched.id, { custom_start_time: e.target.value + ':00' })}
                                      className="h-8 text-sm w-28"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">End Time</Label>
                                    <Input
                                      type="time"
                                      value={(ov?.custom_end_time || sched.end_time || '').slice(0, 5)}
                                      onChange={e => upsertOverride(sched.id, { custom_end_time: e.target.value + ':00' })}
                                      className="h-8 text-sm w-28"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Days of Week</Label>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {[1, 2, 3, 4, 5, 6, 7].map(d => {
                                      const currentDays = ov?.custom_days_of_week ?? sched.days_of_week ?? [];
                                      const isActive = currentDays.includes(d);
                                      return (
                                        <Button
                                          key={d}
                                          variant={isActive ? 'default' : 'outline'}
                                          size="sm"
                                          className="h-7 w-10 text-xs px-0"
                                          onClick={() => {
                                            const newDays = isActive
                                              ? currentDays.filter((x: number) => x !== d)
                                              : [...currentDays, d].sort();
                                            upsertOverride(sched.id, { custom_days_of_week: newDays });
                                          }}
                                        >
                                          {DAY_LABELS[d]}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <Separator />
                                <div className="flex gap-4">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={ov?.local_enabled ?? sched.local_enabled}
                                      onCheckedChange={(val) => upsertOverride(sched.id, { local_enabled: val })}
                                    />
                                    <Label className="text-xs">Local</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={ov?.remote_enabled ?? sched.remote_enabled}
                                      onCheckedChange={(val) => upsertOverride(sched.id, { remote_enabled: val })}
                                    />
                                    <Label className="text-xs">Remote</Label>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            This reminder is managed by your organization and cannot be customized.
                          </p>
                        )}

                        {sched.message_title && (
                          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                            <span className="font-medium">Preview:</span> {sched.message_title} — {sched.message_body}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {schedules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No reminder schedules configured.</p>
              )}
            </CardContent>
          </Card>

          {/* Reminder Summary */}
          {reminderSummary.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Effective Schedule Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {reminderSummary.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${r.enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    <span className="text-xs font-medium flex-1 truncate">{r.name}</span>
                    <Badge variant="outline" className="text-[8px]">{r.source}</Badge>
                    <Badge variant="outline" className="text-[8px]">{r.type.replace(/_/g, ' ')}</Badge>
                    {r.nextFire ? (
                      <span className="text-[10px] text-primary font-mono">
                        {r.nextFire.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationSettings;
