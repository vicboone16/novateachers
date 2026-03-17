/**
 * Dedicated Data Collection page — student-specific view containing
 * Quick Add behavior buttons, Trigger Tracker, ABC, Skill Probe,
 * and Engagement Sampling all in one place.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, normalizeClient, displayName } from '@/lib/student-utils';
import { writeUnifiedEvent } from '@/lib/unified-events';
import { writeWithRetry } from '@/lib/sync-queue';
import { SyncStatusIndicator, type SyncState } from '@/components/SyncStatusIndicator';
import { EngagementSampler } from '@/components/EngagementSampler';
import { SkillProbe } from '@/components/SkillProbe';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, Hand, DoorOpen, Bomb, Megaphone, ShieldX,
  ClipboardList, Target, Bell, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client } from '@/lib/types';
import { useRef } from 'react';

const QUICK_BEHAVIORS = [
  { name: 'Aggression', icon: Hand, color: 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20' },
  { name: 'Elopement', icon: DoorOpen, color: 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/20' },
  { name: 'Property Destruction', icon: Bomb, color: 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20' },
  { name: 'Major Disruption', icon: Megaphone, color: 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20' },
  { name: 'Noncompliance', icon: ShieldX, color: 'bg-muted border-border text-foreground hover:bg-muted/80' },
];

const DataCollection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('student') || '');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncState>('idle');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const markSync = (status: SyncState) => {
    setSyncStatus(status);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (status === 'success') {
      syncTimerRef.current = setTimeout(() => setSyncStatus('idle'), 4000);
    }
  };

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (selectedClientId) loadSelectedClient();
  }, [selectedClientId]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      const normalized = normalizeClients(data);
      setClients(normalized);
      // Auto-select if only one or if URL param matches
      if (selectedClientId && normalized.find(c => c.id === selectedClientId)) {
        // keep selection
      } else if (normalized.length === 1) {
        setSelectedClientId(normalized[0].id);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const loadSelectedClient = async () => {
    if (!selectedClientId) { setSelectedClient(null); return; }
    // Check local list first
    const local = clients.find(c => c.id === selectedClientId);
    if (local) { setSelectedClient(local); return; }
    // Fetch from Core
    const { data } = await supabase.from('clients').select('*').eq('id', selectedClientId).single();
    if (data) setSelectedClient(normalizeClient(data));
  };

  const handleQuickBehavior = async (behaviorName: string) => {
    if (!selectedClientId || !user) {
      toast({ title: 'Select a student first', variant: 'destructive' });
      return;
    }
    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(15);

    markSync('syncing');
    try {
      const result = await writeWithRetry('teacher_frequency_entries', {
        agency_id: effectiveAgencyId,
        client_id: selectedClientId,
        user_id: user.id,
        behavior_name: behaviorName,
        count: 1,
        logged_date: new Date().toISOString().slice(0, 10),
      });

      // Also write to unified event stream
      writeUnifiedEvent({
        studentId: selectedClientId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        eventType: 'behavior_event',
        eventSubtype: 'frequency',
        eventValue: { behavior: behaviorName, count: 1 },
        sourceModule: 'data_collection',
      });

      if (!result.ok) {
        markSync('queued');
        toast({ title: 'Offline — queued for sync' });
      } else {
        markSync('success');
        toast({ title: `✓ ${behaviorName} logged` });
      }
    } catch (err: any) {
      markSync('error');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight font-heading flex items-center gap-2">
            <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Data Collection
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Record behaviors, probes, and engagement</p>
        </div>
        <SyncStatusIndicator lastStatus={syncStatus} />
      </div>

      {/* Student selector */}
      <div className="w-full sm:max-w-xs">
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select student…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedClientId && (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Select a student to begin data collection</p>
          </CardContent>
        </Card>
      )}

      {selectedClientId && selectedClient && (
        <div className="space-y-6">
          {/* Quick Add Behavior Buttons */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Quick Add Behavior
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {QUICK_BEHAVIORS.map(({ name, icon: Icon, color }) => (
                  <button
                    key={name}
                    onClick={() => handleQuickBehavior(name)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
                      color,
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Navigation to Trigger Tracker for ABC */}
          <Card className="border-border/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">ABC / Trigger Tracker</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/tracker')}>
                  Open Tracker
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Sampler */}
          <EngagementSampler
            studentId={selectedClientId}
            studentName={displayName(selectedClient)}
          />

          {/* Skill Probe */}
          <SkillProbe
            studentId={selectedClientId}
            studentName={displayName(selectedClient)}
          />

          {/* Link to Data Summary */}
          <Card className="border-border/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Weekly Data Summary</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/data-summary')}>
                  View Summary
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DataCollection;
