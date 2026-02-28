import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Activity, FileText, User } from 'lucide-react';
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

    // Try students table first, fallback to clients
    let result = await supabase.from('students').select('*').eq('id', id).single();
    if (result.error) {
      result = await supabase.from('clients').select('*').eq('id', id).single();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/students')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {displayName(client)}
          </h2>
          {client.grade && <p className="text-sm text-muted-foreground">Grade {client.grade}</p>}
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          {(isSoloMode || permissions.can_collect_data) && (
            <TabsTrigger value="abc" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              ABC Logs
            </TabsTrigger>
          )}
          {(isSoloMode || permissions.can_generate_reports) && (
            <TabsTrigger value="iep" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              IEP Drafts
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Student Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">First Name</p>
                  <p className="font-medium">{client.first_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Name</p>
                  <p className="font-medium">{client.last_name}</p>
                </div>
                {client.date_of_birth && (
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{client.date_of_birth}</p>
                  </div>
                )}
                {client.grade && (
                  <div>
                    <p className="text-xs text-muted-foreground">Grade</p>
                    <p className="font-medium">{client.grade}</p>
                  </div>
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

        <TabsContent value="iep">
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              Use the IEP Writer to create drafts for this student.
              <br />
              <Button variant="link" onClick={() => navigate('/iep')}>Open IEP Writer</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDetail;
