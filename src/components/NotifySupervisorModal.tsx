import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createSignal, type SignalSeverity, type SignalType } from '@/lib/supervisorSignals';
import { AlertTriangle, Send } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  agencyId: string;
  classroomId?: string | null;
}

const REASON_OPTIONS: { value: SignalType; label: string }[] = [
  { value: 'escalation', label: 'Escalation' },
  { value: 'incident', label: 'Incident' },
  { value: 'safety_concern', label: 'Safety Concern' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS: { value: SignalSeverity; label: string; color: string }[] = [
  { value: 'watch', label: 'Watch', color: 'bg-yellow-500' },
  { value: 'action', label: 'Action', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-destructive' },
];

export const NotifySupervisorModal = ({ open, onOpenChange, clientId, agencyId, classroomId }: Props) => {
  const { toast } = useToast();
  const [reason, setReason] = useState<SignalType>('escalation');
  const [severity, setSeverity] = useState<SignalSeverity>('watch');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    setSending(true);
    try {
      await createSignal({
        clientId,
        agencyId,
        classroomId,
        signalType: reason,
        severity,
        title: `Teacher alert: ${REASON_OPTIONS.find(r => r.value === reason)?.label}`,
        message: notes || `Teacher flagged ${reason} concern`,
        drivers: { reason, teacher_notes: notes },
        source: { app: 'beacon', trigger: 'manual_notify' },
      });
      toast({ title: '✓ Supervisor notified' });
      setNotes('');
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Failed to notify', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Notify Supervisor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as SignalType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Severity</Label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSeverity(s.value)}
                  className={`flex-1 rounded-lg border p-2.5 text-center text-sm font-medium transition-all ${
                    severity === s.value
                      ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full ${s.color} mx-auto mb-1`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe what's happening…"
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={sending} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending…' : 'Send Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
