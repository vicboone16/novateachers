import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Activity, FileText, User, Calendar } from 'lucide-react';
import { normalizeClient, displayName } from '@/lib/student-utils';
import type { Client } from '@/lib/types';

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSoloMode, permissions } = useWorkspace();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadClient();
  }, [id]);

  const loadClient = async () => {
    setLoading(true);

    // Prefer clients view, fallback to students
    let result = await supabase.from('clients').select('*').eq('id', id).single();
    if (result.error) {
      result = await supabase.from('students').select('*').eq('id', id).single();
    }

    if (!result.error && result.data) {
      setClient(normalizeClient(result.data));
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Student not found</p>
        <Button variant="link" onClick={() => navigate('/students')}>Back to students</Button>
      </div>
    );
  }

  const diagnoses: string[] = Array.isArray(client.diagnoses) ? client.diagnoses : [];
  const iepDateFormatted = client.iep_date ? new Date(client.iep_date).toLocaleDateString() : null;
  const nextReviewFormatted = client.next_iep_review_date ? new Date(client.next_iep_review_date).toLocaleDateString() : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/students')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading">
            {displayName(client)}
          </h2>
          <div className="flex items-center gap-2">
            {client.grade && <span className="text-sm text-muted-foreground">Grade {client.grade}</span>}
            {client.primary_setting && (
              <Badge variant="outline" className="text-xs">{client.primary_setting}</Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          {(isSoloMode || permissions.can_collect_data) && (
            <TabsTrigger value="abc" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              ABC Logs
            </TabsTrigger>
          )}
          <TabsTrigger value="iep_snapshot" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            IEP Snapshot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Student Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="First Name" value={client.first_name} />
                <InfoField label="Last Name" value={client.last_name} />
                <InfoField label="Grade" value={client.grade} />
                <InfoField label="School" value={client.school_name} />
                <InfoField label="District" value={client.district_name} />
                <InfoField label="Primary Setting" value={client.primary_setting} />
                {client.date_of_birth && (
                  <InfoField label="Date of Birth" value={new Date(client.date_of_birth).toLocaleDateString()} />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abc">
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              Use the Trigger Tracker to log ABC data for this student.
              <br />
              <Button variant="link" onClick={() => navigate('/tracker')}>Open Trigger Tracker</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iep_snapshot">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">IEP Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="IEP Date" value={iepDateFormatted} />
                <InfoField
                  label="Next IEP Review"
                  value={nextReviewFormatted}
                  badge={(() => {
                    if (!client.next_iep_review_date) return undefined;
                    const review = new Date(client.next_iep_review_date);
                    const soon = review <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    return soon ? { text: 'Due Soon', variant: 'destructive' as const } : undefined;
                  })()}
                />
                <InfoField label="Funding Mode" value={client.funding_mode} />
              </div>

              {diagnoses.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-muted-foreground">Diagnoses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {diagnoses.map((d, i) => (
                      <Badge key={i} variant="secondary">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {!iepDateFormatted && !nextReviewFormatted && diagnoses.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No IEP information recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoField = ({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string | null;
  badge?: { text: string; variant: 'destructive' | 'outline' };
}) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="flex items-center gap-2">
      <p className="font-medium text-foreground">{value || '—'}</p>
      {badge && (
        <Badge variant={badge.variant} className="text-[10px] h-5">
          {badge.text}
        </Badge>
      )}
    </div>
  </div>
);

export default StudentDetail;
