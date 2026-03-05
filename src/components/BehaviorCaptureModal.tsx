import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/supervisorSignals';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Wand2, Loader2 } from 'lucide-react';

interface BehaviorEvent {
  event_type: string;
  event_name: string;
  value?: number | null;
  intensity?: number | null;
  prompt_code?: string | null;
  correctness?: string | null;
  metadata?: Record<string, any>;
}

interface AIParseResult {
  events: BehaviorEvent[];
  suggested_signal?: {
    signalType: string;
    severity: string;
    title: string;
    message: string;
  } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  agencyId: string;
  classroomId?: string | null;
}

export const BehaviorCaptureModal = ({ open, onOpenChange, clientId, agencyId, classroomId }: Props) => {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AIParseResult | null>(null);

  const handleConvert = async () => {
    if (!text.trim()) return;
    setProcessing(true);
    setResult(null);

    try {
      // Try AI edge function for parsing
      const { data, error } = await supabase.functions.invoke('parse-behavior-narrative', {
        body: { narrative: text, clientId },
      });

      if (error || !data?.events) {
        // Fallback: store raw narrative as an event
        await logEvent({
          clientId,
          agencyId,
          classroomId,
          eventType: 'ai',
          eventName: 'teacher_narrative',
          metadata: { text: text.trim(), raw: true },
        });
        toast({ title: '✓ Narrative saved', description: 'Stored as raw text for later processing' });
        setText('');
        onOpenChange(false);
        return;
      }

      setResult(data as AIParseResult);
    } catch {
      // Fallback: store raw
      try {
        await logEvent({
          clientId,
          agencyId,
          classroomId,
          eventType: 'ai',
          eventName: 'teacher_narrative',
          metadata: { text: text.trim(), raw: true },
        });
        toast({ title: '✓ Narrative saved as raw text' });
      } catch (e: any) {
        toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
      }
      setText('');
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmEvents = async () => {
    if (!result?.events?.length) return;
    setProcessing(true);

    try {
      for (const evt of result.events) {
        await logEvent({
          clientId,
          agencyId,
          classroomId,
          eventType: evt.event_type,
          eventName: evt.event_name,
          value: evt.value,
          intensity: evt.intensity,
          promptCode: evt.prompt_code,
          correctness: evt.correctness,
          metadata: evt.metadata ?? {},
        });
      }
      toast({ title: `✓ ${result.events.length} events logged` });
      setResult(null);
      setText('');
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Behavior Capture Assistant
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="relative">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Describe what happened in plain language… e.g. 'Marcus threw a chair during math, then eloped from the room. Staff guided him back after 3 minutes.'"
                className="min-h-[120px] resize-none pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Voice input (coming soon)"
                disabled
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleConvert} disabled={processing || !text.trim()} className="gap-1.5">
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {processing ? 'Converting…' : 'Convert to Data'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              AI extracted <strong>{result.events.length}</strong> events from your narrative:
            </p>
            <div className="max-h-[250px] overflow-y-auto space-y-2">
              {result.events.map((evt, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-2.5 bg-muted/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary uppercase">{evt.event_type}</span>
                    <span className="text-xs text-foreground">{evt.event_name}</span>
                    {evt.intensity && (
                      <span className="text-[10px] text-destructive font-medium">Intensity: {evt.intensity}</span>
                    )}
                  </div>
                  {evt.prompt_code && (
                    <span className="text-[10px] text-muted-foreground">Prompt: {evt.prompt_code}</span>
                  )}
                </div>
              ))}
            </div>

            {result.suggested_signal && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                <p className="text-xs font-semibold text-destructive mb-1">⚠ Suggested Alert</p>
                <p className="text-xs text-foreground">{result.suggested_signal.message}</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setResult(null)}>Edit Narrative</Button>
              <Button onClick={handleConfirmEvents} disabled={processing} className="gap-1.5">
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm & Log Events
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
