import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText, Save, Trash2, Sparkles, Loader2, Copy, Share2, Download } from 'lucide-react';
import type { Client, IEPDraft, IEPSection } from '@/lib/types';

const SECTION_TEMPLATES: { type: IEPSection['type']; title: string; defaultContent: string }[] = [
  { type: 'present_levels', title: 'Present Levels of Performance', defaultContent: 'Describe the student\'s current academic and functional performance…' },
  { type: 'behavior_impact', title: 'Behavior Impact Statement', defaultContent: 'Describe how the student\'s behavior impacts their learning and the learning of others…' },
  { type: 'goals', title: 'Annual Goals & Objectives', defaultContent: 'Goal 1:\nBaseline:\nTarget:\nMeasurement method:' },
  { type: 'accommodations', title: 'Accommodations & Modifications', defaultContent: '• Extended time on assessments\n• Preferential seating\n• ' },
  { type: 'services', title: 'Services & Supports', defaultContent: 'Service:\nFrequency:\nDuration:\nProvider:' },
  { type: 'transition', title: 'Transition Planning', defaultContent: 'Post-secondary goals:\nTransition activities:\nAge-appropriate assessments:' },
];

interface Props {
  client: Client;
}

export const IEPTab = ({ client }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { toast } = useToast();
  const [tab, setTab] = useState('snapshot');
  const [drafts, setDrafts] = useState<IEPDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<IEPDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customSectionTitle, setCustomSectionTitle] = useState('');

  // Snapshot fields (editable locally then saved to clients/students)
  const [iepDate, setIepDate] = useState(client.iep_date || '');
  const [nextReview, setNextReview] = useState(client.next_iep_review_date || '');
  const [diagnoses, setDiagnoses] = useState((client.diagnoses || []).join(', '));
  const [presentNotes, setPresentNotes] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, [client.id]);

  const loadDrafts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('iep_drafts')
      .select('*')
      .eq('client_id', client.id)
      .order('updated_at', { ascending: false });
    setDrafts(data || []);
    setLoading(false);
  };

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    const diagArr = diagnoses.split(',').map(d => d.trim()).filter(Boolean);
    const { error } = await supabase.from('students').update({
      iep_date: iepDate || null,
      next_iep_review_date: nextReview || null,
      diagnoses: diagArr.length > 0 ? diagArr : null,
    }).eq('id', client.id);

    if (error) {
      toast({ title: 'Error saving snapshot', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'IEP snapshot saved' });
    }
    setSavingSnapshot(false);
  };

  const handleCreateDraft = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const sections: IEPSection[] = SECTION_TEMPLATES.map((t, i) => ({
      id: crypto.randomUUID(),
      type: t.type,
      title: t.title,
      content: t.defaultContent,
      order: i,
    }));

    const { data, error } = await supabase.from('iep_drafts').insert({
      client_id: client.id,
      user_id: user?.id,
      agency_id: currentWorkspace?.agency_id,
      title: newTitle.trim(),
      sections,
      status: 'draft',
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Draft created' });
      setShowNew(false);
      setNewTitle('');
      loadDrafts();
      if (data) setActiveDraft(data);
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!activeDraft) return;
    setSaving(true);
    const { error } = await supabase.from('iep_drafts').update({
      sections: activeDraft.sections,
      title: activeDraft.title,
      status: activeDraft.status,
      updated_at: new Date().toISOString(),
    }).eq('id', activeDraft.id);

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Draft saved' });
    setSaving(false);
  };

  const handleShare = async () => {
    if (!activeDraft || !user) return;
    setSaving(true);
    const { error } = await supabase.from('iep_drafts').update({
      status: 'shared',
      shared_at: new Date().toISOString(),
      shared_by: user.id,
    }).eq('id', activeDraft.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setActiveDraft({ ...activeDraft, status: 'shared' as any });
      toast({ title: 'Shared with BCBA/Nova', description: 'This draft is now visible in NovaTrack Core.' });
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!activeDraft) return;
    const text = activeDraft.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const handleExport = () => {
    if (!activeDraft) return;
    const text = `# ${activeDraft.title}\n\n` +
      activeDraft.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDraft.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateSection = (sectionId: string, content: string) => {
    if (!activeDraft) return;
    setActiveDraft({
      ...activeDraft,
      sections: activeDraft.sections.map(s => s.id === sectionId ? { ...s, content } : s),
    });
  };

  const removeSection = (sectionId: string) => {
    if (!activeDraft) return;
    setActiveDraft({
      ...activeDraft,
      sections: activeDraft.sections.filter(s => s.id !== sectionId),
    });
  };

  const addSection = (type: IEPSection['type']) => {
    if (!activeDraft) return;
    const template = SECTION_TEMPLATES.find(t => t.type === type);
    setActiveDraft({
      ...activeDraft,
      sections: [...activeDraft.sections, {
        id: crypto.randomUUID(),
        type,
        title: template?.title || 'Custom Section',
        content: template?.defaultContent || '',
        order: activeDraft.sections.length,
      }],
    });
  };

  const addCustomSection = () => {
    if (!activeDraft || !customSectionTitle.trim()) return;
    setActiveDraft({
      ...activeDraft,
      sections: [...activeDraft.sections, {
        id: crypto.randomUUID(),
        type: 'custom',
        title: customSectionTitle.trim(),
        content: '',
        order: activeDraft.sections.length,
      }],
    });
    setCustomSectionTitle('');
    setShowCustomDialog(false);
  };

  const generateForSection = async (section: IEPSection) => {
    setGeneratingSection(section.id);
    try {
      const [logsRes, catsRes] = await Promise.all([
        supabase.from('abc_logs').select('*').eq('client_id', client.id).order('logged_at', { ascending: false }).limit(30),
        supabase.from('behavior_categories').select('*').eq('client_id', client.id),
      ]);

      const { data, error } = await cloudSupabase.functions.invoke('generate-iep-goals', {
        body: {
          studentName: `${client.first_name} ${client.last_name}`,
          grade: client.grade,
          abcLogs: logsRes.data || [],
          behaviorCategories: catsRes.data || [],
          sectionType: section.type === 'custom' ? section.title : section.type,
        },
      });

      if (error) throw error;
      if (data?.content) {
        updateSection(section.id, data.content);
        toast({ title: 'AI content generated' });
      }
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingSection(null);
    }
  };

  const generateAllSections = async () => {
    if (!activeDraft) return;
    setGeneratingAll(true);
    try {
      const [logsRes, catsRes] = await Promise.all([
        supabase.from('abc_logs').select('*').eq('client_id', client.id).order('logged_at', { ascending: false }).limit(30),
        supabase.from('behavior_categories').select('*').eq('client_id', client.id),
      ]);

      for (const section of activeDraft.sections) {
        setGeneratingSection(section.id);
        try {
          const { data } = await cloudSupabase.functions.invoke('generate-iep-goals', {
            body: {
              studentName: `${client.first_name} ${client.last_name}`,
              grade: client.grade,
              abcLogs: logsRes.data || [],
              behaviorCategories: catsRes.data || [],
              sectionType: section.type === 'custom' ? section.title : section.type,
            },
          });
          if (data?.content) updateSection(section.id, data.content);
        } catch {}
        setGeneratingSection(null);
      }
      toast({ title: 'All sections generated' });
    } finally {
      setGeneratingAll(false);
      setGeneratingSection(null);
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    review: 'bg-primary/10 text-primary',
    final: 'bg-accent/10 text-accent-foreground',
    shared: 'bg-accent text-accent-foreground',
  };

  // ── IEP Snapshot sub-tab ──
  const renderSnapshot = () => (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">IEP Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">IEP Date</Label>
            <Input type="date" value={iepDate} onChange={e => setIepDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next IEP Review</Label>
            <Input type="date" value={nextReview} onChange={e => setNextReview(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Diagnoses (comma-separated)</Label>
          <Input value={diagnoses} onChange={e => setDiagnoses(e.target.value)} placeholder="e.g. ADHD, ASD" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Present Levels Quick Notes</Label>
          <Textarea
            value={presentNotes}
            onChange={e => setPresentNotes(e.target.value)}
            placeholder="Brief notes about current performance levels…"
            className="min-h-[80px]"
          />
        </div>
        <Button onClick={handleSaveSnapshot} disabled={savingSnapshot} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {savingSnapshot ? 'Saving…' : 'Save Snapshot'}
        </Button>
      </CardContent>
    </Card>
  );

  // ── Draft list ──
  const renderDraftList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">IEP Drafts</h3>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              New Draft
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create IEP Draft</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="e.g., Annual IEP Review 2026" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              </div>
              <Button onClick={handleCreateDraft} disabled={saving} className="w-full">
                {saving ? 'Creating…' : 'Create Draft'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : drafts.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No IEP drafts yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {drafts.map(draft => (
            <Card
              key={draft.id}
              className="cursor-pointer border-border/50 transition-shadow hover:shadow-md"
              onClick={() => setActiveDraft(draft)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{draft.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {draft.sections?.length || 0} sections · {new Date(draft.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={statusColors[draft.status] || ''}>{draft.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // ── Active draft editor ──
  const renderDraftEditor = () => {
    if (!activeDraft) return null;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setActiveDraft(null); loadDrafts(); }}>← Back</Button>
            <Input
              value={activeDraft.title}
              onChange={e => setActiveDraft({ ...activeDraft, title: e.target.value })}
              className="max-w-[200px] border-none bg-transparent font-semibold focus-visible:ring-0"
            />
            <Select value={activeDraft.status} onValueChange={(v: any) => setActiveDraft({ ...activeDraft, status: v })}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="final">Final</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button onClick={generateAllSections} disabled={generatingAll} size="sm" variant="outline" className="gap-1 h-8 text-xs">
              {generatingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generatingAll ? 'Generating…' : 'AI All'}
            </Button>
            <Button onClick={handleCopy} size="sm" variant="outline" className="gap-1 h-8 text-xs">
              <Copy className="h-3 w-3" /> Copy
            </Button>
            <Button onClick={handleExport} size="sm" variant="outline" className="gap-1 h-8 text-xs">
              <Download className="h-3 w-3" /> Export
            </Button>
            <Button onClick={handleShare} size="sm" variant="outline" className="gap-1 h-8 text-xs">
              <Share2 className="h-3 w-3" /> Share
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1 h-8 text-xs">
              <Save className="h-3 w-3" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        {activeDraft.sections.map(section => (
          <Card key={section.id} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 gap-1 text-xs text-primary"
                    disabled={generatingSection === section.id}
                    onClick={() => generateForSection(section)}
                  >
                    {generatingSection === section.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    AI
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeSection(section.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea value={section.content} onChange={e => updateSection(section.id, e.target.value)} className="min-h-[100px] resize-y" />
            </CardContent>
          </Card>
        ))}

        <Card className="border-dashed border-border">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-xs text-muted-foreground">Add:</span>
            {SECTION_TEMPLATES.map(t => (
              <Button key={t.type} variant="outline" size="sm" className="text-xs h-7" onClick={() => addSection(t.type)}>
                + {t.title.split(' ').slice(0, 2).join(' ')}
              </Button>
            ))}
            <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                  <Plus className="h-3 w-3" /> Custom
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Custom Section</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <Input placeholder="Section title" value={customSectionTitle} onChange={e => setCustomSectionTitle(e.target.value)} />
                  <Button onClick={addCustomSection} disabled={!customSectionTitle.trim()} className="w-full">Add</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="snapshot" className="text-xs">Snapshot</TabsTrigger>
        <TabsTrigger value="writer" className="text-xs">IEP Writer</TabsTrigger>
      </TabsList>
      <TabsContent value="snapshot">{renderSnapshot()}</TabsContent>
      <TabsContent value="writer">
        {activeDraft ? renderDraftEditor() : renderDraftList()}
      </TabsContent>
    </Tabs>
  );
};
