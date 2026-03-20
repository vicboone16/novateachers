/**
 * RewardsPage — Beacon Points & Rewards management with redemption history tab.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { getStudentBalances } from '@/lib/beacon-points';
import { ReinforcerStore } from '@/components/ReinforcerStore';
import { TokenBoard } from '@/components/TokenBoard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Gift, History, Trophy, Sparkles, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  useEffect(() => { if (currentWorkspace) loadData(); }, [currentWorkspace]);

  const loadData = async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user.id });
      const normalized = normalizeClients(data);
      setClients(normalized);

      const clientIds = normalized.map(c => c.id);
      const bals = await getStudentBalances(user.id, clientIds);
      setBalances(bals);

      const { data: histData } = await cloudSupabase.from('beacon_points_ledger').select('*').eq('staff_id', user.id).order('created_at', { ascending: false }).limit(50);
      setHistory((histData || []) as any as PointHistory[]);

      // Load redemptions with reward info
      const { data: redeemData } = await supabase.from('beacon_reward_redemptions' as any).select('*').eq('agency_id', effectiveAgencyId).order('created_at', { ascending: false }).limit(30);
      const recs = (redeemData || []) as any as RedemptionRecord[];

      // Enrich with reward names
      if (recs.length > 0) {
        const rewardIds = [...new Set(recs.map(r => r.reward_id))];
        const { data: rwds } = await supabase.from('beacon_rewards' as any).select('id, name, emoji').in('id', rewardIds);
        const rewardMap = new Map((rwds || []).map((r: any) => [r.id, r]));
        for (const rec of recs) {
          const rwd = rewardMap.get(rec.reward_id) as any;
          if (rwd) { rec.reward_name = rwd.name; rec.reward_emoji = rwd.emoji; }
        }
      }
      setRedemptions(recs);

      const { data: groups } = await cloudSupabase.from('classroom_groups').select('group_id').eq('agency_id', effectiveAgencyId).limit(1);
      if (groups?.length) setActiveGroupId(groups[0].group_id);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handlePointChange = (studentId: string, delta: number) => {
    setBalances(prev => ({ ...prev, [studentId]: (prev[studentId] || 0) + delta }));
  };

  if (loading) return <div className="flex items-center justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

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
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{displayName(c).charAt(0)}</div>
                    <div><p className="text-sm font-semibold">{displayName(c)}</p>{c.grade && <p className="text-[10px] text-muted-foreground">Grade {c.grade}</p>}</div>
                  </div>
                  <Badge className="gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"><Star className="h-3 w-3 fill-amber-500 text-amber-500" />{balances[c.id] || 0}</Badge>
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
