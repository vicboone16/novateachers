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
import { Plus, FileText, Save, Trash2, Sparkles, Loader2, Copy, Share2, Download, ClipboardList } from 'lucide-react';
import type { Client, IEPDraft, IEPSection } from '@/lib/types';

// ── Section definitions with guided form prompts ──
const SECTION_DEFS: {
  key: string;
  type: IEPSection['type'];
  title: string;
  prompts: { label: string; placeholder: string; field: string }[];
  template: (vals: Record<string, string>) => string;
}[] = [
  {
    key: 'present_levels',
    type: 'present_levels',
    title: 'Present Levels of Performance',
    prompts: [
      { label: 'Academic strengths', placeholder: 'e.g. reads at grade level, strong in math computation', field: 'strengths' },
      { label: 'Areas of concern', placeholder: 'e.g. difficulty with written expression, reading comprehension below grade level', field: 'concerns' },
      { label: 'Current data / assessment results', placeholder: 'e.g. scored 72% on curriculum-based measure, below 25th percentile on DIBELS', field: 'data' },
      { label: 'Impact on general education', placeholder: 'e.g. requires extended time, needs modified assignments', field: 'impact' },
    ],
    template: (v) =>
      `**Academic Strengths:** ${v.strengths || '—'}\n\n**Areas of Concern:** ${v.concerns || '—'}\n\n**Current Data & Assessment Results:** ${v.data || '—'}\n\n**Impact on General Education:** ${v.impact || '—'}`,
  },
  {
    key: 'behavior_impact',
    type: 'behavior_impact',
    title: 'Behavior Impact Statement',
    prompts: [
      { label: 'Target behavior(s)', placeholder: 'e.g. off-task behavior, verbal outbursts', field: 'behaviors' },
      { label: 'Frequency / intensity', placeholder: 'e.g. 3–5 times per class period, moderate intensity', field: 'frequency' },
      { label: 'Impact on learning', placeholder: 'e.g. misses 15 min of instruction daily, disrupts peer learning', field: 'learning_impact' },
      { label: 'Current interventions', placeholder: 'e.g. token economy, visual schedule, breaks', field: 'interventions' },
    ],
    template: (v) =>
      `**Target Behavior(s):** ${v.behaviors || '—'}\n\n**Frequency / Intensity:** ${v.frequency || '—'}\n\n**Impact on Learning:** ${v.learning_impact || '—'}\n\n**Current Interventions:** ${v.interventions || '—'}`,
  },
  {
    key: 'accommodations',
    type: 'accommodations',
    title: 'Accommodations & Modifications',
    prompts: [
      { label: 'Classroom accommodations', placeholder: 'e.g. preferential seating, visual schedule, fidget tool', field: 'classroom' },
      { label: 'Assessment accommodations', placeholder: 'e.g. extended time (1.5×), separate setting, read-aloud', field: 'assessment' },
      { label: 'Environmental modifications', placeholder: 'e.g. reduced distractions, noise-canceling headphones', field: 'environmental' },
    ],
    template: (v) =>
      `**Classroom Accommodations:**\n${(v.classroom || '').split(',').map(s => `• ${s.trim()}`).filter(s => s !== '• ').join('\n') || '• —'}\n\n**Assessment Accommodations:**\n${(v.assessment || '').split(',').map(s => `• ${s.trim()}`).filter(s => s !== '• ').join('\n') || '• —'}\n\n**Environmental Modifications:**\n${(v.environmental || '').split(',').map(s => `• ${s.trim()}`).filter(s => s !== '• ').join('\n') || '• —'}`,
  },
  {
    key: 'goals',
    type: 'goals',
    title: 'Annual Goals & Objectives',
    prompts: [
      { label: 'Goal area', placeholder: 'e.g. reading comprehension, on-task behavior, social skills', field: 'area' },
      { label: 'Baseline', placeholder: 'e.g. currently reads 45 wpm, on-task 40% of intervals', field: 'baseline' },
      { label: 'Target', placeholder: 'e.g. will read 80 wpm, on-task 80% of intervals', field: 'target' },
      { label: 'Measurement method', placeholder: 'e.g. curriculum-based measure, interval recording, teacher observation', field: 'measurement' },
      { label: 'Timeline', placeholder: 'e.g. by annual review date, within 36 weeks', field: 'timeline' },
    ],
    template: (v) =>
      `**Goal Area:** ${v.area || '—'}\n\n**Baseline:** ${v.baseline || '—'}\n\n**Target:** ${v.target || '—'}\n\n**Measurement Method:** ${v.measurement || '—'}\n\n**Timeline:** ${v.timeline || '—'}`,
  },
  {
    key: 'services_supports',
    type: 'services',
    title: 'Services & Supports',
    prompts: [
      { label: 'Service type', placeholder: 'e.g. specialized instruction, speech therapy, counseling', field: 'service' },
      { label: 'Frequency', placeholder: 'e.g. 3× per week, 30 min sessions', field: 'frequency' },
      { label: 'Duration', placeholder: 'e.g. 30 minutes per session', field: 'duration' },
      { label: 'Provider', placeholder: 'e.g. special education teacher, SLP, school psychologist', field: 'provider' },
      { label: 'Location', placeholder: 'e.g. resource room, general education classroom', field: 'location' },
    ],
    template: (v) =>
      `**Service:** ${v.service || '—'}\n**Frequency:** ${v.frequency || '—'}\n**Duration:** ${v.duration || '—'}\n**Provider:** ${v.provider || '—'}\n**Location:** ${v.location || '—'}`,
  },
];

interface Props {
  client: Client;
}

export const IEPTab = ({ client }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
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

  // Guided form state
  const [guidedTemplate, setGuidedTemplate] = useState<string | null>(null);
  const [guidedValues, setGuidedValues] = useState<Record<string, string>>({});

  // Snapshot
  const [iepDate, setIepDate] = useState(client.iep_date || '');
  const [nextReview, setNextReview] = useState(client.next_iep_review_date || '');
  const [diagnoses, setDiagnoses] = useState((client.diagnoses || []).join(', '));
  const [presentNotes, setPresentNotes] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  useEffect(() => { loadDrafts(); }, [client.id]);

  // ── Queries ──

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
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'IEP snapshot saved' });
    setSavingSnapshot(false);
  };

  const handleCreateDraft = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);

    const sections: IEPSection[] = SECTION_DEFS.map((d, i) => ({
      id: crypto.randomUUID(),
      type: d.type,
      title: d.title,
      content: '',
      order: i,
    }));

    const { data, error } = await supabase.from('iep_drafts').insert({
      client_id: client.id,
      created_by: user?.id,
      agency_id: currentWorkspace?.agency_id,
      title: newTitle.trim(),
      sections,
      status: 'draft',
    }).select().single();

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
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
      status: 'draft',
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
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      setActiveDraft({ ...activeDraft, status: 'shared' as any, shared_at: new Date().toISOString() });
      toast({ title: 'Shared with BCBA/Nova', description: 'Draft is now visible in NovaTrack Core.' });
    }
    setSaving(false);
  };

  const handleCopyAll = () => {
    if (!activeDraft) return;
    const text = activeDraft.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'All sections copied to clipboard' });
  };

  const handleCopySection = (section: IEPSection) => {
    navigator.clipboard.writeText(section.content);
    toast({ title: `"${section.title}" copied` });
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

  // ── Guided form: generate text from prompts ──
  const handleGuidedGenerate = () => {
    if (!guidedTemplate || !activeDraft) return;
    const def = SECTION_DEFS.find(d => d.key === guidedTemplate);
    if (!def) return;
    const text = def.template(guidedValues);

    // Find existing section or add new
    const existing = activeDraft.sections.find(s => s.type === def.type);
    if (existing) {
      updateSection(existing.id, text);
    } else {
      setActiveDraft({
        ...activeDraft,
        sections: [...activeDraft.sections, {
          id: crypto.randomUUID(),
          type: def.type,
          title: def.title,
          content: text,
          order: activeDraft.sections.length,
        }],
      });
    }
    setGuidedTemplate(null);
    setGuidedValues({});
    toast({ title: 'Section generated from form' });
  };

  // ── AI generation ──
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
      if (data?.content) { updateSection(section.id, data.content); toast({ title: 'AI content generated' }); }
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally { setGeneratingSection(null); }
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
    } finally { setGeneratingAll(false); setGeneratingSection(null); }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    review: 'bg-primary/10 text-primary',
    final: 'bg-accent/10 text-accent-foreground',
    shared: 'bg-accent text-accent-foreground',
  };

  // ── Render: Snapshot ──
  const renderSnapshot = () => (
    <Card className="border-border/50">
      <CardHeader><CardTitle className="text-base">IEP Snapshot</CardTitle></CardHeader>
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
          <Textarea value={presentNotes} onChange={e => setPresentNotes(e.target.value)} placeholder="Brief notes…" className="min-h-[80px]" />
        </div>
        <Button onClick={handleSaveSnapshot} disabled={savingSnapshot} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {savingSnapshot ? 'Saving…' : 'Save Snapshot'}
        </Button>
      </CardContent>
    </Card>
  );

  // ── Render: Draft list ──
  const renderDraftList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">IEP Drafts</h3>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-8"><Plus className="h-3.5 w-3.5" /> New Draft</Button>
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
                    Updated {new Date(draft.updated_at).toLocaleDateString()}
                    {draft.shared_at && (
                      <span className="ml-2 text-accent-foreground">
                        · Shared {new Date(draft.shared_at).toLocaleDateString()}
                      </span>
                    )}
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

  // ── Render: Active draft editor ──
  const renderDraftEditor = () => {
    if (!activeDraft) return null;
    const guidedDef = guidedTemplate ? SECTION_DEFS.find(d => d.key === guidedTemplate) : null;

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setActiveDraft(null); loadDrafts(); }}>← Back</Button>
            <Input
              value={activeDraft.title}
              onChange={e => setActiveDraft({ ...activeDraft, title: e.target.value })}
              className="max-w-[200px] border-none bg-transparent font-semibold focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button onClick={generateAllSections} disabled={generatingAll} size="sm" variant="outline" className="gap-1 h-8 text-xs">
              {generatingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI All
            </Button>
            <Button onClick={handleCopyAll} size="sm" variant="outline" className="gap-1 h-8 text-xs">
              <Copy className="h-3 w-3" /> Copy All
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

        {/* Template selector */}
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Guided Template — fill form to generate section text:</p>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_DEFS.map(d => (
                <Button
                  key={d.key}
                  variant={guidedTemplate === d.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setGuidedTemplate(guidedTemplate === d.key ? null : d.key); setGuidedValues({}); }}
                >
                  <ClipboardList className="h-3 w-3 mr-1" />
                  {d.title.split(' ').slice(0, 2).join(' ')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Guided form */}
        {guidedDef && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{guidedDef.title} — Guided Form</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {guidedDef.prompts.map(p => (
                <div key={p.field} className="space-y-1">
                  <Label className="text-xs">{p.label}</Label>
                  <Input
                    value={guidedValues[p.field] || ''}
                    onChange={e => setGuidedValues(prev => ({ ...prev, [p.field]: e.target.value }))}
                    placeholder={p.placeholder}
                  />
                </div>
              ))}
              <Button onClick={handleGuidedGenerate} size="sm" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Generate Section Text
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Section editors */}
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
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleCopySection(section)}>
                    <Copy className="h-3 w-3" /> Copy
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
