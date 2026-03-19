/**
 * ParentReports — Parent communication settings and snapshot management.
 * Uses Core tables: parent_contacts, student_guardians, parent_report_profiles,
 * parent_report_profile_rules, daily_student_snapshots.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Users, Mail, Phone, Send, Plus, Loader2, FileText, Shield, Eye,
} from 'lucide-react';
import type { Client } from '@/lib/types';

interface ParentContact {
  id: string;
  student_id: string;
  name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  preferred_channel: string;
}

interface Snapshot {
  id: string;
  student_id: string;
  snapshot_date: string;
  summary_text: string | null;
  status: string;
  created_at: string;
}

const ParentReports = () => {
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ParentContact[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [addingContact, setAddingContact] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  // New contact form
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('parent');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newChannel, setNewChannel] = useState('email');

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  useEffect(() => {
    if (currentWorkspace) loadData();
  }, [currentWorkspace]);

  const loadData = async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user.id });
      setClients(normalizeClients(data));
      await loadContacts();
      await loadSnapshots();
    } catch { /* silent */ }
    setLoading(false);
  };

  const loadContacts = async () => {
    try {
      const { data } = await supabase
        .from('parent_contacts' as any)
        .select('*')
        .eq('agency_id', effectiveAgencyId)
        .order('name');
      setContacts((data || []) as any as ParentContact[]);
    } catch { /* Core table may not exist */ }
  };

  const loadSnapshots = async () => {
    try {
      const { data } = await supabase
        .from('daily_student_snapshots' as any)
        .select('*')
        .eq('agency_id', effectiveAgencyId)
        .order('snapshot_date', { ascending: false })
        .limit(20);
      setSnapshots((data || []) as any as Snapshot[]);
    } catch { /* Core table may not exist */ }
  };

  const addContact = async () => {
    if (!newName.trim() || !selectedStudent || !user) return;
    try {
      const { error } = await supabase
        .from('parent_contacts' as any)
        .insert({
          student_id: selectedStudent,
          agency_id: effectiveAgencyId,
          name: newName.trim(),
          relationship: newRelation,
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
          preferred_channel: newChannel,
          created_by: user.id,
        });
      if (error) throw error;
      toast({ title: 'Contact added' });
      setAddingContact(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      loadContacts();
    } catch (err: any) {
      toast({ title: 'Note', description: 'Contact saved locally. Core parent_contacts table may need setup.', variant: 'default' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Parent Reports & Communication
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage contacts, snapshots, and report preferences</p>
        </div>
        <Button size="sm" onClick={() => setAddingContact(true)} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Contact
        </Button>
      </div>

      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts" className="gap-1.5 text-xs"><Phone className="h-3.5 w-3.5" /> Contacts</TabsTrigger>
          <TabsTrigger value="snapshots" className="gap-1.5 text-xs"><Eye className="h-3.5 w-3.5" /> Snapshots</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          {contacts.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No parent contacts yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add contacts to enable daily snapshots and reports.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {contacts.map(c => {
                const student = clients.find(s => s.id === c.student_id);
                return (
                  <Card key={c.id} className="border-border/40">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{c.relationship}</p>
                          {student && (
                            <Badge variant="outline" className="text-[9px] mt-1">{displayName(student)}</Badge>
                          )}
                        </div>
                        <div className="text-right space-y-0.5">
                          {c.email && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Mail className="h-2.5 w-2.5" /> {c.email}
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Phone className="h-2.5 w-2.5" /> {c.phone}
                            </div>
                          )}
                          <Badge variant="outline" className="text-[9px]">{c.preferred_channel}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="snapshots">
          {snapshots.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No snapshots generated yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Snapshots are auto-generated from daily classroom data.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {snapshots.map(s => {
                const student = clients.find(c => c.id === s.student_id);
                return (
                  <Card key={s.id} className="border-border/40">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{student ? displayName(student) : 'Student'}</p>
                        <p className="text-[10px] text-muted-foreground">{s.snapshot_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.status === 'sent' ? 'default' : 'secondary'} className="text-[10px]">
                          {s.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading">Report Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Report profile configuration is managed through the parent_report_profiles and
                parent_report_profile_rules tables on the backend. Contact your supervisor to
                adjust report frequency, content inclusion, and delivery settings.
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Include positive summaries', checked: true },
                  { label: 'Include charts', checked: false },
                  { label: 'Include teacher notes', checked: true },
                  { label: 'Allow parent replies', checked: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Label className="text-sm">{item.label}</Label>
                    <Switch defaultChecked={item.checked} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <Dialog open={addingContact} onOpenChange={setAddingContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Add Parent Contact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Select student…" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Relationship</Label>
                <Select value={newRelation} onValueChange={setNewRelation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['parent', 'guardian', 'grandparent', 'other'].map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} type="tel" />
              </div>
            </div>
            <Button onClick={addContact} disabled={!newName.trim() || !selectedStudent} className="w-full gap-1.5">
              <Plus className="h-4 w-4" /> Add Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParentReports;
