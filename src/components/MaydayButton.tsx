/**
 * MaydayButton — Emergency alert button with recipient selection and multi-channel delivery.
 * Writes to Core: mayday_alerts, mayday_recipients.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
import { AlertTriangle, Send, Loader2, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Recipient {
  user_id: string;
  display_name: string;
  role: string;
}

interface Props {
  agencyId: string;
  classroomId?: string;
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

export function MaydayButton({ agencyId, classroomId, studentId, studentName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());

  const [urgency, setUrgency] = useState('high');
  const [alertType, setAlertType] = useState('safety');
  const [message, setMessage] = useState('');

  // Load potential recipients (agency staff)
  const loadRecipients = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('agency_memberships' as any)
        .select('user_id, role')
        .eq('agency_id', agencyId);

      if (!data) return;

      // Filter out current user and map
      const staff = (data as any[])
        .filter(m => m.user_id !== user?.id)
        .map(m => ({
          user_id: m.user_id,
          display_name: m.user_id.slice(0, 8) + '…',
          role: m.role || 'staff',
        }));

      setRecipients(staff);
      // Auto-select admins
      const admins = staff.filter(s => s.role === 'admin' || s.role === 'bcba' || s.role === 'supervisor');
      setSelectedRecipients(new Set(admins.map(a => a.user_id)));
    } catch { /* silent */ }
  }, [agencyId, user]);

  useEffect(() => {
    if (open) loadRecipients();
  }, [open, loadRecipients]);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const sendAlert = async () => {
    if (!user || selectedRecipients.size === 0) return;
    setSending(true);

    try {
      // 1) Create the alert
      const { data: alert, error: alertErr } = await supabase
        .from('mayday_alerts' as any)
        .insert({
          agency_id: agencyId,
          classroom_id: classroomId || null,
          student_id: studentId || null,
          triggered_by: user.id,
          alert_type: alertType,
          urgency,
          message: message.trim() || `${ALERT_TYPES.find(t => t.value === alertType)?.label} alert${studentName ? ` for ${studentName}` : ''}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (alertErr) throw alertErr;

      // 2) Insert recipients
      const recipientRows = Array.from(selectedRecipients).map(userId => ({
        alert_id: (alert as any).id,
        user_id: userId,
        delivery_channel: 'in_app',
        status: 'pending',
      }));

      await supabase
        .from('mayday_recipients' as any)
        .insert(recipientRows);

      toast({
        title: '🚨 MAYDAY Alert Sent!',
        description: `${selectedRecipients.size} recipient(s) notified`,
      });

      setOpen(false);
      setMessage('');
      setUrgency('high');
      setAlertType('safety');
    } catch (err: any) {
      toast({ title: 'Alert failed', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="gap-1.5 font-bold animate-pulse hover:animate-none"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-4 w-4" />
        MAYDAY
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Emergency Alert
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {studentName && (
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                <p className="text-sm font-medium">Student: <strong>{studentName}</strong></p>
              </div>
            )}

            {/* Alert Type */}
            <div className="space-y-1">
              <Label className="text-xs">Alert Type</Label>
              <Select value={alertType} onValueChange={setAlertType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div className="space-y-1">
              <Label className="text-xs">Urgency</Label>
              <div className="flex gap-1.5">
                {URGENCY_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setUrgency(level.value)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                      urgency === level.value ? level.color + ' border-current' : 'bg-muted border-border'
                    )}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1">
              <Label className="text-xs">Details (optional)</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe the situation…"
                rows={2}
              />
            </div>

            {/* Recipients */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Users className="h-3 w-3" />
                Notify ({selectedRecipients.size})
              </Label>
              <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                {recipients.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No staff found</p>
                ) : recipients.map(r => (
                  <label key={r.user_id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={selectedRecipients.has(r.user_id)}
                      onCheckedChange={() => toggleRecipient(r.user_id)}
                    />
                    <span className="text-xs">{r.display_name}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">{r.role}</Badge>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={sendAlert}
              disabled={sending || selectedRecipients.size === 0}
              variant="destructive"
              className="w-full gap-1.5 font-bold"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              ) : (
                <><Send className="h-4 w-4" /> Send MAYDAY Alert</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
