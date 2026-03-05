import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { resolveDisplayNames } from '@/lib/resolve-names';
import {
  FileText,
  Brain,
  Send,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Share2,
  ClipboardCopy,
  BookOpen,
} from 'lucide-react';
import type { Client } from '@/lib/types';

interface Props {
  client: Client;
}

interface DocumentDraft {
  id: string;
  type: 'fba' | 'bip';
  content: string;
  status: 'draft' | 'review' | 'approved' | 'applied';
  created_at: string;
  shared_with?: string;
  data_summary?: Record<string, any>;
}

const FBABIPPanel = ({ client }: Props) => {
  const { user, session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('generate');
  const [generating, setGenerating] = useState(false);
  const [generatingBIP, setGeneratingBIP] = useState(false);
  const [fbaContent, setFbaContent] = useState('');
  const [bipContent, setBipContent] = useState('');
  const [fbaSummary, setFbaSummary] = useState<Record<string, any> | null>(null);

  // Share dialog
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDocType, setShareDocType] = useState<'fba' | 'bip'>('fba');
  const [shareRecipientId, setShareRecipientId] = useState('');
  const [shareRecipients, setShareRecipients] = useState<{ id: string; name: string }[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Saved drafts
  const [savedDrafts, setSavedDrafts] = useState<DocumentDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const clientName = `${client.first_name} ${client.last_name}`.trim();

  const handleGenerateFBA = async () => {
    if (!currentWorkspace) return;
    setGenerating(true);
    try {
      const { data, error } = await invokeCloudFunction('generate-fba', {
        client_id: client.id,
        client_name: clientName,
        agency_id: currentWorkspace.agency_id,
      }, session?.access_token);

      if (error) throw error;
      setFbaContent(data.fba_content);
      setFbaSummary(data.data_summary);
      setActiveTab('fba');
      toast({ title: 'FBA generated', description: `Analyzed ${data.data_summary?.abc_log_count || 0} ABC logs` });
    } catch (err: any) {
      toast({ title: 'Error generating FBA', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBIP = async () => {
    if (!currentWorkspace) return;
    setGeneratingBIP(true);
    try {
      const { data, error } = await invokeCloudFunction('generate-bip', {
        client_id: client.id,
        client_name: clientName,
        agency_id: currentWorkspace.agency_id,
        fba_content: fbaContent || undefined,
      }, session?.access_token);

      if (error) throw error;
      setBipContent(data.bip_content);
      setActiveTab('bip');
      toast({ title: 'BIP generated' });
    } catch (err: any) {
      toast({ title: 'Error generating BIP', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingBIP(false);
    }
  };

  const handleSaveDraft = async (type: 'fba' | 'bip') => {
    if (!user || !currentWorkspace) return;
    const content = type === 'fba' ? fbaContent : bipContent;
    if (!content) return;

    try {
      const { error } = await supabase.from('iep_drafts').insert({
        client_id: client.id,
        created_by: user.id,
        title: `${type.toUpperCase()} Draft – ${clientName}`,
        sections: [],
        status: 'draft',
        draft_type: type,
        content,
        content_json: type === 'fba' ? { data_summary: fbaSummary } : {},
        agency_id: currentWorkspace.agency_id,
      });
      if (error) throw error;
      toast({ title: `${type.toUpperCase()} saved as draft` });
      loadSavedDrafts();
    } catch (err: any) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    }
  };

  const loadSavedDrafts = async () => {
    if (!client.id) return;
    setLoadingDrafts(true);
    const { data } = await supabase
      .from('iep_drafts')
      .select('*')
      .eq('client_id', client.id)
      .in('draft_type', ['fba', 'bip'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setSavedDrafts(data.map((d: any) => ({
        id: d.id,
        type: d.draft_type as 'fba' | 'bip',
        content: d.content || '',
        status: d.status,
        created_at: d.created_at,
        data_summary: d.content_json,
      })));
    }
    setLoadingDrafts(false);
  };

  const openShareDialog = async (type: 'fba' | 'bip') => {
    setShareDocType(type);
    setShareOpen(true);
    setShareLoading(true);
    try {
      if (!currentWorkspace) return;
      const { data } = await supabase
        .from('user_agency_access')
        .select('user_id')
        .eq('agency_id', currentWorkspace.agency_id);

      if (data) {
        const ids = data.map((d: any) => d.user_id).filter((id: string) => id !== user?.id);
        const names = await resolveDisplayNames(ids, session?.access_token);
        setShareRecipients(ids.map(id => ({ id, name: names.get(id) || id.slice(0, 8) })));
      }
    } catch { /* empty */ } finally {
      setShareLoading(false);
    }
  };

  const handleShare = async () => {
    if (!shareRecipientId || !user || !currentWorkspace) return;
    setSharing(true);
    const content = shareDocType === 'fba' ? fbaContent : bipContent;
    try {
      const { error } = await supabase.from('teacher_messages').insert({
        agency_id: currentWorkspace.agency_id,
        sender_id: user.id,
        recipient_id: shareRecipientId,
        message_type: 'document',
        subject: `${shareDocType.toUpperCase()} Draft – ${clientName}`,
        body: content,
        client_id: client.id,
        metadata: { document_type: shareDocType, auto_generated: true },
      });
      if (error) throw error;
      toast({ title: `${shareDocType.toUpperCase()} sent to supervisor` });
      setShareOpen(false);
      setShareRecipientId('');
    } catch (err: any) {
      toast({ title: 'Error sharing', description: err.message, variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const handleLoadDraft = (draft: DocumentDraft) => {
    if (draft.type === 'fba') {
      setFbaContent(draft.content);
      setActiveTab('fba');
    } else {
      setBipContent(draft.content);
      setActiveTab('bip');
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="generate" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Brain className="h-3.5 w-3.5" /> Generate
          </TabsTrigger>
          {fbaContent && (
            <TabsTrigger value="fba" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" /> FBA
            </TabsTrigger>
          )}
          {bipContent && (
            <TabsTrigger value="bip" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <BookOpen className="h-3.5 w-3.5" /> BIP
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm" onClick={loadSavedDrafts}>
            <RefreshCw className="h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* Generate tab */}
        <TabsContent value="generate" className="space-y-4 animate-in fade-in-50">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Functional Behavior Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Analyzes ABC logs, frequency/duration data, and behavior categories to identify patterns and hypothesize behavior functions.
                </p>
                <Button onClick={handleGenerateFBA} disabled={generating} className="w-full gap-1.5">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {generating ? 'Analyzing data…' : 'Generate FBA Draft'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" />
                  Behavior Intervention Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Creates a BIP with replacement behaviors, antecedent strategies, and consequence procedures.
                  {!fbaContent && ' Generate an FBA first for best results.'}
                </p>
                <Button onClick={handleGenerateBIP} disabled={generatingBIP} variant={fbaContent ? 'default' : 'outline'} className="w-full gap-1.5">
                  {generatingBIP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {generatingBIP ? 'Generating BIP…' : 'Generate BIP Draft'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {fbaSummary && (
            <Card className="border-border/40 shadow-sm bg-primary/5">
              <CardContent className="p-3">
                <p className="text-xs font-medium text-primary mb-1">Data analyzed for last FBA:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">{fbaSummary.abc_log_count} ABC logs</Badge>
                  <Badge variant="outline" className="text-[10px]">{fbaSummary.frequency_entry_count} frequency entries</Badge>
                  <Badge variant="outline" className="text-[10px]">{fbaSummary.duration_entry_count} duration entries</Badge>
                  <Badge variant="outline" className="text-[10px]">{fbaSummary.note_count} notes</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* FBA viewer */}
        <TabsContent value="fba" className="space-y-3 animate-in fade-in-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold font-heading">FBA Draft</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleCopy(fbaContent)} className="gap-1.5">
                <ClipboardCopy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleSaveDraft('fba')} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" onClick={() => openShareDialog('fba')} className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> Send to Supervisor
              </Button>
            </div>
          </div>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
                {fbaContent}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BIP viewer */}
        <TabsContent value="bip" className="space-y-3 animate-in fade-in-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold font-heading">BIP Draft</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleCopy(bipContent)} className="gap-1.5">
                <ClipboardCopy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleSaveDraft('bip')} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" onClick={() => openShareDialog('bip')} className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" /> Send to Supervisor
              </Button>
            </div>
          </div>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
                {bipContent}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-3 animate-in fade-in-50">
          {loadingDrafts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : savedDrafts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No saved FBA/BIP drafts yet. Generate one above.
            </div>
          ) : (
            <div className="space-y-2">
              {savedDrafts.map(draft => (
                <Card key={draft.id} className="cursor-pointer hover:bg-accent/50 transition-colors border-border/40" onClick={() => handleLoadDraft(draft)}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${draft.type === 'fba' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                      {draft.type === 'fba' ? <FileText className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{draft.type.toUpperCase()} Draft</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(draft.created_at).toLocaleDateString()} · {draft.status}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{draft.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Send {shareDocType.toUpperCase()} to Supervisor</DialogTitle>
            <DialogDescription>
              Share this document via the messaging system for review and approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Recipient</Label>
              <Select value={shareRecipientId} onValueChange={setShareRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder={shareLoading ? 'Loading…' : 'Select supervisor'} />
                </SelectTrigger>
                <SelectContent>
                  {shareRecipients.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleShare} disabled={sharing || !shareRecipientId} className="gap-1.5">
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sharing ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FBABIPPanel;
