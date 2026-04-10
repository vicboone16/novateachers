/**
 * MaydayButton — Emergency alert with presence-aware recipient suggestions.
 * Priority: 1) same room staff  2) available support  3) floating  4) supervisors/BCBA
 * Groups recipients into "Suggested Now" and "Leadership / Supervisors".
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Send, Loader2, Shield, Users, CheckCircle, XCircle, Clock, Bell, Mail, Phone, Zap, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaydayContact {
  id: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  role_label: string;
  notify_email: boolean;
  notify_sms: boolean;
  notify_in_app: boolean;
  opt_out_days: number[];
  admin_override: boolean;
  is_active: boolean;
  user_id: string | null;
  _availableNow?: boolean;
  _presenceStatus?: string;
  _presenceLocation?: string;
  _priority?: number;
  _group?: 'suggested' | 'leadership' | 'other';
}

interface MaydayAlert {
  id: string; alert_type: string; urgency: string; message: string;
  status: string; created_at: string; acknowledged_at?: string; resolved_at?: string;
  acknowledged_by?: string; resolved_by?: string;
}

interface Props {
  agencyId: string;
  classroomId?: string;
  classroomName?: string;
  studentId?: string;
  studentName?: string;
}

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'medium', label: 'Medium', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'critical', label: 'Critical', color: 'bg-destructive/20 text-destructive' },
];

const ALERT_TYPES = [
  { value: 'safety', label: '🛡️ Safety Concern' },
  { value: 'medical', label: '🏥 Medical Emergency' },
  { value: 'behavioral', label: '⚠️ Behavioral Crisis' },
  { value: 'elopement', label: '🚪 Elopement' },
  { value: 'other', label: '📢 Other' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEADERSHIP_ROLES = ['supervisor', 'bcba', 'admin', 'director', 'lead', 'coordinator'];

const normalizeMaydayPhone = (value: string): string | null => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;

  return null;
};

export function MaydayButton({ agencyId, classroomId, classroomName, studentId, studentName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<MaydayContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [activeAlerts, setActiveAlerts] = useState<MaydayAlert[]>([]);
  const [allAlerts, setAllAlerts] = useState<MaydayAlert[]>([]);
  const [urgency, setUrgency] = useState('high');
  const [alertType, setAlertType] = useState('safety');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('send');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'room' | 'available' | 'supervisors'>('all');

  const todayDay = new Date().getDay();

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await cloudSupabase
        .from('mayday_contacts' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true);
      const allContacts = (data || []) as any as MaydayContact[];

      // Enrich with presence data — try v_mayday_candidates first, fallback to direct queries
      try {
        let presenceMap = new Map<string, any>();

        // Try the smarter v_mayday_candidates view first
        const { data: maydayCandidates, error: mcErr } = await cloudSupabase
          .from('v_mayday_candidates' as any)
          .select('*')
          .eq('agency_id', agencyId);

        if (!mcErr && maydayCandidates && maydayCandidates.length > 0) {
          for (const s of maydayCandidates as any[]) {
            presenceMap.set(s.user_id, s);
          }
        } else {
          // Fallback: query staff_presence directly
          const { data: roomStaff } = await cloudSupabase
            .from('staff_presence')
            .select('user_id, status, location_label, classroom_group_id, available_for_support, availability_status')
            .eq('agency_id', agencyId);
          for (const s of (roomStaff || []) as any[]) {
            presenceMap.set(s.user_id, s);
          }
        }

        for (const c of allContacts) {
          const isLeadership = LEADERSHIP_ROLES.some(r => (c.role_label || '').toLowerCase().includes(r));
          const sp = c.user_id ? presenceMap.get(c.user_id) : null;

          if (sp) {
            c._availableNow = true;
            c._presenceStatus = sp.status;
            c._presenceLocation = sp.location_label;
            const inSameRoom = classroomId && sp.classroom_group_id === classroomId;
            c._priority = inSameRoom ? 0 : sp.status === 'floating' ? 1 : sp.available_for_support ? 2 : 5;
            c._group = inSameRoom || sp.available_for_support || sp.status === 'floating' ? 'suggested' : isLeadership ? 'leadership' : 'other';
          } else {
            c._priority = isLeadership ? 8 : 10;
            c._group = isLeadership ? 'leadership' : 'other';
          }
        }
      } catch { /* presence data optional */ }

      allContacts.sort((a, b) => (a._priority ?? 10) - (b._priority ?? 10));
      setContacts(allContacts);

      // Auto-select available + leadership
      const available = allContacts.filter(c =>
        (c.admin_override || !(c.opt_out_days || []).includes(todayDay)) &&
        (c._group === 'suggested' || c._group === 'leadership')
      );
      setSelectedContacts(new Set(available.map(c => c.id)));
    } catch { /* silent */ }
  }, [agencyId, todayDay, classroomId]);

  const selectBestResponders = () => {
    const best = contacts.filter(c =>
      (c._group === 'suggested' || c._group === 'leadership') &&
      (c.admin_override || !(c.opt_out_days || []).includes(todayDay))
    );
    setSelectedContacts(new Set(best.map(c => c.id)));
    toast({ title: `✓ Selected ${best.length} best responders` });
  };

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await cloudSupabase.from('mayday_alerts')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.warn('[Mayday] loadAlerts error:', error.message);
        setActiveAlerts([]); setAllAlerts([]);
        return;
      }
      const alerts = (data || []) as any as MaydayAlert[];
      setActiveAlerts(alerts.filter(a => a.status === 'active' || a.status === 'acknowledged'));
      setAllAlerts(alerts);
    } catch (err) { console.warn('[Mayday] loadAlerts failed:', err); }
  }, [agencyId, user]);

  useEffect(() => {
    if (open) { loadContacts(); loadAlerts(); }
  }, [open, loadContacts, loadAlerts]);

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const sendAlert = async () => {
    if (!user || selectedContacts.size === 0) return;
    setSending(true);
    try {
      const alertMsg = message.trim() || `${ALERT_TYPES.find(t => t.value === alertType)?.label} alert${studentName ? ` for ${studentName}` : ''}`;
      
      // Insert alert into Cloud (where mayday_alerts table lives)
      let alertId: string | null = null;
      try {
        const { data: alert, error: alertErr } = await cloudSupabase.from('mayday_alerts').insert({
          agency_id: agencyId, classroom_id: classroomId || null, student_id: studentId || null,
          triggered_by: user.id, alert_type: alertType, urgency,
          message: alertMsg, status: 'active',
        }).select('id').single();
        if (alertErr) throw alertErr;
        alertId = (alert as any).id;
      } catch (insertErr) {
        console.warn('[Mayday] Alert insert failed:', insertErr);
      }

      const selected = contacts.filter(c => selectedContacts.has(c.id));
      const recipientEmails = selected
        .filter(c => c.notify_email && c.email)
        .map(c => c.email!.trim())
        .filter(Boolean);
      const recipientPhones = Array.from(new Set(
        selected
          .filter(c => c.notify_sms && c.phone)
          .map(c => normalizeMaydayPhone(c.phone!))
          .filter((phone): phone is string => Boolean(phone))
      ));

      // Insert recipient records into Cloud
      if (alertId) {
        const recipientRows = selected.map(c => ({
          mayday_id: alertId,
          recipient_user_id: c.user_id || null,
          contact_id: c.id,
          delivery_channel: c.notify_sms && c.phone ? 'sms' : 'email',
          status: 'pending',
          delivery_channels_json: JSON.stringify({
            email: c.notify_email && !!c.email,
            sms: c.notify_sms && !!c.phone,
            in_app: c.notify_in_app,
          }),
        }));
        if (recipientRows.length > 0) {
          const { error } = await cloudSupabase.from('mayday_recipients').insert(recipientRows);
          if (error) console.warn('[Mayday] recipient insert failed:', error.message);
        }
      }

      let deliveryIssue: string | null = null;

      // Always try to send notifications via edge function
      if (recipientEmails.length > 0 || recipientPhones.length > 0) {
        try {
          const { data: fnResult, error: fnError } = await invokeCloudFunction('send-mayday-alert', {
            alert_type: alertType,
            urgency,
            message: alertMsg,
            classroom_name: classroomName || null,
            student_name: studentName || null,
            triggered_by_name: user.email?.split('@')[0] || 'Staff',
            recipient_emails: recipientEmails,
            recipient_phones: recipientPhones,
          });

          if (fnError) {
            console.warn('[Mayday] Edge function error:', fnError);
            deliveryIssue = 'Notification delivery failed before the alert could be sent.';
          } else {
            console.log('[Mayday] Edge function result:', fnResult);
            const warningText = [
              ...(Array.isArray(fnResult?.warnings) ? fnResult.warnings : []),
              ...(Array.isArray(fnResult?.errors) ? fnResult.errors : []),
            ].join(' ');

            if (!fnResult?.ok) {
              deliveryIssue = warningText || 'Notification delivery was not confirmed.';
            } else if (fnResult?.partial) {
              deliveryIssue = warningText || 'Some notification channels may not have delivered.';
            }
          }
        } catch (e) {
          console.warn('[Mayday] notification send failed:', e);
          deliveryIssue = 'Could not reach the notification service.';
        }
      } else if (selected.length > 0 && recipientEmails.length === 0 && recipientPhones.length === 0) {
        toast({ title: '⚠️ No email/phone configured', description: 'Selected contacts have no email or phone for notifications.', variant: 'destructive' });
        setSending(false);
        return;
      }

      if (deliveryIssue) {
        toast({ title: '⚠️ MAYDAY created, delivery needs attention', description: deliveryIssue, variant: 'destructive' });
      } else {
        toast({ title: '🚨 MAYDAY Alert Sent!', description: `${selected.length} contact(s) notified` });
      }
      setMessage(''); setUrgency('high'); setAlertType('safety');
      loadAlerts();
      setTab('active');
    } catch (err: any) { toast({ title: 'Alert failed', description: err.message, variant: 'destructive' }); }
    finally { setSending(false); }
  };

  const updateAlertStatus = async (alertId: string, newStatus: 'acknowledged' | 'resolved') => {
    if (!user) return;
    try {
      const updateFields: any = { status: newStatus };
      if (newStatus === 'acknowledged') { updateFields.acknowledged_at = new Date().toISOString(); updateFields.acknowledged_by = user.id; }
      if (newStatus === 'resolved') { updateFields.resolved_at = new Date().toISOString(); updateFields.resolved_by = user.id; }
      const { error } = await cloudSupabase.from('mayday_alerts').update(updateFields).eq('id', alertId);
      if (error) {
        console.warn('[Mayday] updateAlertStatus failed:', error.message);
        toast({ title: 'Could not update alert', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: newStatus === 'acknowledged' ? '✓ Alert acknowledged' : '✓ Alert resolved' });
      loadAlerts();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const activeCount = activeAlerts.filter(a => a.status === 'active').length;

  const filteredContacts = (() => {
    switch (recipientFilter) {
      case 'room': return contacts.filter(c => c._group === 'suggested' && c._priority === 0);
      case 'available': return contacts.filter(c => c._availableNow);
      case 'supervisors': return contacts.filter(c => c._group === 'leadership');
      default: return contacts;
    }
  })();
  const suggestedContacts = filteredContacts.filter(c => c._group === 'suggested');
  const leadershipContacts = filteredContacts.filter(c => c._group === 'leadership');
  const otherContacts = filteredContacts.filter(c => c._group === 'other' || !c._group);

  return (
    <>
      <Button variant="destructive" size="sm" className={cn("gap-1.5 font-bold relative", activeCount > 0 && "animate-pulse hover:animate-none")} onClick={() => setOpen(true)}>
        <AlertTriangle className="h-4 w-4" /> MAYDAY
        {activeCount > 0 && <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 text-[9px] bg-background text-destructive border border-destructive px-1">{activeCount}</Badge>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-destructive"><Shield className="h-5 w-5" /> Emergency Alert</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="send" className="flex-1 gap-1 text-xs"><Send className="h-3 w-3" /> Send</TabsTrigger>
              <TabsTrigger value="active" className="flex-1 gap-1 text-xs relative">
                <Bell className="h-3 w-3" /> Active
                {activeCount > 0 && <Badge variant="destructive" className="h-4 min-w-4 text-[9px] ml-1 px-1">{activeCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 gap-1 text-xs"><Clock className="h-3 w-3" /> History</TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="space-y-4 mt-3">
              {studentName && <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3"><p className="text-sm font-medium">Student: <strong>{studentName}</strong></p></div>}
              <div className="space-y-1">
                <Label className="text-xs">Alert Type</Label>
                <Select value={alertType} onValueChange={setAlertType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ALERT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Urgency</Label>
                <div className="flex gap-1.5">
                  {URGENCY_LEVELS.map(level => (
                    <button key={level.value} onClick={() => setUrgency(level.value)} className={cn('rounded-full px-3 py-1 text-xs font-medium border transition-colors', urgency === level.value ? level.color + ' border-current' : 'bg-muted border-border')}>{level.label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Details (optional)</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the situation…" rows={2} /></div>

              {/* Recipient picker — grouped */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Notify ({selectedContacts.size})</Label>
                  <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1 px-2" onClick={selectBestResponders}>
                    <Zap className="h-2.5 w-2.5" /> Select best
                  </Button>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {(['all', 'room', 'available', 'supervisors'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setRecipientFilter(f)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-medium border transition-colors',
                        recipientFilter === f
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      {f === 'all' ? 'All' : f === 'room' ? 'Same Room' : f === 'available' ? 'Available' : 'Supervisors'}
                    </button>
                  ))}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-border p-2">
                  {filteredContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No contacts match this filter.</p>
                  ) : (
                    <>
                      {suggestedContacts.length > 0 && (
                        <ContactGroup label="Suggested Now" contacts={suggestedContacts} selectedContacts={selectedContacts} toggleContact={toggleContact} todayDay={todayDay} />
                      )}
                      {leadershipContacts.length > 0 && (
                        <ContactGroup label="Leadership / Supervisors" contacts={leadershipContacts} selectedContacts={selectedContacts} toggleContact={toggleContact} todayDay={todayDay} />
                      )}
                      {otherContacts.length > 0 && (
                        <ContactGroup label="Other Staff" contacts={otherContacts} selectedContacts={selectedContacts} toggleContact={toggleContact} todayDay={todayDay} />
                      )}
                    </>
                  )}
                </div>
              </div>
              <Button onClick={sendAlert} disabled={sending || selectedContacts.size === 0} variant="destructive" className="w-full gap-1.5 font-bold">
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send MAYDAY Alert</>}
              </Button>
            </TabsContent>

            <TabsContent value="active" className="mt-3 space-y-2">
              {activeAlerts.length === 0 ? (
                <div className="text-center py-8"><CheckCircle className="h-8 w-8 mx-auto text-accent mb-2" /><p className="text-sm text-muted-foreground">No active alerts</p></div>
              ) : activeAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} onAcknowledge={() => updateAlertStatus(alert.id, 'acknowledged')} onResolve={() => updateAlertStatus(alert.id, 'resolved')} />
              ))}
            </TabsContent>

            <TabsContent value="history" className="mt-3 space-y-2">
              {allAlerts.filter(a => a.status === 'resolved').length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No resolved alerts yet</p>
              ) : allAlerts.filter(a => a.status === 'resolved').map(alert => (
                <div key={alert.id} className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] gap-0.5"><CheckCircle className="h-2 w-2 text-accent" />Resolved</Badge>
                    <Badge variant="outline" className="text-[9px]">{ALERT_TYPES.find(t => t.value === alert.alert_type)?.label}</Badge>
                  </div>
                  {alert.message && <p className="text-xs text-muted-foreground line-clamp-1">{alert.message}</p>}
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>Created: {new Date(alert.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    {alert.resolved_at && <span>Resolved: {new Date(alert.resolved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Contact group ── */
function ContactGroup({ label, contacts, selectedContacts, toggleContact, todayDay }: {
  label: string;
  contacts: MaydayContact[];
  selectedContacts: Set<string>;
  toggleContact: (id: string) => void;
  todayDay: number;
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {contacts.map(c => {
        const isOptedOut = !c.admin_override && (c.opt_out_days || []).includes(todayDay);
        return (
          <label key={c.id} className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer",
            isOptedOut ? "opacity-50 bg-muted/30" : "hover:bg-muted/50"
          )}>
            <Checkbox checked={selectedContacts.has(c.id)} onCheckedChange={() => toggleContact(c.id)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium">{c.contact_name}</span>
                {isOptedOut && <span className="text-[9px] text-amber-600">(off {DAYS[todayDay]})</span>}
              </div>
              {(c._presenceStatus || c._presenceLocation) && (
                <p className="text-[9px] text-muted-foreground">
                  {c._presenceLocation && `📍 ${c._presenceLocation}`}
                  {c._presenceStatus && ` · ${c._presenceStatus}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="outline" className="text-[9px]">{c.role_label}</Badge>
              {c._availableNow && <Badge variant="secondary" className="text-[8px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Available</Badge>}
              {c.email && c.notify_email && <Mail className="h-2.5 w-2.5 text-muted-foreground" />}
              {c.phone && c.notify_sms && <Phone className="h-2.5 w-2.5 text-muted-foreground" />}
              {c.admin_override && <Shield className="h-2.5 w-2.5 text-destructive" />}
            </div>
          </label>
        );
      })}
    </div>
  );
}

/* ── Alert card ── */
function AlertCard({ alert, onAcknowledge, onResolve }: { alert: MaydayAlert; onAcknowledge: () => void; onResolve: () => void }) {
  return (
    <div className={cn("rounded-lg border p-3 space-y-2", alert.status === 'active' ? 'border-destructive/40 bg-destructive/5' : 'border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/10')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={alert.status === 'active' ? 'destructive' : 'outline'} className="text-[9px]">{alert.status === 'active' ? '🔴 Active' : '🟡 Acknowledged'}</Badge>
            <Badge variant="outline" className="text-[9px]">{URGENCY_LEVELS.find(u => u.value === alert.urgency)?.label}</Badge>
          </div>
          <p className="text-sm font-medium mt-1">{ALERT_TYPES.find(t => t.value === alert.alert_type)?.label}</p>
          {alert.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>}
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(alert.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {alert.status === 'active' && (
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={onAcknowledge}>
              <UserCheck className="h-3 w-3" /> ACK
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-accent" onClick={onResolve}>
            <CheckCircle className="h-3 w-3" /> Resolve
          </Button>
        </div>
      </div>
    </div>
  );
}
