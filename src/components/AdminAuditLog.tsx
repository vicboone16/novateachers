/**
 * AdminAuditLog — Real-time audit feed showing point awards, redemptions,
 * presence changes, and other tracked actions across the agency.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Star, Trophy, MapPin, Shield, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface AuditEntry {
  id: string;
  agency_id: string;
  user_id: string | null;
  user_name: string | null;
  action_type: string;
  action_category: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

const CATEGORY_ICONS: Record<string, typeof Star> = {
  points: Star,
  rewards: Trophy,
  presence: MapPin,
  mayday: Shield,
  general: Zap,
};

const CATEGORY_COLORS: Record<string, string> = {
  points: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  rewards: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  presence: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  mayday: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  general: 'bg-muted text-muted-foreground',
};

const ACTION_LABELS: Record<string, string> = {
  points_awarded: 'Points Awarded',
  points_deducted: 'Points Deducted',
  reward_redeemed: 'Reward Redeemed',
  staff_checked_out: 'Staff Checked Out',
  staff_status_changed: 'Status Changed',
};

export function AdminAuditLog() {
  const { currentWorkspace } = useWorkspace();
  const agencyId = currentWorkspace?.agency_id;

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const loadEntries = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    let q = cloudSupabase
      .from('admin_audit_log')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      q = q.eq('action_category', filter);
    }

    const { data } = await q;
    const rows = (data || []) as AuditEntry[];
    setEntries(rows);

    // Resolve names
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const names = await resolveDisplayNames(userIds);
      setNameMap(Object.fromEntries(names));
    }
    setLoading(false);
  }, [agencyId, filter]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const getName = (entry: AuditEntry) =>
    entry.user_name || (entry.user_id ? nameMap[entry.user_id] : null) || 'System';

  const getDescription = (entry: AuditEntry) => {
    const d = entry.details || {};
    switch (entry.action_type) {
      case 'points_awarded':
        return `+${d.points} pts — ${d.reason || d.source || 'manual'}`;
      case 'points_deducted':
        return `${d.points} pts — ${d.reason || d.source || 'deduction'}`;
      case 'reward_redeemed':
        return `Spent ${d.points_spent} pts on reward`;
      case 'staff_checked_out':
        return 'Checked out of location';
      case 'staff_status_changed':
        return `Status → ${d.status || 'unknown'} (${d.availability || ''})`;
      default:
        return entry.action_type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="points">Points</SelectItem>
            <SelectItem value="rewards">Rewards</SelectItem>
            <SelectItem value="presence">Presence</SelectItem>
            <SelectItem value="mayday">Mayday</SelectItem>
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" onClick={loadEntries} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{entries.length} events</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No audit events yet.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {entries.map(entry => {
            const Icon = CATEGORY_ICONS[entry.action_category] || Zap;
            const colorClass = CATEGORY_COLORS[entry.action_category] || CATEGORY_COLORS.general;
            return (
              <Card key={entry.id} className="border-border/40">
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={`rounded-full p-1.5 mt-0.5 ${colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{getName(entry)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {ACTION_LABELS[entry.action_type] || entry.action_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{getDescription(entry)}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {format(new Date(entry.created_at), 'h:mm a')}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
