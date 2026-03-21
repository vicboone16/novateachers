/**
 * MaydayButton — Emergency alert with lifecycle: active → acknowledged → resolved.
 * Senders pick which contacts to notify from mayday_contacts + agency_memberships.
 * Recipients can have opt-out days; admin override bypasses opt-out.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
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
import { AlertTriangle, Send, Loader2, Shield, Users, CheckCircle, XCircle, Clock, Bell, Mail, Phone } from 'lucide-react';
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

  const todayDay = new Date().getDay(); // 0=Sun

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await cloudSupabase
        .from('mayday_contacts' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true);
      const allContacts = (data || []) as any as MaydayContact[];

      // Also pull available support staff from presence system
      try {
        const { data: supportStaff } = await supabase
          .from('v_available_support_staff' as any)
          .select('user_id, availability_status, location_label')
          .eq('agency_id', agencyId);
        const supportIds = new Set((supportStaff || []).map((s: any) => s.user_id));
        // Tag contacts whose user_id is in available support staff
        for (const c of allContacts) {
          if (c.user_id && supportIds.has(c.user_id)) {
            (c as any)._availableNow = true;
          }
        }
      } catch { /* presence data optional */ }

      setContacts(allContacts);
      // Auto-select contacts that are available today (not opted out, or admin override)
      const available = allContacts.filter(c =>
        c.admin_override || !(c.opt_out_days || []).includes(todayDay)
      );
      setSelectedContacts(new Set(available.map(c => c.id)));
    } catch { /* silent */ }
  }, [agencyId, todayDay]);

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('mayday_alerts' as any).select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(20);
      const alerts = (data || []) as any as MaydayAlert[];
      setActiveAlerts(alerts.filter(a => a.status === 'active' || a.status === 'acknowledged'));
      setAllAlerts(alerts);
    } catch { /* silent */ }
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

      // Create alert in Core
      const { data: alert, error: alertErr } = await supabase.from('mayday_alerts' as any).insert({
        agency_id: agencyId, classroom_id: classroomId || null, student_id: studentId || null,
        triggered_by: user.id, alert_type: alertType, urgency,
        message: alertMsg, status: 'active',
      }).select('id').single();
      if (alertErr) throw alertErr;

      // Gather selected contacts
      const selected = contacts.filter(c => selectedContacts.has(c.id));
      const recipientEmails = selected.filter(c => c.notify_email && c.email).map(c => c.email!);
      const recipientPhones = selected.filter(c => c.notify_sms && c.phone).map(c => c.phone!);

      // Log recipients
      const recipientRows = selected
        .filter(c => c.user_id)
        .map(c => ({
          alert_id: (alert as any).id, user_id: c.user_id, delivery_channel: 'in_app', status: 'pending',
        }));
      if (recipientRows.length > 0) {
        await supabase.from('mayday_recipients' as any).insert(recipientRows);
      }

      // Send via edge function (email + SMS phone numbers)
      if (recipientEmails.length > 0 || recipientPhones.length > 0) {
        try {
          await cloudSupabase.functions.invoke('send-mayday-alert', {
            body: {
              alert_type: alertType, urgency, message: alertMsg,
              classroom_name: classroomName || null, student_name: studentName || null,
              triggered_by_name: user.email?.split('@')[0] || 'Staff',
              recipient_emails: recipientEmails,
              recipient_phones: recipientPhones,
            },
          });
        } catch (e) { console.warn('[Mayday] notification send failed:', e); }
      }

      toast({ title: '🚨 MAYDAY Alert Sent!', description: `${selected.length} contact(s) notified` });
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
      await supabase.from('mayday_alerts' as any).update(updateFields).eq('id', alertId);
      toast({ title: newStatus === 'acknowledged' ? '✓ Alert acknowledged' : '✓ Alert resolved' });
      loadAlerts();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const activeCount = activeAlerts.filter(a => a.status === 'active').length;

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

              {/* Recipient picker */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Notify ({selectedContacts.size} of {contacts.length})</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                  {contacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No mayday contacts configured. Add them in Admin → Mayday Contacts.</p>
                  ) : contacts.map(c => {
                    const isOptedOut = !c.admin_override && (c.opt_out_days || []).includes(todayDay);
                    return (
                      <label key={c.id} className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer",
                        isOptedOut ? "opacity-50 bg-muted/30" : "hover:bg-muted/50"
                      )}>
                        <Checkbox
                          checked={selectedContacts.has(c.id)}
                          onCheckedChange={() => toggleContact(c.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">{c.contact_name}</span>
                          {isOptedOut && <span className="text-[9px] text-amber-600 ml-1">(off {DAYS[todayDay]})</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className="text-[9px]">{c.role_label}</Badge>
                          {(c as any)._availableNow && <Badge variant="secondary" className="text-[8px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Available</Badge>}
                          {c.email && c.notify_email && <Mail className="h-2.5 w-2.5 text-muted-foreground" />}
                          {c.phone && c.notify_sms && <Phone className="h-2.5 w-2.5 text-muted-foreground" />}
                          {c.admin_override && <Shield className="h-2.5 w-2.5 text-destructive" />}
                        </div>
                      </label>
                    );
                  })}
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
          {alert.acknowledged_at && <p className="text-[10px] text-muted-foreground">✓ Acknowledged {new Date(alert.acknowledged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
        </div>
      </div>
      <div className="flex gap-1.5">
        {alert.status === 'active' && (
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-amber-300 text-amber-700 dark:text-amber-300" onClick={onAcknowledge}>
            <CheckCircle className="h-3 w-3" /> Acknowledge
          </Button>
        )}
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-accent text-accent-foreground" onClick={onResolve}>
          <XCircle className="h-3 w-3" /> Resolve
        </Button>
      </div>
    </div>
  );
}
