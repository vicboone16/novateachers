/**
 * RewardsPage — Beacon Points & Rewards management with redemption history tab.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { getStudentBalances, writePointEntry } from '@/lib/beacon-points';
import { ReinforcerStore } from '@/components/ReinforcerStore';
import { TokenBoard } from '@/components/TokenBoard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Star, Gift, History, Trophy, Sparkles, ShoppingBag, Plus, Minus, Pencil, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/lib/types';

interface PointHistory {
  id: string; student_id: string; points: number; reason: string | null; source: string; created_at: string;
}

interface RedemptionRecord {
  id: string; student_id: string; reward_id: string; points_spent: number; created_at: string;
  reward_name?: string; reward_emoji?: string;
}

const RewardsPage = () => {
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId } = useAppAccess();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const { groupId: activeGroupId } = useActiveClassroom();

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  useEffect(() => { if (currentWorkspace) loadData(); }, [currentWorkspace]);

  // Realtime: refresh balances when ledger changes
  useEffect(() => {
    if (!user) return;
    const channel = cloudSupabase.channel('rewards-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'beacon_points_ledger' }, () => {
        if (clients.length > 0) {
          const ids = clients.map(c => c.id);
          getStudentBalances(user.id, ids).then(setBalances);
        }
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [user, clients]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user.id });
      const normalized = normalizeClients(data);
      setClients(normalized);

      const clientIds = normalized.map(c => c.id);
      const bals = await getStudentBalances(user.id, clientIds);
      setBalances(bals);

      const { data: histData } = await cloudSupabase.from('beacon_points_ledger').select('*').eq('staff_id', user.id).order('created_at', { ascending: false }).limit(50);
      setHistory((histData || []) as any as PointHistory[]);

      // Load redemptions with reward info (Core schema: redeemed_at not created_at)
      const { data: redeemData } = await supabase.from('beacon_reward_redemptions' as any).select('*').eq('agency_id', effectiveAgencyId).order('redeemed_at', { ascending: false }).limit(30);
      const recs = (redeemData || []) as any as RedemptionRecord[];

      // Enrich with reward names (Core beacon_rewards uses scope_type/scope_id, not agency_id)
      if (recs.length > 0) {
        const rewardIds = [...new Set(recs.map(r => r.reward_id))];
        const { data: rwds } = await supabase.from('beacon_rewards' as any).select('id, name').in('id', rewardIds);
        const rewardMap = new Map((rwds || []).map((r: any) => [r.id, r]));
        for (const rec of recs) {
          const rwd = rewardMap.get(rec.reward_id) as any;
          if (rwd) { rec.reward_name = rwd.name; rec.reward_emoji = '🎁'; }
        }
      }
      setRedemptions(recs);
    } catch (err: any) {
      console.warn('[Rewards] loadData error:', err);
      setLoadError(err.message || 'Failed to load rewards data.');
    }
    setLoading(false);
  };

  const { toast } = useToast();
  const [adjustStudent, setAdjustStudent] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const handlePointChange = (studentId: string, delta: number) => {
    setBalances(prev => ({ ...prev, [studentId]: (prev[studentId] || 0) + delta }));
  };

  const handlePointOverride = async (studentId: string) => {
    if (!user || !adjustAmount) return;
    const pts = parseInt(adjustAmount);
    if (isNaN(pts) || pts === 0) return;
    setAdjusting(true);
    try {
      await writePointEntry({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        points: pts,
        reason: adjustReason || (pts > 0 ? 'Manual adjustment (+)' : 'Manual adjustment (−)'),
        source: 'manual',
        entryKind: 'manual',
      });
      handlePointChange(studentId, pts);
      const name = clients.find(c => c.id === studentId);
      toast({ title: `${pts > 0 ? '+' : ''}${pts} pts → ${name ? displayName(name) : 'Student'}` });
      setAdjustStudent(null);
      setAdjustAmount('');
      setAdjustReason('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAdjusting(false);
  };

  const [resetting, setResetting] = useState(false);

  const handleResetStudent = async (studentId: string) => {
    if (!user) return;
    const currentBal = balances[studentId] || 0;
    if (currentBal === 0) { toast({ title: 'Already at 0' }); return; }
    if (!confirm(`Reset ${clients.find(c => c.id === studentId) ? displayName(clients.find(c => c.id === studentId)!) : 'student'} to 0 points?`)) return;
    setResetting(true);
    try {
      await writePointEntry({
        studentId,
        staffId: user.id,
        agencyId: effectiveAgencyId,
        points: -currentBal,
        reason: 'Points reset to 0',
        source: 'manual',
        entryKind: 'reset',
      });
      setBalances(prev => ({ ...prev, [studentId]: 0 }));
      toast({ title: `${clients.find(c => c.id === studentId) ? displayName(clients.find(c => c.id === studentId)!) : 'Student'} reset to 0 ⭐` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setResetting(false);
  };

  const handleResetAll = async () => {
    if (!user || clients.length === 0) return;
    const nonZero = clients.filter(c => (balances[c.id] || 0) !== 0);
    if (nonZero.length === 0) { toast({ title: 'All students already at 0' }); return; }
    if (!confirm(`Reset ALL ${nonZero.length} students to 0 points? This cannot be undone.`)) return;
    setResetting(true);
    try {
      for (const c of nonZero) {
        const bal = balances[c.id] || 0;
        await writePointEntry({
          studentId: c.id,
          staffId: user.id,
          agencyId: effectiveAgencyId,
          points: -bal,
          reason: 'Class-wide points reset',
          source: 'manual',
          entryKind: 'reset',
        });
      }
      setBalances(prev => {
        const next = { ...prev };
        nonZero.forEach(c => { next[c.id] = 0; });
        return next;
      });
      toast({ title: `${nonZero.length} students reset to 0 ⭐` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setResetting(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 flex-col gap-2">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-xs text-muted-foreground">Loading rewards…</p>
    </div>
  );

  if (loadError) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center space-y-3 max-w-xs mx-auto">
        <Gift className="h-10 w-10 mx-auto text-destructive/60" />
        <p className="text-sm font-medium text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
      </div>
    </div>
  );

  if (!loading && clients.length === 0) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center space-y-3">
        <Star className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No students found.</p>
        <p className="text-xs text-muted-foreground">Add students to your classroom to start using rewards.</p>
        <Button variant="outline" size="sm" onClick={loadData}>Retry</Button>
      </div>
    </div>
  );

  const totalPoints = Object.values(balances).reduce((s, v) => s + v, 0);
  const studentOptions = clients.map(c => ({ id: c.id, name: displayName(c), balance: balances[c.id] || 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> Beacon Points & Rewards</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Manage points, token boards, and reward store</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="border-border/40"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-amber-500">{totalPoints}</p><p className="text-[10px] text-muted-foreground">Total Points</p></CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{clients.length}</p><p className="text-[10px] text-muted-foreground">Students</p></CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-accent">{history.filter(h => h.points > 0).length}</p><p className="text-[10px] text-muted-foreground">Awards Today</p></CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{redemptions.length}</p><p className="text-[10px] text-muted-foreground">Redemptions</p></CardContent></Card>
      </div>

      <Tabs defaultValue="store" className="space-y-4">
        <TabsList>
          <TabsTrigger value="store" className="gap-1.5 text-xs"><ShoppingBag className="h-3.5 w-3.5" /> Store</TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5 text-xs"><Trophy className="h-3.5 w-3.5" /> Balances</TabsTrigger>
          <TabsTrigger value="tokens" className="gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" /> Tokens</TabsTrigger>
          <TabsTrigger value="redemptions" className="gap-1.5 text-xs"><Gift className="h-3.5 w-3.5" /> Redemptions</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="store">
          <ReinforcerStore agencyId={effectiveAgencyId} classroomId={activeGroupId || undefined} students={studentOptions} onRedemption={loadData} showInactive />
        </TabsContent>

        <TabsContent value="balances">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map(c => (
              <Card key={c.id} className="border-border/40">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{displayName(c).charAt(0)}</div>
                      <div><p className="text-sm font-semibold">{displayName(c)}</p>{c.grade && <p className="text-[10px] text-muted-foreground">Grade {c.grade}</p>}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className="gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"><Star className="h-3 w-3 fill-amber-500 text-amber-500" />{balances[c.id] || 0}</Badge>
                      <Popover open={adjustStudent === c.id} onOpenChange={(o) => { if (!o) setAdjustStudent(null); else { setAdjustStudent(c.id); setAdjustAmount(''); setAdjustReason(''); } }}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3 space-y-2" align="end">
                          <p className="text-xs font-semibold">Adjust Points</p>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAdjustAmount(String((parseInt(adjustAmount) || 0) - 1))}><Minus className="h-3 w-3" /></Button>
                            <Input value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="±pts" className="h-7 text-xs text-center" type="number" />
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAdjustAmount(String((parseInt(adjustAmount) || 0) + 1))}><Plus className="h-3 w-3" /></Button>
                          </div>
                          <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Reason (optional)" className="h-7 text-xs" />
                          <Button size="sm" className="w-full h-7 text-xs" disabled={adjusting || !adjustAmount || parseInt(adjustAmount) === 0} onClick={() => handlePointOverride(c.id)}>
                            {adjusting ? 'Saving…' : 'Apply'}
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tokens">
          {activeGroupId ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map(c => (
                <TokenBoard key={c.id} studentId={c.id} studentName={displayName(c)} agencyId={effectiveAgencyId} classroomId={activeGroupId} balance={balances[c.id] || 0} onPointChange={handlePointChange} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-2"><CardContent className="py-8 text-center text-muted-foreground text-sm">No classroom selected</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="redemptions">
          <Card className="border-border/40">
            <CardContent className="p-0">
              {redemptions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No redemptions yet</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {redemptions.map(r => {
                    const student = clients.find(c => c.id === r.student_id);
                    return (
                      <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl">{r.reward_emoji || '🎁'}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.reward_name || 'Reward'}</p>
                            <p className="text-[10px] text-muted-foreground">{student ? displayName(student) : r.student_id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="destructive" className="text-xs">−{r.points_spent}</Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-border/40">
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No point activity yet</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {history.map(h => {
                    const student = clients.find(c => c.id === h.student_id);
                    return (
                      <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{student ? displayName(student) : h.student_id.slice(0, 8)}</p>
                          <p className="text-[10px] text-muted-foreground">{h.reason || h.source}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={h.points > 0 ? 'default' : 'destructive'} className="text-xs">{h.points > 0 ? '+' : ''}{h.points}</Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RewardsPage;
