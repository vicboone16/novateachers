import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Send, FileText, Loader2 } from 'lucide-react';
import type { ABCLog, TeacherDataSession } from '@/lib/types';

interface Props {
  clientId: string;
  clientName: string;
  logs: ABCLog[];
  sessions: TeacherDataSession[];
}

export const BCBASummary = ({ clientId, clientName, logs, sessions }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState('');
  const [sending, setSending] = useState(false);

  const generateSummary = () => {
    setGenerating(true);

    const today = new Date().toDateString();
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const todayLogs = logs.filter(l => new Date(l.logged_at).toDateString() === today);
    const weekLogs = logs.filter(l => new Date(l.logged_at) >= weekAgo);
    const todaySessions = sessions.filter(s => new Date(s.started_at).toDateString() === today);
    const weekSessions = sessions.filter(s => new Date(s.started_at) >= weekAgo);

    // Top antecedents/consequences this week
    const antFreq: Record<string, number> = {};
    const conFreq: Record<string, number> = {};
    weekLogs.forEach(l => {
      if (l.antecedent) antFreq[l.antecedent] = (antFreq[l.antecedent] || 0) + 1;
      if (l.consequence) conFreq[l.consequence] = (conFreq[l.consequence] || 0) + 1;
    });
    const topAnt = Object.entries(antFreq).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topCon = Object.entries(conFreq).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Session summaries
    const sessionLines = weekSessions.slice(0, 10).map(s => {
      const sj = s.summary_json || {};
      let detail = '';
      if (sj.count != null) detail = `Count: ${sj.count}`;
      else if (sj.percentage != null) detail = `${sj.percentage}% intervals`;
      else if (sj.rating != null) detail = `Rating: ${sj.rating}/5`;
      else if (sj.total_seconds != null) detail = `Duration: ${Math.round(sj.total_seconds)}s`;
      return `  • ${s.mode} on ${new Date(s.started_at).toLocaleDateString()} — ${detail || 'no summary'}`;
    }).join('\n');

    const text = `BCBA Summary Report — ${clientName}
Generated: ${new Date().toLocaleString()}
Agency: ${currentWorkspace?.name || '—'}

── ABC Log Overview ──
Today: ${todayLogs.length} events
This week: ${weekLogs.length} events

Top Antecedents (7 days):
${topAnt.length > 0 ? topAnt.map(([a, c]) => `  • ${a} (${c}×)`).join('\n') : '  • No data'}

Top Consequences (7 days):
${topCon.length > 0 ? topCon.map(([a, c]) => `  • ${a} (${c}×)`).join('\n') : '  • No data'}

── Data Collection Sessions (7 days) ──
Total sessions: ${weekSessions.length}
Today: ${todaySessions.length}
${sessionLines || '  • No sessions this week'}

── Notes ──
(Add any additional observations below)
`;
    setSummary(text);
    setGenerating(false);
  };

  const sendToBCBA = async () => {
    if (!summary.trim() || !user || !currentWorkspace) return;
    setSending(true);

    const title = `BCBA Summary — ${new Date().toLocaleDateString()}`;

    const { error } = await supabase.from('iep_drafts').insert({
      client_id: clientId,
      created_by: user.id,
      agency_id: currentWorkspace.agency_id,
      title,
      sections: [
        {
          id: crypto.randomUUID(),
          type: 'custom',
          title: 'Data Summary for BCBA',
          content: summary,
          order: 0,
        },
      ],
      status: 'shared',
      shared_at: new Date().toISOString(),
      shared_by: user.id,
      draft_type: 'bcba_summary',
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Summary sent to BCBA', description: 'Visible in NovaTrack Core under this student.' });
      setSummary('');

      // Send email notification (fire-and-forget)
      supabase.functions.invoke('notify-bcba', {
        body: { clientId, clientName, summaryTitle: title },
      }).then(({ error: fnErr }) => {
        if (fnErr) console.error('Notification error:', fnErr);
        else toast({ title: '✉️ BCBA notified by email' });
      });
    }
    setSending(false);
  };

  return (
    <Card className="border-accent/30 bg-accent/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Send className="h-4 w-4 text-accent" />
          Send Summary to BCBA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!summary ? (
          <Button
            onClick={generateSummary}
            disabled={generating}
            variant="outline"
            className="w-full gap-2 border-accent/40 text-accent hover:bg-accent/10"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate Day/Week Summary
          </Button>
        ) : (
          <>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="min-h-[200px] resize-y text-xs font-mono"
            />
            <div className="flex gap-2">
              <Button
                onClick={sendToBCBA}
                disabled={sending}
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Sending…' : 'Send to BCBA/Nova'}
              </Button>
              <Button variant="ghost" onClick={() => setSummary('')}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
