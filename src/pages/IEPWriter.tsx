import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileText, Save, Trash2, GripVertical } from 'lucide-react';
import type { Client, IEPDraft, IEPSection } from '@/lib/types';

const SECTION_TEMPLATES: { type: IEPSection['type']; title: string; defaultContent: string }[] = [
  { type: 'present_levels', title: 'Present Levels of Performance', defaultContent: 'Describe the student\'s current academic and functional performance…' },
  { type: 'goals', title: 'Annual Goals & Objectives', defaultContent: 'Goal 1:\nBaseline:\nTarget:\nMeasurement method:' },
  { type: 'accommodations', title: 'Accommodations & Modifications', defaultContent: '• Extended time on assessments\n• Preferential seating\n• ' },
  { type: 'services', title: 'Related Services', defaultContent: 'Service:\nFrequency:\nDuration:\nProvider:' },
  { type: 'transition', title: 'Transition Planning', defaultContent: 'Post-secondary goals:\nTransition activities:\nAge-appropriate assessments:' },
];

const IEPWriter = () => {
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [drafts, setDrafts] = useState<IEPDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<IEPDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (selectedClientId) loadDrafts();
  }, [selectedClientId]);

  const loadClients = async () => {
    if (!currentWorkspace) return;

    if (isSoloMode) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', currentWorkspace.agency_id)
        .order('last_name');
      setClients(data || []);
    } else {
      const { data } = await supabase
        .from('user_client_access')
        .select('*, client:clients(*)')
        .eq('user_id', user?.id)
        .eq('can_generate_reports', true);
      setClients((data || []).map((d: any) => d.client));
    }
  };

  const loadDrafts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('iep_drafts')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('updated_at', { ascending: false });

    setDrafts(data || []);
    setActiveDraft(null);
    setLoading(false);
  };

  const handleCreateDraft = async () => {
    if (!selectedClientId || !newTitle.trim()) return;
    setSaving(true);

    const sections: IEPSection[] = SECTION_TEMPLATES.map((t, i) => ({
      id: crypto.randomUUID(),
      type: t.type,
      title: t.title,
      content: t.defaultContent,
      order: i,
    }));

    try {
      const { data, error } = await supabase
        .from('iep_drafts')
        .insert({
          client_id: selectedClientId,
          user_id: user?.id,
          title: newTitle.trim(),
          sections,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'IEP draft created' });
      setShowNew(false);
      setNewTitle('');
      loadDrafts();
      if (data) setActiveDraft(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!activeDraft) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('iep_drafts')
        .update({
          sections: activeDraft.sections,
          title: activeDraft.title,
          status: activeDraft.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeDraft.id);

      if (error) throw error;
      toast({ title: 'Draft saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (sectionId: string, content: string) => {
    if (!activeDraft) return;
    setActiveDraft({
      ...activeDraft,
      sections: activeDraft.sections.map((s) =>
        s.id === sectionId ? { ...s, content } : s
      ),
    });
  };

  const addSection = (type: IEPSection['type']) => {
    if (!activeDraft) return;
    const template = SECTION_TEMPLATES.find((t) => t.type === type);
    const newSection: IEPSection = {
      id: crypto.randomUUID(),
      type: type,
      title: template?.title || 'Custom Section',
      content: template?.defaultContent || '',
      order: activeDraft.sections.length,
    };
    setActiveDraft({
      ...activeDraft,
      sections: [...activeDraft.sections, newSection],
    });
  };

  const removeSection = (sectionId: string) => {
    if (!activeDraft) return;
    setActiveDraft({
      ...activeDraft,
      sections: activeDraft.sections.filter((s) => s.id !== sectionId),
    });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    review: 'bg-primary/10 text-primary',
    final: 'bg-accent/10 text-accent-foreground',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          IEP Writer
        </h2>
        <p className="text-sm text-muted-foreground">Create and manage IEP documents</p>
      </div>

      {/* Student selector */}
      <div className="max-w-sm">
        <Label className="mb-2 block text-xs text-muted-foreground">Select Student</Label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a student…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClientId && !activeDraft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Drafts</h3>
            <Dialog open={showNew} onOpenChange={setShowNew}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  New IEP
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create IEP Draft</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="e.g., Annual IEP Review 2026"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreateDraft} disabled={saving} className="w-full">
                    {saving ? 'Creating…' : 'Create Draft'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : drafts.length === 0 ? (
            <Card className="border-dashed border-border">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No IEP drafts yet</p>
                <Button variant="link" onClick={() => setShowNew(true)}>Create your first IEP</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {drafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="cursor-pointer border-border/50 transition-shadow hover:shadow-md"
                  onClick={() => setActiveDraft(draft)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{draft.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {draft.sections?.length || 0} sections · Updated {new Date(draft.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={statusColors[draft.status] || ''}>
                        {draft.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active draft editor */}
      {activeDraft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setActiveDraft(null)}>
                ← Back
              </Button>
              <Input
                value={activeDraft.title}
                onChange={(e) => setActiveDraft({ ...activeDraft, title: e.target.value })}
                className="max-w-xs border-none bg-transparent text-lg font-semibold focus-visible:ring-0"
              />
              <Select
                value={activeDraft.status}
                onValueChange={(v: any) => setActiveDraft({ ...activeDraft, status: v })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          {activeDraft.sections.map((section) => (
            <Card key={section.id} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(section.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={section.content}
                  onChange={(e) => updateSection(section.id, e.target.value)}
                  className="min-h-[120px] resize-y"
                />
              </CardContent>
            </Card>
          ))}

          <Card className="border-dashed border-border">
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <span className="text-xs text-muted-foreground">Add section:</span>
              {SECTION_TEMPLATES.map((t) => (
                <Button
                  key={t.type}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => addSection(t.type)}
                >
                  + {t.title}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default IEPWriter;
