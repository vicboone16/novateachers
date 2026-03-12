import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { TrendingUp, Activity, Target } from 'lucide-react';
import { format, subWeeks, startOfWeek } from 'date-fns';

interface WeeklyTrendChartsProps {
  studentId: string;
}

interface SummaryRow {
  week_start: string;
  behavior_summary: any;
  engagement_summary: any;
  probe_summary: any;
  reliability_summary: any;
}

const CHART_WEEKS = 8;

const behaviorConfig = {
  total: { label: 'Total Events', color: 'hsl(var(--destructive))' },
  rate: { label: 'Hourly Rate', color: 'hsl(var(--primary))' },
};

const engagementConfig = {
  percentage: { label: 'Engagement %', color: 'hsl(var(--accent))' },
  reliability: { label: 'Reliability %', color: 'hsl(var(--muted-foreground))' },
};

const probeConfig: Record<string, { label: string; color: string }> = {};

export const WeeklyTrendCharts = ({ studentId }: WeeklyTrendChartsProps) => {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || !user) return;
    const load = async () => {
      setLoading(true);
      const earliest = format(startOfWeek(subWeeks(new Date(), CHART_WEEKS), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('teacher_weekly_summaries')
        .select('week_start,behavior_summary,engagement_summary,probe_summary,reliability_summary')
        .eq('student_id', studentId)
        .eq('staff_id', user.id)
        .gte('week_start', earliest)
        .order('week_start', { ascending: true });
      setSummaries((data as SummaryRow[]) || []);
      setLoading(false);
    };
    load();
  }, [studentId, user]);

  const behaviorData = useMemo(() =>
    summaries.map(s => ({
      week: format(new Date(s.week_start + 'T12:00:00'), 'M/d'),
      total: s.behavior_summary?.total_events ?? 0,
      rate: s.behavior_summary?.hourly_rate != null
        ? Number(s.behavior_summary.hourly_rate)
        : 0,
    })),
  [summaries]);

  const engagementData = useMemo(() =>
    summaries.map(s => ({
      week: format(new Date(s.week_start + 'T12:00:00'), 'M/d'),
      percentage: s.engagement_summary?.engagement_percent ?? null,
      reliability: s.reliability_summary?.reliability_percent ?? null,
    })),
  [summaries]);

  const { probeData, skillNames } = useMemo(() => {
    const names = new Set<string>();
    for (const s of summaries) {
      if (s.probe_summary) {
        for (const key of Object.keys(s.probe_summary)) {
          names.add(key);
        }
      }
    }
    const skillNames = Array.from(names).filter(n => n.endsWith('_success')).slice(0, 4);
    const probeData = summaries.map(s => {
      const row: Record<string, any> = { week: format(new Date(s.week_start + 'T12:00:00'), 'M/d') };
      for (const skill of skillNames) {
        row[skill] = s.probe_summary?.[skill] ?? null;
      }
      return row;
    });
    return { probeData, skillNames };
  }, [summaries]);

  // Build dynamic probe config
  const dynamicProbeConfig = useMemo(() => {
    const colors = [
      'hsl(var(--primary))',
      'hsl(var(--accent))',
      'hsl(var(--destructive))',
      'hsl(var(--muted-foreground))',
    ];
    const cfg: Record<string, { label: string; color: string }> = {};
    skillNames.forEach((name, i) => {
      cfg[name] = {
        label: name.replace('_success', '').replace(/_/g, ' '),
        color: colors[i % colors.length],
      };
    });
    return cfg;
  }, [skillNames]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading trends…</p>;
  if (summaries.length < 2) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Behavior Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-destructive" /> Behavior Events Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={behaviorConfig} className="h-[200px] w-full">
            <BarChart data={behaviorData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Engagement Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-accent" /> Engagement & Reliability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={engagementConfig} className="h-[200px] w-full">
            <LineChart data={engagementData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="percentage" stroke="var(--color-percentage)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="reliability" stroke="var(--color-reliability)" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Skill Probe Trend */}
      {skillNames.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Target className="h-4 w-4 text-primary" /> Skill Probe Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dynamicProbeConfig} className="h-[200px] w-full">
              <LineChart data={probeData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                {skillNames.map((skill) => (
                  <Line
                    key={skill}
                    type="monotone"
                    dataKey={skill}
                    stroke={`var(--color-${skill})`}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
