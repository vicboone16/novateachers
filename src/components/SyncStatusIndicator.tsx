import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Loader2, CloudOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getQueueLength, flushQueue } from '@/lib/sync-queue';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error' | 'queued';

interface Props {
  lastStatus: SyncState;
  className?: string;
}

export function SyncStatusIndicator({ lastStatus, className }: Props) {
  const { toast } = useToast();
  const [queueCount, setQueueCount] = useState(getQueueLength);
  const [flushing, setFlushing] = useState(false);

  // Poll queue length
  useEffect(() => {
    const interval = setInterval(() => setQueueCount(getQueueLength()), 3000);
    return () => clearInterval(interval);
  }, []);

  // Update after status change
  useEffect(() => {
    setQueueCount(getQueueLength());
  }, [lastStatus]);

  // Auto-flush when coming back online
  useEffect(() => {
    const handler = async () => {
      if (getQueueLength() > 0) {
        setFlushing(true);
        const result = await flushQueue();
        setQueueCount(result.remaining);
        setFlushing(false);
        if (result.flushed > 0) {
          toast({ title: `✓ Synced ${result.flushed} queued record(s)` });
        }
      }
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [toast]);

  const handleRetry = useCallback(async () => {
    setFlushing(true);
    const result = await flushQueue();
    setQueueCount(result.remaining);
    setFlushing(false);
    if (result.flushed > 0) {
      toast({ title: `✓ Synced ${result.flushed} queued record(s)` });
    }
    if (result.remaining > 0) {
      toast({ title: `${result.remaining} record(s) still pending`, variant: 'destructive' });
    }
  }, [toast]);

  // Show nothing when idle and no queue
  if (lastStatus === 'idle' && queueCount === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* Current write status */}
      {lastStatus === 'syncing' && (
        <Badge variant="secondary" className="gap-1 text-[10px] px-2 py-0.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </Badge>
      )}
      {lastStatus === 'success' && queueCount === 0 && (
        <Badge variant="secondary" className="gap-1 text-[10px] px-2 py-0.5 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" /> Synced
        </Badge>
      )}
      {lastStatus === 'error' && (
        <Badge variant="destructive" className="gap-1 text-[10px] px-2 py-0.5">
          <AlertCircle className="h-3 w-3" /> Write failed
        </Badge>
      )}

      {/* Queued items indicator */}
      {queueCount > 0 && (
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="gap-1 text-[10px] px-2 py-0.5 border-amber-500 text-amber-600 dark:text-amber-400">
            <CloudOff className="h-3 w-3" /> {queueCount} queued
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={handleRetry}
            disabled={flushing}
          >
            <RefreshCw className={cn('h-3 w-3', flushing && 'animate-spin')} />
          </Button>
        </div>
      )}
    </div>
  );
}
