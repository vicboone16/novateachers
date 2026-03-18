/**
 * Engagement Sampling System
 * Toast/banner prompts at configurable intervals (5/10/15 min).
 * Teachers respond Yes/No to "Is the student engaged?"
 * Supports snooze (5 or 10 min) and disable during non-instructional blocks.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { writeUnifiedEvent } from '@/lib/unified-events';
import { writePointEntry } from '@/lib/beacon-points';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { Check, X, Clock, Bell, BellOff, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  studentId: string;
  studentName: string;
}

const INTERVAL_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
];

const SNOOZE_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
];

export const EngagementSampler = ({ studentId, studentName }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();

  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(10);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [engagedCount, setEngagedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimeRef = useRef<Date | null>(null);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowPrompt(true);
      promptTimeRef.current = new Date();
      // Haptic feedback
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }, intervalMinutes * 60 * 1000);
  }, [intervalMinutes]);

  useEffect(() => {
    if (enabled && studentId) {
      startTimer();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShowPrompt(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, studentId, startTimer]);

  const handleResponse = async (engaged: boolean) => {
    setSampleCount(prev => prev + 1);
    if (engaged) setEngagedCount(prev => prev + 1);
    setShowPrompt(false);

    // Write to unified events
    if (user) {
      writeUnifiedEvent({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        eventType: 'engagement_sample',
        eventSubtype: engaged ? 'engaged' : 'not_engaged',
        eventValue: {
          engaged,
          interval_minutes: intervalMinutes,
          prompt_time: promptTimeRef.current?.toISOString(),
          response_time: new Date().toISOString(),
        },
        sourceModule: 'engagement_sampler',
      });
    }

    // Restart timer for next sample
    startTimer();
  };

  const handleSnooze = (minutes: number) => {
    setShowPrompt(false);

    // Record snooze event in unified events
    if (user) {
      writeUnifiedEvent({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        eventType: 'snooze_event' as any,
        eventSubtype: 'engagement_prompt',
        eventValue: {
          snooze_minutes: minutes,
          prompt_time: promptTimeRef.current?.toISOString(),
          snooze_time: new Date().toISOString(),
        },
        sourceModule: 'engagement_sampler',
      });
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowPrompt(true);
      promptTimeRef.current = new Date();
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }, minutes * 60 * 1000);
  };

  const engagementPct = sampleCount > 0 ? Math.round((engagedCount / sampleCount) * 100) : null;

  return (
    <>
      {/* Engagement Sampling Banner Prompt */}
      {showPrompt && (
        <div className="fixed top-0 inset-x-0 z-[60] animate-in slide-in-from-top duration-300">
          <div className="mx-auto max-w-lg p-3">
            <div className="rounded-xl border border-primary/30 bg-card shadow-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary animate-bounce" />
                <span className="font-semibold text-foreground text-sm">
                  Engagement Check — {studentName}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Is the student currently engaged?</p>
              <div className="flex gap-2">
                <Button
                  size="lg"
                  className="flex-1 h-14 text-lg gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={() => handleResponse(true)}
                >
                  <Check className="h-5 w-5" /> Yes
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 h-14 text-lg gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => handleResponse(false)}
                >
                  <X className="h-5 w-5" /> No
                </Button>
              </div>
              <div className="flex gap-2 justify-center">
                {SNOOZE_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 text-muted-foreground"
                    onClick={() => handleSnooze(parseInt(opt.value))}
                  >
                    <Clock className="h-3 w-3" /> Snooze {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engagement Sampling Control Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Engagement Sampling
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </button>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Enable engagement sampling"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showSettings && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <Label className="text-xs whitespace-nowrap">Interval:</Label>
                <Select
                  value={String(intervalMinutes)}
                  onValueChange={v => setIntervalMinutes(parseInt(v))}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Prompts every {intervalMinutes} minutes. Snooze or disable during non-instructional time.
              </p>
            </div>
          )}

          {enabled ? (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1 text-xs">
                <Bell className="h-3 w-3" />
                Active — every {intervalMinutes}m
              </Badge>
              {engagementPct !== null && (
                <Badge variant={engagementPct >= 70 ? 'default' : 'secondary'} className="text-xs">
                  {engagementPct}% engaged ({engagedCount}/{sampleCount})
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <BellOff className="h-3 w-3" /> Sampling paused
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
};
