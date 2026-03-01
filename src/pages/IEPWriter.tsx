import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { fetchAccessibleClients } from '@/lib/client-access';
import { Plus, FileText, Save, Trash2, Sparkles, Loader2, Copy, Share2, Download, ClipboardList } from 'lucide-react';
import type { Client, IEPDraft, IEPSection } from '@/lib/types';

// ── Same section definitions with guided prompts ──
const SECTION_DEFS: {
  key: string;
  type: IEPSection['type'];
  title: string;
  prompts: { label: string; placeholder: string; field: string }[];
  template: (v: Record<string, string>) => string;
}[] = [
  {
    key: 'present_levels', type: 'present_levels', title: 'Present Levels of Performance',
    prompts: [
      { label: 'Academic strengths', placeholder: 'e.g. reads at grade level', field: 'strengths' },
      { label: 'Areas of concern', placeholder: 'e.g. difficulty with written expression', field: 'concerns' },
      { label: 'Current data / assessment results', placeholder: 'e.g. scored 72% on CBM', field: 'data' },
      { label: 'Impact on general education', placeholder: 'e.g. requires extended time', field: 'impact' },
    ],
    template: v => `**Academic Strengths:** ${v.strengths || '—'}\n\n**Areas of Concern:** ${v.concerns || '—'}\n\n**Current Data:** ${v.data || '—'}\n\n**Impact:** ${v.impact || '—'}`,
  },
  {
    key: 'behavior_impact', type: 'behavior_impact', title: 'Behavior Impact Statement',
    prompts: [
      { label: 'Target behavior(s)', placeholder: 'e.g. off-task, verbal outbursts', field: 'behaviors' },
      { label: 'Frequency / intensity', placeholder: 'e.g. 3–5× per period', field: 'frequency' },
      { label: 'Impact on learning', placeholder: 'e.g. misses 15 min instruction daily', field: 'learning_impact' },
      { label: 'Current interventions', placeholder: 'e.g. token economy, visual schedule', field: 'interventions' },
    ],
    template: v => `**Target Behavior(s):** ${v.behaviors || '—'}\n\n**Frequency/Intensity:** ${v.frequency || '—'}\n\n**Impact on Learning:** ${v.learning_impact || '—'}\n\n**Current Interventions:** ${v.interventions || '—'}`,
  },
  {
    key: 'accommodations', type: 'accommodations', title: 'Accommodations & Modifications',
    prompts: [
      { label: 'Classroom accommodations', placeholder: 'e.g. preferential seating, fidget tool', field: 'classroom' },
      { label: 'Assessment accommodations', placeholder: 'e.g. extended time (1.5×), separate setting', field: 'assessment' },
      { label: 'Environmental modifications', placeholder: 'e.g. noise-canceling headphones', field: 'environmental' },
    ],
    template: v => `**Classroom:**\n${(v.classroom || '').split(',').map(s => `• ${s.trim()}`).filter(s => s !== '• ').join('\n') || '• —'}\n\n**Assessment:**\n${(v.assessment || '').split(',').map(s => `• ${s.trim()}`).filter(s => s !== '• ').join('\n') || '• —'}\n\n**Environmental:**\n${(v.environmental || '').split(',').map(s => `• ${s.trim()}`).filter(s => s !== '• ').join('\n') || '• —'}`,
  },
  {
    key: 'goals', type: 'goals', title: 'Annual Goals & Objectives',
    prompts: [
      { label: 'Goal area', placeholder: 'e.g. reading comprehension', field: 'area' },
      { label: 'Baseline', placeholder: 'e.g. currently reads 45 wpm', field: 'baseline' },
      { label: 'Target', placeholder: 'e.g. will read 80 wpm', field: 'target' },
      { label: 'Measurement method', placeholder: 'e.g. curriculum-based measure', field: 'measurement' },
      { label: 'Timeline', placeholder: 'e.g. by annual review date', field: 'timeline' },
    ],
    template: v => `**Goal Area:** ${v.area || '—'}\n**Baseline:** ${v.baseline || '—'}\n**Target:** ${v.target || '—'}\n**Measurement:** ${v.measurement || '—'}\n**Timeline:** ${v.timeline || '—'}`,
  },
  {
    key: 'services_supports', type: 'services', title: 'Services & Supports',
    prompts: [
      { label: 'Service type', placeholder: 'e.g. specialized instruction, speech', field: 'service' },
      { label: 'Frequency', placeholder: 'e.g. 3× per week', field: 'frequency' },
      { label: 'Duration', placeholder: 'e.g. 30 min per session', field: 'duration' },
      { label: 'Provider', placeholder: 'e.g. special ed teacher', field: 'provider' },
    ],
    template: v => `**Service:** ${v.service || '—'}\n**Frequency:** ${v.frequency || '—'}\n**Duration:** ${v.duration || '—'}\n**Provider:** ${v.provider || '—'}`,
  },
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
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  // Guided form
  const [guidedTemplate, setGuidedTemplate] = useState<string | null>(null);
  const [guidedValues, setGuidedValues] = useState<Record<string, string>>({});

  useEffect(() => { if (currentWorkspace) loadClients(); }, [currentWorkspace]);
  useEffect(() => { if (selectedClientId) loadDrafts(); }, [selectedClientId]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id, permission: 'can_generate_reports' });
      setClients(normalizeClients(data));
    } catch (err: any) { console.error('Failed to load clients:', err); }
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
    const sections: IEPSection[] = SECTION_DEFS.map((d, i) => ({
      id: crypto.randomUUID(), type: d.type, title: d.title, content: '', order: i,
    }));

    const { data, error } = await supabase.from('iep_drafts').insert({
      client_id: selectedClientId,
      created_by: user?.id,
      agency_id: currentWorkspace?.agency_id,
      title: newTitle.trim(),
      sections,
      status: 'draft',
    }).select().single();

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Draft created' }); setShowNew(false); setNewTitle(''); loadDrafts(); if (data) setActiveDraft(data); }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!activeDraft) return;
    setSaving(true);
    const { error } = await supabase.from('iep_drafts').update({
      sections: activeDraft.sections, title: activeDraft.title, status: 'draft', updated_at: new Date().toISOString(),
    }).eq('id', activeDraft.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Draft saved' });
    setSaving(false);
  };

  const handleShare = async () => {
    if (!activeDraft || !user) return;
    setSaving(true);
    const { error } = await supabase.from('iep_drafts').update({
      status: 'shared', shared_at: new Date().toISOString(), shared_by: user.id,
    }).eq('id', activeDraft.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { setActiveDraft({ ...activeDraft, status: 'shared' as any, shared_at: new Date().toISOString() }); toast({ title: 'Shared with BCBA/Nova' }); }
    setSaving(false);
  };

  const handleCopyAll = () => {
    if (!activeDraft) return;
    navigator.clipboard.writeText(activeDraft.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n'));
    toast({ title: 'Copied to clipboard' });
  };

  const handleCopySection = (s: IEPSection) => {
    navigator.clipboard.writeText(s.content);
    toast({ title: `"${s.title}" copied` });
  };

  const handleExport = () => {
    if (!activeDraft) return;
    const text = `# ${activeDraft.title}\n\n` + activeDraft.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${activeDraft.title.replace(/\s+/g, '_')}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const updateSection = (id: string, content: string) => {
    setActiveDraft(prev => prev ? { ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, content } : s) } : prev);
  };

  const removeSection = (id: string) => {
    setActiveDraft(prev => prev ? { ...prev, sections: prev.sections.filter(s => s.id !== id) } : prev);
  };

  const handleGuidedGenerate = () => {
    if (!guidedTemplate || !activeDraft) return;
    const def = SECTION_DEFS.find(d => d.key === guidedTemplate);
    if (!def) return;
    const text = def.template(guidedValues);
    const existing = activeDraft.sections.find(s => s.type === def.type);
    if (existing) { updateSection(existing.id, text); }
    else { setActiveDraft({ ...activeDraft, sections: [...activeDraft.sections, { id: crypto.randomUUID(), type: def.type, title: def.title, content: text, order: activeDraft.sections.length }] }); }
    setGuidedTemplate(null); setGuidedValues({});
    toast({ title: 'Section text generated' });
  };

  const generateForSection = async (section: IEPSection) => {
    if (!selectedClientId) return;
    setGeneratingSection(section.id);
    try {
      const [logsRes, catsRes, clientRes] = await Promise.all([
        supabase.from('abc_logs').select('*').eq('client_id', selectedClientId).order('logged_at', { ascending: false }).limit(30),
        supabase.from('behavior_categories').select('*').eq('client_id', selectedClientId),
        supabase.from('clients').select('first_name, last_name, grade').eq('id', selectedClientId).single(),
      ]);
      const c = clientRes.data;
      const { data, error } = await cloudSupabase.functions.invoke('generate-iep-goals', {
        body: { studentName: c ? `${c.first_name} ${c.last_name}` : 'Unknown', grade: c?.grade, abcLogs: logsRes.data || [], behaviorCategories: catsRes.data || [], sectionType: section.type === 'custom' ? section.title : section.type },
      });
      if (error) throw error;
      if (data?.content) { updateSection(section.id, data.content); toast({ title: 'AI content generated' }); }
    } catch (err: any) { toast({ title: 'Generation failed', description: err.message, variant: 'destructive' }); }
    finally { setGeneratingSection(null); }
  };

  const generateAllSections = async () => {
    if (!activeDraft || !selectedClientId) return;
    setGeneratingAll(true);
    try {
      const [logsRes, catsRes, clientRes] = await Promise.all([
        supabase.from('abc_logs').select('*').eq('client_id', selectedClientId).order('logged_at', { ascending: false }).limit(30),
        supabase.from('behavior_categories').select('*').eq('client_id', selectedClientId),
        supabase.from('clients').select('first_name, last_name, grade').eq('id', selectedClientId).single(),
      ]);
      const c = clientRes.data;
      for (const section of activeDraft.sections) {
        setGeneratingSection(section.id);
        try {
          const { data } = await cloudSupabase.functions.invoke('generate-iep-goals', {
            body: { studentName: c ? `${c.first_name} ${c.last_name}` : 'Unknown', grade: c?.grade, abcLogs: logsRes.data || [], behaviorCategories: catsRes.data || [], sectionType: section.type === 'custom' ? section.title : section.type },
          });
          if (data?.content) updateSection(section.id, data.content);
        } catch {}
        setGeneratingSection(null);
      }
      toast({ title: 'All sections generated' });
    } finally { setGeneratingAll(false); setGeneratingSection(null); }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground', review: 'bg-primary/10 text-primary',
    final: 'bg-accent/10 text-accent-foreground', shared: 'bg-accent text-accent-foreground',
  };

  const guidedDef = guidedTemplate ? SECTION_DEFS.find(d => d.key === guidedTemplate) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-heading">IEP Writer</h2>
        <p className="text-sm text-muted-foreground">Create and manage IEP documents</p>
      </div>

      <div className="max-w-sm">
        <Label className="mb-2 block text-xs text-muted-foreground">Select Student</Label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger><SelectValue placeholder="Choose a student…" /></SelectTrigger>
          <SelectContent>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedClientId && !activeDraft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Drafts</h3>
            <Dialog open={showNew} onOpenChange={setShowNew}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New IEP</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create IEP Draft</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input placeholder="e.g., Annual IEP Review 2026" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                  </div>
                  <Button onClick={handleCreateDraft} disabled={saving} className="w-full">{saving ? 'Creating…' : 'Create Draft'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
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
              {drafts.map(draft => (
                <Card key={draft.id} className="cursor-pointer border-border/50 transition-shadow hover:shadow-md" onClick={() => setActiveDraft(draft)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{draft.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {new Date(draft.updated_at).toLocaleDateString()}
                          {draft.shared_at && <span className="ml-1 text-accent-foreground">· Shared {new Date(draft.shared_at).toLocaleDateString()}</span>}
                        </p>
                      </div>
                      <Badge className={statusColors[draft.status] || ''}>{draft.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeDraft && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setActiveDraft(null)}>← Back</Button>
              <Input value={activeDraft.title} onChange={e => setActiveDraft({ ...activeDraft, title: e.target.value })} className="max-w-xs border-none bg-transparent text-lg font-semibold focus-visible:ring-0" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button onClick={generateAllSections} disabled={generatingAll || !!generatingSection} size="sm" variant="outline" className="gap-1.5 text-xs">
                {generatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generatingAll ? 'Generating…' : 'AI All'}
              </Button>
              <Button onClick={handleCopyAll} size="sm" variant="outline" className="gap-1 text-xs"><Copy className="h-3.5 w-3.5" /> Copy</Button>
              <Button onClick={handleExport} size="sm" variant="outline" className="gap-1 text-xs"><Download className="h-3.5 w-3.5" /> Export</Button>
              <Button onClick={handleShare} size="sm" variant="outline" className="gap-1 text-xs"><Share2 className="h-3.5 w-3.5" /> Share</Button>
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5"><Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>

          {/* Template selector */}
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Guided Template — fill form to generate section text:</p>
              <div className="flex flex-wrap gap-1.5">
                {SECTION_DEFS.map(d => (
                  <Button key={d.key} variant={guidedTemplate === d.key ? 'default' : 'outline'} size="sm" className="h-auto py-1.5 px-2.5 text-xs"
                    onClick={() => { setGuidedTemplate(guidedTemplate === d.key ? null : d.key); setGuidedValues({}); }}>
                    <ClipboardList className="h-3 w-3 mr-1 shrink-0" />{d.title}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {guidedDef && (
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{guidedDef.title} — Guided Form</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {guidedDef.prompts.map(p => (
                  <div key={p.field} className="space-y-1">
                    <Label className="text-xs">{p.label}</Label>
                    <Input value={guidedValues[p.field] || ''} onChange={e => setGuidedValues(prev => ({ ...prev, [p.field]: e.target.value }))} placeholder={p.placeholder} />
                  </div>
                ))}
                <Button onClick={handleGuidedGenerate} size="sm" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Generate Section Text</Button>
              </CardContent>
            </Card>
          )}

          {activeDraft.sections.map(section => (
            <Card key={section.id} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary" disabled={generatingSection === section.id} onClick={() => generateForSection(section)}>
                      {generatingSection === section.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      AI
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleCopySection(section)}><Copy className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeSection(section.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea value={section.content} onChange={e => updateSection(section.id, e.target.value)} className="min-h-[120px] resize-y" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default IEPWriter;
