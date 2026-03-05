import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/supervisorSignals';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Check browser support for Web Speech API
const getSpeechRecognition = () => {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const BehaviorCaptureModal = ({ open, onOpenChange, clientId, agencyId, classroomId }: Props) => {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AIParseResult | null>(null);

  // Voice-to-text state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition());
  }, []);

  // Cleanup on modal close
  useEffect(() => {
    if (!open && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [open]);

  const toggleVoice = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      toast({ title: 'Voice not supported', description: 'Your browser does not support speech recognition', variant: 'destructive' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = text;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
          setText(finalTranscript);
        } else {
          interim += transcript;
        }
      }
      // Show interim text appended
      if (interim) {
        setText(finalTranscript + (finalTranscript ? ' ' : '') + interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'aborted') {
        toast({ title: 'Voice error', description: event.error, variant: 'destructive' });
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, text, toast]);

  const handleConvert = async () => {
    if (!text.trim()) return;
    setProcessing(true);
    setResult(null);

    // Stop listening if active
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    try {
      const { data, error } = await supabase.functions.invoke('parse-behavior-narrative', {
        body: { narrative: text, clientId },
      });

      if (error || !data?.events) {
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
                placeholder={isListening
                  ? 'Listening… speak now'
                  : "Describe what happened in plain language… e.g. 'Marcus threw a chair during math, then eloped from the room. Staff guided him back after 3 minutes.'"
                }
                className={cn(
                  'min-h-[120px] resize-none pr-12 transition-all',
                  isListening && 'ring-2 ring-destructive border-destructive'
                )}
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={cn(
                    'absolute right-2 top-2 rounded-full p-2 transition-all',
                    isListening
                      ? 'bg-destructive text-destructive-foreground animate-pulse shadow-lg'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </div>

            {isListening && (
              <div className="flex items-center gap-2 text-xs text-destructive font-medium">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                Recording… tap the mic or Convert when done
              </div>
            )}

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
