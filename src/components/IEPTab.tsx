import { useEffect, useState, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus, FileText, Save, Sparkles, Loader2, Copy, Share2, Download, ClipboardList, ChevronRight,
} from 'lucide-react';
import type { Client, IEPDraft, IEPSection } from '@/lib/types';

// ── Template definitions ──

type TemplateKey = 'present_levels' | 'behavior_impact' | 'accommodations' | 'goals' | 'services_supports';

interface TemplateInfo {
  key: TemplateKey;
  sectionType: IEPSection['type'];
  label: string;
  shortLabel: string;
}

const TEMPLATES: TemplateInfo[] = [
  { key: 'present_levels', sectionType: 'present_levels', label: 'Present Levels', shortLabel: 'Present Levels' },
  { key: 'behavior_impact', sectionType: 'behavior_impact', label: 'Behavior Impact Statement', shortLabel: 'Behavior Impact' },
  { key: 'accommodations', sectionType: 'accommodations', label: 'Accommodations', shortLabel: 'Accommodations' },
  { key: 'goals', sectionType: 'goals', label: 'Goal Draft Builder', shortLabel: 'Goal Builder' },
  { key: 'services_supports', sectionType: 'services', label: 'Services / Supports', shortLabel: 'Services' },
];

// ── Accommodations checkbox options ──
const ACCOMMODATION_OPTIONS = {
  environment: ['Preferential seating', 'Reduced distractions', 'Noise-canceling headphones', 'Separate workspace', 'Sensory tools (fidgets)', 'Visual schedule posted'],
  instructional: ['Extended time on assignments', 'Chunked tasks', 'Visual aids / graphic organizers', 'Repeated / simplified directions', 'Modified workload', 'Peer buddy'],
  behavior: ['Token economy', 'Behavior contract', 'Frequent check-ins', 'Cool-down area', 'Self-monitoring checklist', 'Social stories'],
  assessment: ['Extended time (1.5×)', 'Separate setting', 'Read-aloud', 'Reduced answer choices', 'Breaks during testing', 'Alternative assessment format'],
};

const GOAL_DOMAINS = ['Reading', 'Written Expression', 'Math', 'On-Task Behavior', 'Social Skills', 'Self-Regulation', 'Communication', 'Adaptive / Daily Living', 'Motor Skills', 'Other'];
const MEASUREMENT_TYPES = ['Frequency', 'Duration', 'Interval recording', '% Correct / Accuracy', 'Rating scale', 'Curriculum-based measure'];
const SERVICE_TYPES = ['Specialized Academic Instruction', 'Speech / Language Therapy', 'Occupational Therapy', 'Counseling', 'Behavior Intervention', 'Adaptive PE', 'Assistive Technology', 'Other'];
const SETTINGS = ['General education classroom', 'Special education classroom', 'Small group pull-out', 'Individual pull-out', '1:1 support in gen ed'];
const PROVIDER_ROLES = ['Special education teacher', 'SLP', 'OT', 'School psychologist', 'BCBA', 'Behavior technician', 'Counselor', 'Other'];

// ── Preview generators ──

function generatePresentLevelsPreview(v: Record<string, string>): string {
  const bullets = (s: string) => s.split('\n').filter(Boolean).map(l => `• ${l.trim()}`).join('\n');
  return [
    `**Strengths:**`,
    v.strengths ? bullets(v.strengths) : '• (none entered)',
    '',
    `**Needs:**`,
    v.needs ? bullets(v.needs) : '• (none entered)',
    '',
    `**Academic Performance Summary:**`,
    v.academic_summary || '(none entered)',
    '',
    `**Functional / Behavior Summary:**`,
    v.behavior_summary || '(none entered)',
    '',
    `**Learning Style / Supports That Help:**`,
    v.learning_style ? bullets(v.learning_style) : '• (none entered)',
  ].join('\n');
}

function generateBehaviorImpactPreview(v: Record<string, string>): string {
  const behavior = v.target_behavior || '(not specified)';
  const antecedents = v.antecedents || '(not specified)';
  const impact = v.impact_on_learning || '(not specified)';
  const safety = v.safety_concerns;
  let text = `The student exhibits ${behavior.toLowerCase()}. This behavior is most likely to occur when ${antecedents.toLowerCase()}. `;
  text += `The impact on the student's learning and/or peers includes: ${impact.toLowerCase()}.`;
  if (safety) text += ` Safety concerns have been identified: ${safety.toLowerCase()}.`;
  text += `\n\nThis behavior impacts the student's ability to access the general education curriculum and make progress toward grade-level standards.`;
  return text;
}

function generateAccommodationsPreview(v: Record<string, string>): string {
  const parse = (key: string) => {
    const items = v[key];
    if (!items) return '• None selected';
    return items.split('||').map(i => `• ${i}`).join('\n');
  };
  return [
    `**Environmental Accommodations:**`, parse('environment'), '',
    `**Instructional Accommodations:**`, parse('instructional'), '',
    `**Behavior Supports:**`, parse('behavior'), '',
    `**Assessment / Testing Accommodations:**`, parse('assessment'),
  ].join('\n');
}

function generateGoalPreview(v: Record<string, string>): string {
  // Support multi-entry goals stored as JSON array in v._goals
  const goals = parseMultiEntries(v._goals);
  if (goals.length === 0) {
    const domain = v.goal_domain || '(domain)';
    const baseline = v.baseline || '(baseline)';
    const target = v.target_criteria || '(target)';
    const measurement = v.measurement_type || '(measurement)';
    const conditions = v.conditions || 'with appropriate supports';
    return formatSingleGoal({ goal_domain: domain, baseline, target_criteria: target, measurement_type: measurement, conditions });
  }
  return goals.map((g, i) => {
    const heading = goals.length > 1 ? `### Goal ${i + 1}\n\n` : '';
    return heading + formatSingleGoal(g);
  }).join('\n\n---\n\n');
}

function formatSingleGoal(g: Record<string, string>): string {
  const domain = g.goal_domain || '(domain)';
  const baseline = g.baseline || '(baseline)';
  const target = g.target_criteria || '(target)';
  const measurement = g.measurement_type || '(measurement)';
  const conditions = g.conditions || 'with appropriate supports';
  return [
    `**Goal Domain:** ${domain}`,
    '',
    `**Baseline:** ${baseline}`,
    '',
    `**Annual Goal:**`,
    `Given ${conditions.toLowerCase()}, the student will demonstrate ${domain.toLowerCase()} skills as measured by ${measurement.toLowerCase()}, improving from ${baseline.toLowerCase()} to ${target.toLowerCase()} by the annual review date.`,
    '',
    `**Mastery Criteria:** ${target}`,
    `**Measurement:** ${measurement}`,
  ].join('\n');
}

function generateServicesPreview(v: Record<string, string>): string {
  const services = parseMultiEntries(v._services);
  if (services.length === 0) {
    return formatSingleService(v);
  }
  return services.map((s, i) => {
    const heading = services.length > 1 ? `### Service ${i + 1}\n\n` : '';
    return heading + formatSingleService(s);
  }).join('\n\n---\n\n');
}

function formatSingleService(s: Record<string, string>): string {
  return [
    `**Service:** ${s.service_type || '(not specified)'}`,
    `**Frequency:** ${s.minutes_frequency || '(not specified)'}`,
    `**Setting:** ${s.setting || '(not specified)'}`,
    `**Provider:** ${s.provider_role || '(not specified)'}`,
  ].join('\n');
}

// Multi-entry helpers
function parseMultiEntries(json?: string): Record<string, string>[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

const PREVIEW_GENERATORS: Record<TemplateKey, (v: Record<string, string>) => string> = {
  present_levels: generatePresentLevelsPreview,
  behavior_impact: generateBehaviorImpactPreview,
  accommodations: generateAccommodationsPreview,
  goals: generateGoalPreview,
  services_supports: generateServicesPreview,
};

// ── Main Component ──

interface Props {
  client: Client;
}

export const IEPTab = ({ client }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  // Draft state
  const [drafts, setDrafts] = useState<IEPDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Active draft
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [draftType, setDraftType] = useState<TemplateKey | null>(null);
  const [sections, setSections] = useState<Record<string, any>>({});
  const [previewText, setPreviewText] = useState('');

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | null>(null);

  // Form state for current template
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // AI
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => { loadDrafts(); }, [client.id]);

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

  // ── Select existing draft ──
  const selectDraft = (draft: IEPDraft) => {
    setDraftId(draft.id);
    setTitle(draft.title);
    setDraftType(draft.draft_type as TemplateKey || null);

    // Parse sections JSON
    const sec = draft.sections;
    if (Array.isArray(sec) && sec.length > 0) {
      // Old format: array of IEPSection objects - reconstruct preview
      const preview = sec.map((s: IEPSection) => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
      setPreviewText(preview);
      setSections({});
      setFormValues({});
      // Try to detect template type from first section
      const firstType = sec[0]?.type;
      const tpl = TEMPLATES.find(t => t.sectionType === firstType);
      setSelectedTemplate(tpl?.key || null);
    } else if (sec && typeof sec === 'object' && !Array.isArray(sec)) {
      // New format: { formValues, previewText, templateKey }
      const parsed = sec as any;
      setFormValues(parsed.formValues || {});
      setPreviewText(parsed.previewText || '');
      setSelectedTemplate(parsed.templateKey || null);
      setSections(parsed);
    } else {
      setFormValues({});
      setPreviewText('');
      setSections({});
      setSelectedTemplate(null);
    }
  };

  // ── Create new draft ──
  const createDraft = () => {
    const date = new Date().toLocaleDateString();
    setDraftId(null);
    setTitle(`IEP Draft – ${date}`);
    setDraftType(null);
    setSections({});
    setPreviewText('');
    setFormValues({});
    setSelectedTemplate(null);
  };

  // ── Clear / deselect draft ──
  const clearDraft = () => {
    setDraftId(null);
    setTitle('');
    setDraftType(null);
    setSections({});
    setPreviewText('');
    setFormValues({});
    setSelectedTemplate(null);
  };

  // ── Save draft ──
  const saveDraft = async () => {
    if (!user || !currentWorkspace) return;
    setSaving(true);

    const sectionsPayload = {
      formValues,
      previewText,
      templateKey: selectedTemplate,
    };

    if (draftId) {
      const { error } = await supabase.from('iep_drafts').update({
        title,
        sections: sectionsPayload,
        status: 'draft',
        draft_type: selectedTemplate || undefined,
        updated_at: new Date().toISOString(),
      }).eq('id', draftId);
      if (error) toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
      else toast({ title: 'Draft saved' });
    } else {
      const { data, error } = await supabase.from('iep_drafts').insert({
        client_id: client.id,
        created_by: user.id,
        agency_id: currentWorkspace.agency_id,
        title,
        sections: sectionsPayload,
        status: 'draft',
        draft_type: selectedTemplate || 'general',
      }).select().single();
      if (error) toast({ title: 'Error creating', description: error.message, variant: 'destructive' });
      else {
        toast({ title: 'Draft created & saved' });
        if (data) setDraftId(data.id);
      }
    }

    await loadDrafts();
    setSaving(false);
  };

  // ── Share draft ──
  const shareDraft = async () => {
    if (!draftId || !user) return;
    // Save first
    await saveDraft();
    setSaving(true);
    const { error } = await supabase.from('iep_drafts').update({
      status: 'shared',
      shared_at: new Date().toISOString(),
      shared_by: user.id,
    }).eq('id', draftId);
    if (error) toast({ title: 'Error sharing', description: error.message, variant: 'destructive' });
    else toast({ title: 'Draft shared with BCBA / Nova', description: 'Now visible in NovaTrack Core.' });
    await loadDrafts();
    setSaving(false);
  };

  // ── Select template → update form ──
  const handleTemplateSelect = (key: TemplateKey) => {
    setSelectedTemplate(key);
    // Don't clear form values if same template
    if (key !== selectedTemplate) {
      setFormValues({});
    }
  };

  // ── Update form value and auto-regenerate preview ──
  const updateFormValue = useCallback((field: string, value: string) => {
    setFormValues(prev => {
      const next = { ...prev, [field]: value };
      // Auto-generate preview
      if (selectedTemplate) {
        const generator = PREVIEW_GENERATORS[selectedTemplate];
        if (generator) setPreviewText(generator(next));
      }
      return next;
    });
  }, [selectedTemplate]);

  // ── Toggle checkbox in accommodations ──
  const toggleCheckbox = (category: string, item: string) => {
    const current = formValues[category] || '';
    const items = current ? current.split('||') : [];
    const idx = items.indexOf(item);
    if (idx >= 0) items.splice(idx, 1);
    else items.push(item);
    updateFormValue(category, items.join('||'));
  };

  const isChecked = (category: string, item: string) => {
    const current = formValues[category] || '';
    return current.split('||').includes(item);
  };

  // ── Export ──
  const handleExport = () => {
    const text = `# ${title}\n\n${previewText}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Copy preview ──
  const handleCopy = () => {
    navigator.clipboard.writeText(previewText);
    toast({ title: 'Copied to clipboard' });
  };

  // ── AI generation for selected template ──
  const handleAIGenerate = async () => {
    if (!selectedTemplate) return;
    setGeneratingAI(true);
    try {
      const [logsRes, catsRes] = await Promise.all([
        supabase.from('abc_logs').select('*').eq('client_id', client.id).order('logged_at', { ascending: false }).limit(30),
        supabase.from('behavior_categories').select('*').eq('client_id', client.id),
      ]);
      const tpl = TEMPLATES.find(t => t.key === selectedTemplate)!;
      const { data, error } = await cloudSupabase.functions.invoke('generate-iep-goals', {
        body: {
          studentName: `${client.first_name} ${client.last_name}`,
          grade: client.grade,
          abcLogs: logsRes.data || [],
          behaviorCategories: catsRes.data || [],
          sectionType: tpl.sectionType,
        },
      });
      if (error) throw error;
      if (data?.content) {
        setPreviewText(data.content);
        toast({ title: 'AI content generated' });
      }
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingAI(false);
    }
  };

  // Is there an active/new draft?
  const hasDraft = draftId !== null || title !== '';

  // Current draft status
  const currentDraftStatus = draftId ? drafts.find(d => d.id === draftId)?.status : null;

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    review: 'bg-primary/10 text-primary',
    final: 'bg-accent/10 text-accent-foreground',
    shared: 'bg-accent text-accent-foreground',
  };

  // ── Render: Left Panel ──
  const renderLeftPanel = () => (
    <div className="flex flex-col h-full">
      {/* My Drafts */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Drafts</h3>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={createDraft}>
            <Plus className="h-3 w-3" /> New
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No drafts yet. Create your first draft.
          </p>
        ) : (
          <ScrollArea className="max-h-[180px]">
            <div className="space-y-1 pr-2">
              {drafts.map(draft => (
                <button
                  key={draft.id}
                  onClick={() => selectDraft(draft)}
                  className={`w-full text-left rounded-md border px-2.5 py-2 text-xs transition-colors ${
                    draftId === draft.id
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border/40 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium">{draft.title}</span>
                    {draft.status === 'shared' && (
                      <Badge className="text-[9px] px-1 py-0 bg-accent text-accent-foreground">Shared</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(draft.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Separator className="mb-4" />

      {/* Template Picker */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Templates</h3>
        <div className="space-y-1">
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.key}
              onClick={() => handleTemplateSelect(tpl.key)}
              className={`w-full flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${
                selectedTemplate === tpl.key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted/50 text-foreground/80'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" />
                {tpl.shortLabel}
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Render: Middle Panel (Guided Form) ──
  const renderMiddlePanel = () => {
    if (!hasDraft) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Select a draft or create a new one to get started.</p>
          <Button variant="link" className="mt-2" onClick={createDraft}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create New Draft
          </Button>
        </div>
      );
    }

    if (!selectedTemplate) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Choose a template from the left panel to fill out the guided form.</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-full">
        <div className="space-y-4 pr-2">
          <h3 className="text-sm font-semibold">
            {TEMPLATES.find(t => t.key === selectedTemplate)?.label}
          </h3>

          {selectedTemplate === 'present_levels' && renderPresentLevelsForm()}
          {selectedTemplate === 'behavior_impact' && renderBehaviorImpactForm()}
          {selectedTemplate === 'accommodations' && renderAccommodationsForm()}
          {selectedTemplate === 'goals' && renderGoalBuilderForm()}
          {selectedTemplate === 'services_supports' && renderServicesForm()}

          <Button onClick={handleAIGenerate} disabled={generatingAI} variant="outline" size="sm" className="gap-1.5 w-full mt-4">
            {generatingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generatingAI ? 'Generating with AI…' : 'Generate with AI'}
          </Button>
        </div>
      </ScrollArea>
    );
  };

  // ── Present Levels Form ──
  const renderPresentLevelsForm = () => (
    <div className="space-y-3">
      <FormField label="Strengths (one per line)" multiline
        value={formValues.strengths || ''}
        onChange={v => updateFormValue('strengths', v)}
        placeholder="e.g.\nReads at grade level\nStrong in math computation"
      />
      <FormField label="Needs (one per line)" multiline
        value={formValues.needs || ''}
        onChange={v => updateFormValue('needs', v)}
        placeholder="e.g.\nDifficulty with written expression\nReading comprehension below grade level"
      />
      <FormField label="Academic Performance Summary"
        value={formValues.academic_summary || ''}
        onChange={v => updateFormValue('academic_summary', v)}
        placeholder="Brief summary of current academic performance…"
      />
      <FormField label="Functional / Behavior Summary"
        value={formValues.behavior_summary || ''}
        onChange={v => updateFormValue('behavior_summary', v)}
        placeholder="Brief summary of functional behavior…"
      />
      <FormField label="Learning Style / Supports That Help (one per line)" multiline
        value={formValues.learning_style || ''}
        onChange={v => updateFormValue('learning_style', v)}
        placeholder="e.g.\nVisual supports\nSmall group instruction"
      />
    </div>
  );

  // ── Behavior Impact Form ──
  const renderBehaviorImpactForm = () => (
    <div className="space-y-3">
      <FormField label="Target Behavior"
        value={formValues.target_behavior || ''}
        onChange={v => updateFormValue('target_behavior', v)}
        placeholder="e.g. off-task behavior, verbal outbursts, physical aggression"
      />
      <FormField label="When It Occurs (Antecedents)"
        value={formValues.antecedents || ''}
        onChange={v => updateFormValue('antecedents', v)}
        placeholder="e.g. during transitions, when given non-preferred tasks"
      />
      <FormField label="Impact on Learning / Peers"
        value={formValues.impact_on_learning || ''}
        onChange={v => updateFormValue('impact_on_learning', v)}
        placeholder="e.g. misses 15 min of instruction daily, disrupts peer learning"
      />
      <FormField label="Safety Concerns (optional)"
        value={formValues.safety_concerns || ''}
        onChange={v => updateFormValue('safety_concerns', v)}
        placeholder="e.g. risk of injury to self or others"
      />
    </div>
  );

  // ── Accommodations Form (checkboxes) ──
  const renderAccommodationsForm = () => (
    <div className="space-y-4">
      {Object.entries(ACCOMMODATION_OPTIONS).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <Label className="text-xs font-medium capitalize">{category.replace('_', ' ')} Accommodations</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {items.map(item => (
              <label key={item} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1.5 py-1">
                <Checkbox
                  checked={isChecked(category, item)}
                  onCheckedChange={() => toggleCheckbox(category, item)}
                />
                {item}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Goal Builder Form (multi-entry) ──
  const renderGoalBuilderForm = () => {
    const goals: Record<string, string>[] = parseMultiEntries(formValues._goals);
    if (goals.length === 0) goals.push({});

    const updateGoal = (idx: number, field: string, value: string) => {
      const updated = [...goals];
      updated[idx] = { ...updated[idx], [field]: value };
      const next = { ...formValues, _goals: JSON.stringify(updated) };
      setFormValues(next);
      if (selectedTemplate) setPreviewText(PREVIEW_GENERATORS[selectedTemplate](next));
    };
    const addGoal = () => {
      const updated = [...goals, {}];
      const next = { ...formValues, _goals: JSON.stringify(updated) };
      setFormValues(next);
      if (selectedTemplate) setPreviewText(PREVIEW_GENERATORS[selectedTemplate](next));
    };
    const removeGoal = (idx: number) => {
      const updated = goals.filter((_, i) => i !== idx);
      const next = { ...formValues, _goals: JSON.stringify(updated.length ? updated : [{}]) };
      setFormValues(next);
      if (selectedTemplate) setPreviewText(PREVIEW_GENERATORS[selectedTemplate](next));
    };

    return (
      <div className="space-y-4">
        {goals.map((goal, idx) => (
          <div key={idx} className="space-y-3 border border-border/40 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Goal {idx + 1}</span>
              {goals.length > 1 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => removeGoal(idx)}>Remove</Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Goal Domain</Label>
              <Select value={goal.goal_domain || ''} onValueChange={v => updateGoal(idx, 'goal_domain', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select domain…" /></SelectTrigger>
                <SelectContent>
                  {GOAL_DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FormField label="Baseline (current level)" value={goal.baseline || ''} onChange={v => updateGoal(idx, 'baseline', v)} placeholder="e.g. currently reads 45 wpm" />
            <FormField label="Target / Mastery Criteria" value={goal.target_criteria || ''} onChange={v => updateGoal(idx, 'target_criteria', v)} placeholder="e.g. will read 80 wpm across 3 probes" />
            <div className="space-y-1.5">
              <Label className="text-xs">Measurement Type</Label>
              <Select value={goal.measurement_type || ''} onValueChange={v => updateGoal(idx, 'measurement_type', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select measurement…" /></SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FormField label="Conditions (supports, prompts)" value={goal.conditions || ''} onChange={v => updateGoal(idx, 'conditions', v)} placeholder="e.g. with visual supports and 1 verbal prompt" />
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1 text-xs w-full" onClick={addGoal}>
          <Plus className="h-3 w-3" /> Add Another Goal
        </Button>
      </div>
    );
  };

  // ── Services Form (multi-entry) ──
  const renderServicesForm = () => {
    const services: Record<string, string>[] = parseMultiEntries(formValues._services);
    if (services.length === 0) services.push({});

    const updateService = (idx: number, field: string, value: string) => {
      const updated = [...services];
      updated[idx] = { ...updated[idx], [field]: value };
      const next = { ...formValues, _services: JSON.stringify(updated) };
      setFormValues(next);
      if (selectedTemplate) setPreviewText(PREVIEW_GENERATORS[selectedTemplate](next));
    };
    const addService = () => {
      const updated = [...services, {}];
      const next = { ...formValues, _services: JSON.stringify(updated) };
      setFormValues(next);
      if (selectedTemplate) setPreviewText(PREVIEW_GENERATORS[selectedTemplate](next));
    };
    const removeService = (idx: number) => {
      const updated = services.filter((_, i) => i !== idx);
      const next = { ...formValues, _services: JSON.stringify(updated.length ? updated : [{}]) };
      setFormValues(next);
      if (selectedTemplate) setPreviewText(PREVIEW_GENERATORS[selectedTemplate](next));
    };

    return (
      <div className="space-y-4">
        {services.map((svc, idx) => (
          <div key={idx} className="space-y-3 border border-border/40 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Service {idx + 1}</span>
              {services.length > 1 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => removeService(idx)}>Remove</Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Service Type</Label>
              <Select value={svc.service_type || ''} onValueChange={v => updateService(idx, 'service_type', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select service…" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FormField label="Minutes / Frequency" value={svc.minutes_frequency || ''} onChange={v => updateService(idx, 'minutes_frequency', v)} placeholder="e.g. 30 min, 3× per week" />
            <div className="space-y-1.5">
              <Label className="text-xs">Setting</Label>
              <Select value={svc.setting || ''} onValueChange={v => updateService(idx, 'setting', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select setting…" /></SelectTrigger>
                <SelectContent>
                  {SETTINGS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Provider Role</Label>
              <Select value={svc.provider_role || ''} onValueChange={v => updateService(idx, 'provider_role', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select provider…" /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_ROLES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1 text-xs w-full" onClick={addService}>
          <Plus className="h-3 w-3" /> Add Another Service
        </Button>
      </div>
    );
  };

  // ── Render: Right Panel (Preview Editor + Actions) ──
  const renderRightPanel = () => {
    if (!hasDraft) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Draft preview will appear here.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Title + Status */}
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="border-none bg-transparent font-semibold text-sm focus-visible:ring-0 px-0"
            placeholder="Draft title…"
          />
          {currentDraftStatus && (
            <Badge className={`shrink-0 text-[10px] ${statusColors[currentDraftStatus] || ''}`}>
              {currentDraftStatus}
            </Badge>
          )}
        </div>

        {/* Preview Editor */}
        <Textarea
          value={previewText}
          onChange={e => setPreviewText(e.target.value)}
          className="flex-1 min-h-[300px] resize-y text-xs font-mono leading-relaxed"
          placeholder="Preview text will appear here as you fill out the form, or you can type directly…"
        />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Button onClick={saveDraft} disabled={saving} size="sm" className="gap-1 text-xs">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button onClick={shareDraft} disabled={saving || !draftId} size="sm" variant="outline" className="gap-1 text-xs">
            <Share2 className="h-3 w-3" /> Share
          </Button>
          <Button onClick={handleCopy} size="sm" variant="outline" className="gap-1 text-xs">
            <Copy className="h-3 w-3" /> Copy
          </Button>
          <Button onClick={handleExport} size="sm" variant="outline" className="gap-1 text-xs">
            <Download className="h-3 w-3" /> Export
          </Button>
          {hasDraft && (
            <Button onClick={clearDraft} size="sm" variant="ghost" className="text-xs text-muted-foreground ml-auto">
              Close
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ── Main Layout ──
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
      {/* Left Panel */}
      <Card className="lg:col-span-3 border-border/40">
        <CardContent className="p-3">
          {renderLeftPanel()}
        </CardContent>
      </Card>

      {/* Middle Panel */}
      <Card className="lg:col-span-4 border-border/40">
        <CardContent className="p-3">
          {renderMiddlePanel()}
        </CardContent>
      </Card>

      {/* Right Panel */}
      <Card className="lg:col-span-5 border-border/40">
        <CardContent className="p-3">
          {renderRightPanel()}
        </CardContent>
      </Card>
    </div>
  );
};

// ── Reusable form field ──
const FormField = ({
  label, value, onChange, placeholder, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {multiline ? (
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[60px] text-xs resize-y"
      />
    ) : (
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    )}
  </div>
);
