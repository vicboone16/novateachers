import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { fetchAccessibleClients } from '@/lib/client-access';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Target,
  TrendingUp,
  Briefcase,
  Shield,
  Eye,
  ThumbsUp,
  Send,
  Activity,
  ShieldCheck,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { Client } from '@/lib/types';

interface IEPDocument {
  id: string;
  student_id: string;
  file_name: string;
  file_url: string;
  ocr_raw_text: string | null;
  ocr_cleaned_text: string | null;
  ocr_confidence: number | null;
  pipeline_status: string;
  pipeline_error: string | null;
  sections_detected: any[];
  global_issues: any[];
  created_at: string;
}

const PIPELINE_STEPS = [
  { key: 'uploaded', label: 'Uploaded', progress: 10 },
  { key: 'cleaning', label: 'OCR Cleaning', progress: 20 },
  { key: 'cleaned', label: 'Cleaned', progress: 30 },
  { key: 'sections_detected', label: 'Sections Found', progress: 40 },
  { key: 'goals_extracted', label: 'Goals Extracted', progress: 55 },
  { key: 'progress_extracted', label: 'Progress Extracted', progress: 65 },
  { key: 'services_extracted', label: 'Services Extracted', progress: 75 },
  { key: 'accommodations_extracted', label: 'Accommodations Extracted', progress: 85 },
  { key: 'validating', label: 'Validating Goals', progress: 92 },
  { key: 'ready', label: 'Ready for Review', progress: 100 },
  { key: 'error', label: 'Error', progress: 0 },
];

const QUALITY_COLORS: Record<string, string> = {
  high: 'border-green-500 text-green-700 bg-green-50',
  medium: 'border-amber-500 text-amber-700 bg-amber-50',
  low: 'border-destructive text-destructive bg-destructive/5',
};

const IEPReader = () => {
  const { user, session } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [documents, setDocuments] = useState<IEPDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<IEPDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingToWriter, setSendingToWriter] = useState<string | null>(null);
  const [linkingGoal, setLinkingGoal] = useState<string | null>(null);
  const [targets, setTargets] = useState<any[]>([]);

  // Extracted data for selected doc
  const [goals, setGoals] = useState<any[]>([]);
  const [progressEntries, setProgressEntries] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [accommodations, setAccommodations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { if (currentWorkspace) loadClients(); }, [currentWorkspace]);
  useEffect(() => { if (selectedClientId) { loadDocuments(); loadTargets(); } }, [selectedClientId]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      setClients(normalizeClients(data));
    } catch { /* ignore */ }
  };

  const loadDocuments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('iep_documents')
      .select('*')
      .eq('student_id', selectedClientId)
      .order('created_at', { ascending: false });
    setDocuments((data || []) as IEPDocument[]);
    setLoading(false);
  };

  const loadTargets = async () => {
    const { data } = await supabase
      .from('teacher_targets')
      .select('*')
      .eq('client_id', selectedClientId);
    setTargets(data || []);
  };

  const loadExtractedData = useCallback(async (docId: string) => {
    const [g, p, s, a] = await Promise.all([
      supabase.from('iep_extracted_goals').select('*').eq('document_id', docId),
      supabase.from('iep_extracted_progress').select('*').eq('document_id', docId),
      supabase.from('iep_extracted_services').select('*').eq('document_id', docId),
      supabase.from('iep_extracted_accommodations').select('*').eq('document_id', docId),
    ]);
    setGoals((g.data || []) as any[]);
    setProgressEntries((p.data || []) as any[]);
    setServices((s.data || []) as any[]);
    setAccommodations((a.data || []) as any[]);
  }, []);

  const handleSelectDoc = (doc: IEPDocument) => {
    setSelectedDoc(doc);
    setActiveTab('overview');
    loadExtractedData(doc.id);
  };

  // ─── Upload Handler ────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !currentWorkspace || !selectedClientId) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 20MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/${selectedClientId}/${Date.now()}_${file.name}`;
      // Use Cloud client for storage (bucket lives on Lovable Cloud)
      const { error: uploadErr } = await cloudSupabase.storage
        .from('iep-uploads')
        .upload(path, file);

      if (uploadErr) throw uploadErr;

      const { data: doc, error: insertErr } = await supabase
        .from('iep_documents')
        .insert({
          agency_id: currentWorkspace.agency_id,
          student_id: selectedClientId,
          uploaded_by: user.id,
          file_url: path,
          file_name: file.name,
          file_size_bytes: file.size,
          pipeline_status: 'uploaded',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      toast({ title: 'IEP uploaded successfully' });
      loadDocuments();

      if (doc) {
        const text = await extractTextFromFile(file);
        if (text) {
          await supabase.from('iep_documents').update({ ocr_raw_text: text }).eq('id', doc.id);
          runPipeline(doc.id, text);
        }
      }
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const extractTextFromFile = async (file: File): Promise<string | null> => {
    try {
      const text = await file.text();
      return text || null;
    } catch {
      return null;
    }
  };

  // ─── Pipeline Runner ───────────────────────────────────────
  const runPipeline = async (docId: string, rawText: string) => {
    setProcessing(true);
    const token = session?.access_token;

    const updateStatus = async (status: string) => {
      await supabase.from('iep_documents').update({ pipeline_status: status }).eq('id', docId);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, pipeline_status: status } : d));
      if (selectedDoc?.id === docId) setSelectedDoc(prev => prev ? { ...prev, pipeline_status: status } : prev);
    };

    try {
      // Step 1: OCR Clean
      await updateStatus('cleaning');
      const { data: cleanResult, error: cleanErr } = await invokeCloudFunction('process-iep', {
        step: 'ocr_clean', document_id: docId, raw_text: rawText,
      }, token);
      if (cleanErr) throw cleanErr;

      const cleanedText = cleanResult?.result?.cleaned_text || rawText;
      await updateStatus('cleaned');

      // Step 2: Section Detection
      const { data: sectionsResult, error: sectErr } = await invokeCloudFunction('process-iep', {
        step: 'detect_sections', document_id: docId, raw_text: cleanedText,
      }, token);
      if (sectErr) throw sectErr;
      await updateStatus('sections_detected');

      // Step 3: Goal Extraction
      const { data: goalsResult, error: goalErr } = await invokeCloudFunction('process-iep', {
        step: 'extract_goals', document_id: docId, raw_text: cleanedText,
      }, token);
      if (goalErr) throw goalErr;
      await updateStatus('goals_extracted');

      // Step 4: Progress Extraction
      const { data: progressResult, error: progErr } = await invokeCloudFunction('process-iep', {
        step: 'extract_progress', document_id: docId, raw_text: cleanedText,
      }, token);
      if (progErr) throw progErr;
      await updateStatus('progress_extracted');

      // Step 5: Services
      const { data: servicesResult, error: svcErr } = await invokeCloudFunction('process-iep', {
        step: 'extract_services', document_id: docId, raw_text: cleanedText,
      }, token);
      if (svcErr) throw svcErr;
      await updateStatus('services_extracted');

      // Step 6: Accommodations
      const { data: accomResult, error: accomErr } = await invokeCloudFunction('process-iep', {
        step: 'extract_accommodations', document_id: docId, raw_text: cleanedText,
      }, token);
      if (accomErr) throw accomErr;
      await updateStatus('accommodations_extracted');

      // Step 7: Link Progress to Goals
      if (goalsResult?.result?.goals?.length && progressResult?.result?.progress_entries?.length) {
        await invokeCloudFunction('process-iep', {
          step: 'link_progress',
          document_id: docId,
          goals_json: goalsResult.result.goals,
          progress_json: progressResult.result.progress_entries,
        }, token);
      }

      // Step 8: Goal Quality Validation
      if (goalsResult?.result?.goals?.length) {
        await updateStatus('validating');
        await invokeCloudFunction('process-iep', {
          step: 'validate_goals',
          document_id: docId,
          goals_json: goalsResult.result.goals,
        }, token);
      }

      await updateStatus('ready');
      toast({ title: 'IEP processing complete', description: 'Document is ready for review.' });

      loadExtractedData(docId);
      loadDocuments();
    } catch (err: any) {
      await updateStatus('error');
      await supabase.from('iep_documents').update({ pipeline_error: err.message }).eq('id', docId);
      toast({ title: 'Processing failed', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // ─── Approve extracted item ────────────────────────────────
  const approveGoal = async (goalId: string) => {
    await supabase.from('iep_extracted_goals').update({
      is_approved: true, approved_by: user?.id, approved_at: new Date().toISOString(),
    }).eq('id', goalId);
    if (selectedDoc) loadExtractedData(selectedDoc.id);
    toast({ title: 'Goal approved' });
  };

  // ─── Send approved goal to IEP Writer ──────────────────────
  const sendGoalToWriter = async (goal: any) => {
    if (!selectedClientId || !user || !currentWorkspace) return;
    setSendingToWriter(goal.id);
    try {
      const gd = goal.goal_data || {};
      const goalText = gd.goal_statement_clean || gd.goal_statement_raw || '';
      const content = [
        `**Goal Area:** ${gd.domain || gd.area_of_need || '—'}`,
        `**Baseline:** ${gd.baseline?.value || '—'}`,
        `**Target:** ${gd.criterion?.details || (gd.criterion?.value ? `${gd.criterion.value}${gd.criterion.unit || ''}` : '—')}`,
        `**Measurement:** ${gd.measurement_method || '—'}`,
        `**Goal Statement:** ${goalText}`,
        gd.mastery_criteria ? `**Mastery Criteria:** ${gd.mastery_criteria}` : '',
        gd.short_term_objectives?.length ? `\n**Short-Term Objectives:**\n${gd.short_term_objectives.map((o: any, i: number) => `${i + 1}. ${o.objective_text_clean || o.objective_text_raw}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');

      const sections = [
        { id: crypto.randomUUID(), type: 'goals' as const, title: `Goal: ${gd.domain || 'Imported'}`, content, order: 0 },
      ];

      const { error } = await supabase.from('iep_drafts').insert({
        client_id: selectedClientId,
        created_by: user.id,
        agency_id: currentWorkspace.agency_id,
        title: `Imported Goal — ${gd.domain || gd.area_of_need || 'IEP Reader'}`,
        sections,
        status: 'draft',
        draft_type: 'imported_goal',
      });

      if (error) throw error;
      toast({ title: 'Goal sent to IEP Writer', description: 'A new draft has been created.' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSendingToWriter(null);
    }
  };

  // ─── Link goal to data collection target ───────────────────
  const linkGoalToTarget = async (goal: any, targetId: string) => {
    setLinkingGoal(goal.id);
    try {
      const gd = goal.goal_data || {};
      const updatedData = { ...gd, linked_target_id: targetId };
      await supabase.from('iep_extracted_goals').update({ goal_data: updatedData }).eq('id', goal.id);
      if (selectedDoc) loadExtractedData(selectedDoc.id);
      toast({ title: 'Goal linked to data collection target' });
    } catch (err: any) {
      toast({ title: 'Failed to link', description: err.message, variant: 'destructive' });
    } finally {
      setLinkingGoal(null);
    }
  };

  const getProgressPercent = (status: string) => {
    const step = PIPELINE_STEPS.find(s => s.key === status);
    return step?.progress || 0;
  };

  const getQualityLevel = (score: number) => {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-heading">IEP Reader</h2>
        <p className="text-sm text-muted-foreground">Upload and analyze IEP documents with AI</p>
      </div>

      {/* Student Selector */}
      <div className="max-w-sm">
        <Label className="mb-2 block text-xs text-muted-foreground">Select Student</Label>
        <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setSelectedDoc(null); }}>
          <SelectTrigger><SelectValue placeholder="Choose a student…" /></SelectTrigger>
          <SelectContent>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!selectedClientId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Select a student to view or upload IEP documents</p>
          </CardContent>
        </Card>
      )}

      {selectedClientId && !selectedDoc && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">IEP Documents</h3>
            <div>
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                id="iep-upload"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <Button asChild disabled={uploading} className="gap-1.5">
                <label htmlFor="iep-upload" className="cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading…' : 'Upload IEP'}
                </label>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Upload className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No IEP documents uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload a PDF to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <Card
                  key={doc.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleSelectDoc(doc)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <FileText className="h-8 w-8 shrink-0 text-primary/60" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={getProgressPercent(doc.pipeline_status)} className="h-1.5 flex-1 max-w-[120px]" />
                        <span className="text-xs text-muted-foreground">
                          {PIPELINE_STEPS.find(s => s.key === doc.pipeline_status)?.label || doc.pipeline_status}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                      <Badge variant={doc.pipeline_status === 'ready' ? 'default' : doc.pipeline_status === 'error' ? 'destructive' : 'outline'} className="text-[10px]">
                        {doc.pipeline_status === 'ready' ? 'Ready' : doc.pipeline_status === 'error' ? 'Error' : 'Processing'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Document Detail View ─────────────────────────────── */}
      {selectedDoc && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>← Back</Button>
            <div className="flex-1">
              <h3 className="font-semibold">{selectedDoc.file_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={getProgressPercent(selectedDoc.pipeline_status)} className="h-1.5 max-w-[200px]" />
                <span className="text-xs text-muted-foreground">
                  {PIPELINE_STEPS.find(s => s.key === selectedDoc.pipeline_status)?.label}
                </span>
                {selectedDoc.ocr_confidence != null && (
                  <Badge variant="outline" className="text-[10px] ml-2">
                    OCR: {selectedDoc.ocr_confidence}%
                  </Badge>
                )}
              </div>
            </div>
            {selectedDoc.pipeline_status === 'uploaded' && (
              <Button
                size="sm"
                onClick={() => {
                  if (selectedDoc.ocr_raw_text) runPipeline(selectedDoc.id, selectedDoc.ocr_raw_text);
                  else toast({ title: 'No text found', description: 'Re-upload the document', variant: 'destructive' });
                }}
                disabled={processing}
                className="gap-1.5"
              >
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Loader2 className="h-3.5 w-3.5" />}
                Process
              </Button>
            )}
          </div>

          {selectedDoc.pipeline_error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{selectedDoc.pipeline_error}</p>
              </CardContent>
            </Card>
          )}

          {processing && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Processing document…</p>
                  <p className="text-xs text-muted-foreground">This may take 1-2 minutes. AI is analyzing the IEP content.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for extracted data */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="gap-1 text-xs"><Eye className="h-3 w-3" />Overview</TabsTrigger>
              <TabsTrigger value="goals" className="gap-1 text-xs"><Target className="h-3 w-3" />Goals ({goals.length})</TabsTrigger>
              <TabsTrigger value="progress" className="gap-1 text-xs"><TrendingUp className="h-3 w-3" />Progress ({progressEntries.length})</TabsTrigger>
              <TabsTrigger value="services" className="gap-1 text-xs"><Briefcase className="h-3 w-3" />Services ({services.length})</TabsTrigger>
              <TabsTrigger value="accommodations" className="gap-1 text-xs"><Shield className="h-3 w-3" />Accomm. ({accommodations.length})</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Target className="mx-auto h-6 w-6 text-primary/60 mb-1" />
                    <p className="text-2xl font-bold">{goals.length}</p>
                    <p className="text-xs text-muted-foreground">Goals</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="mx-auto h-6 w-6 text-primary/60 mb-1" />
                    <p className="text-2xl font-bold">{progressEntries.length}</p>
                    <p className="text-xs text-muted-foreground">Progress</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Briefcase className="mx-auto h-6 w-6 text-primary/60 mb-1" />
                    <p className="text-2xl font-bold">{services.length}</p>
                    <p className="text-xs text-muted-foreground">Services</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Shield className="mx-auto h-6 w-6 text-primary/60 mb-1" />
                    <p className="text-2xl font-bold">{accommodations.length}</p>
                    <p className="text-xs text-muted-foreground">Accommodations</p>
                  </CardContent>
                </Card>
              </div>

              {selectedDoc.global_issues?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Issues & Warnings</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5">
                    {selectedDoc.global_issues.map((issue: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', issue.severity === 'high' ? 'text-destructive' : 'text-amber-500')} />
                        <span>{issue.note || issue.corrected || JSON.stringify(issue)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Goals Tab */}
            <TabsContent value="goals" className="space-y-3 mt-4">
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No goals extracted yet</p>
              ) : goals.map(g => {
                const gd = g.goal_data || {};
                const qualityScore = gd.quality_score;
                const qualityLevel = qualityScore != null ? getQualityLevel(qualityScore) : null;
                const complianceIssues = gd.compliance_issues || [];
                const linkedTargetId = gd.linked_target_id;
                const linkedTarget = targets.find(t => t.id === linkedTargetId);

                return (
                  <Card key={g.id} className={cn(g.is_approved && 'border-green-500/30 bg-green-500/5')}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {gd.domain && <Badge variant="outline" className="text-[10px]">{gd.domain}</Badge>}
                            {gd.goal_index_label && <span className="text-xs text-muted-foreground">{gd.goal_index_label}</span>}
                            {g.is_approved && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                            {qualityLevel && (
                              <Badge className={cn('text-[10px]', QUALITY_COLORS[qualityLevel])}>
                                <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                                Quality: {qualityScore}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{gd.goal_statement_clean || gd.goal_statement_raw || 'No statement'}</p>
                        </div>
                        {gd.confidence?.overall != null && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {Math.round(gd.confidence.overall * 100)}%
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {gd.baseline?.value && (
                          <div><span className="text-muted-foreground">Baseline:</span> {gd.baseline.value}</div>
                        )}
                        {gd.criterion?.details && (
                          <div><span className="text-muted-foreground">Criterion:</span> {gd.criterion.details || `${gd.criterion.value}${gd.criterion.unit || ''}`}</div>
                        )}
                        {gd.measurement_method && (
                          <div><span className="text-muted-foreground">Measurement:</span> {gd.measurement_method}</div>
                        )}
                        {gd.mastery_criteria && (
                          <div><span className="text-muted-foreground">Mastery:</span> {gd.mastery_criteria}</div>
                        )}
                      </div>

                      {/* Compliance issues from validator */}
                      {complianceIssues.length > 0 && (
                        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 space-y-1">
                          <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Compliance Flags
                          </p>
                          {complianceIssues.map((ci: any, i: number) => (
                            <p key={i} className="text-xs text-amber-700">• {ci.note || ci.type}</p>
                          ))}
                        </div>
                      )}

                      {gd.issues?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {gd.issues.map((issue: any, i: number) => (
                            <Badge key={i} variant="outline" className={cn('text-[10px]', issue.severity === 'high' ? 'border-destructive text-destructive' : 'border-amber-500 text-amber-600')}>
                              {issue.type}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Linked data collection target */}
                      {linkedTarget && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          Linked to: <Badge variant="secondary" className="text-[10px]">{linkedTarget.name}</Badge>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {!g.is_approved && (
                          <Button size="sm" variant="outline" onClick={() => approveGoal(g.id)} className="gap-1">
                            <ThumbsUp className="h-3 w-3" /> Approve
                          </Button>
                        )}

                        {g.is_approved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendGoalToWriter(g)}
                            disabled={sendingToWriter === g.id}
                            className="gap-1"
                          >
                            {sendingToWriter === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Send to IEP Writer
                          </Button>
                        )}

                        {/* Link to data collection target */}
                        {targets.length > 0 && (
                          <Select
                            value={linkedTargetId || ''}
                            onValueChange={(v) => linkGoalToTarget(g, v)}
                          >
                            <SelectTrigger className="h-8 w-auto text-xs gap-1 border-dashed">
                              <Link2 className="h-3 w-3" />
                              <SelectValue placeholder="Link to target…" />
                            </SelectTrigger>
                            <SelectContent>
                              {targets.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name} ({t.target_type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Progress Tab */}
            <TabsContent value="progress" className="space-y-3 mt-4">
              {progressEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No progress entries extracted yet</p>
              ) : progressEntries.map(p => {
                const pd = p.progress_data || {};
                const statusColors: Record<string, string> = {
                  met: 'bg-green-100 text-green-700', making_progress: 'bg-blue-100 text-blue-700',
                  limited_progress: 'bg-amber-100 text-amber-700', not_making_progress: 'bg-red-100 text-red-700',
                  regressed: 'bg-red-200 text-red-800', unknown: 'bg-muted text-muted-foreground',
                };
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {pd.status && <Badge className={cn('text-[10px]', statusColors[pd.status])}>{pd.status.replace(/_/g, ' ')}</Badge>}
                          {pd.reporting_period && <span className="text-xs text-muted-foreground">{pd.reporting_period}</span>}
                        </div>
                        {pd.progress_date && <span className="text-xs text-muted-foreground">{pd.progress_date}</span>}
                      </div>
                      <p className="text-sm">{pd.narrative_raw || 'No narrative'}</p>
                      {pd.goal_reference_text && (
                        <p className="text-xs text-muted-foreground italic">Goal: {pd.goal_reference_text}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-3 mt-4">
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No services extracted yet</p>
              ) : services.map(s => {
                const sd = s.service_data || {};
                return (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm">{sd.service_type || 'Unknown Service'}</p>
                        {sd.confidence != null && (
                          <Badge variant="outline" className="text-[10px]">{Math.round(sd.confidence * 100)}%</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        {sd.provider && <div><span className="text-muted-foreground">Provider:</span> {sd.provider}</div>}
                        {sd.frequency && <div><span className="text-muted-foreground">Frequency:</span> {sd.frequency}</div>}
                        {sd.duration && <div><span className="text-muted-foreground">Duration:</span> {sd.duration}</div>}
                        {sd.location && <div><span className="text-muted-foreground">Location:</span> {sd.location}</div>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Accommodations Tab */}
            <TabsContent value="accommodations" className="space-y-3 mt-4">
              {accommodations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No accommodations extracted yet</p>
              ) : accommodations.map(a => {
                const ad = a.accommodation_data || {};
                return (
                  <Card key={a.id}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{ad.environment || 'other'}</Badge>
                      <div>
                        <p className="font-medium text-sm">{ad.accommodation_type}</p>
                        <p className="text-xs text-muted-foreground">{ad.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default IEPReader;
