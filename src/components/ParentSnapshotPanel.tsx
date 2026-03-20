/**
 * ParentSnapshotPanel — Generate daily student snapshots + secure link delivery.
 * Reads/writes to Core: daily_student_snapshots, snapshot_tokens, parent_contacts.
 * Sends email via send-parent-snapshot edge function.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Camera, Send, Link2, Copy, Plus, Loader2,
  Mail, MessageSquare, CheckCircle, Clock, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Snapshot {
  id: string; student_id: string; snapshot_date: string; points_earned: number;
  highlights: string[]; teacher_note: string | null; status: string; created_at: string;
}

interface ParentContact {
  id: string; student_id: string; name: string; email: string | null;
  phone: string | null; relationship: string; preferred_channel: string;
}

interface Props { studentId: string; studentName: string; agencyId: string; balance?: number; }

export function ParentSnapshotPanel({ studentId, studentName, agencyId, balance }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [contacts, setContacts] = useState<ParentContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot | null>(null);

  const [teacherNote, setTeacherNote] = useState('');
  const [highlights, setHighlights] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [snapRes, contactRes] = await Promise.all([
        supabase.from('daily_student_snapshots' as any).select('*').eq('student_id', studentId).order('snapshot_date', { ascending: false }).limit(7),
        supabase.from('parent_contacts' as any).select('*').eq('student_id', studentId),
      ]);
      setSnapshots((snapRes.data || []) as any[]);
      setContacts((contactRes.data || []) as any[]);
    } catch { /* silent */ }
    setLoading(false);
  }, [studentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const generateSnapshot = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const highlightList = highlights.split('\n').filter(h => h.trim());
      const { data, error } = await supabase.from('daily_student_snapshots' as any).insert({
        student_id: studentId, agency_id: agencyId, snapshot_date: today,
        points_earned: balance || 0, points_spent: 0, attendance_status: 'present',
        highlights: highlightList, teacher_note: teacherNote.trim() || null,
        status: 'draft', created_by: user.id,
      }).select('id').single();
      if (error) throw error;
      toast({ title: '📸 Snapshot generated' });
      setCreateOpen(false); setTeacherNote(''); setHighlights('');
      loadData();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setGenerating(false); }
  };

  const generateSecureLink = async (snapshot: Snapshot) => {
    if (!user) return;
    try {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
      const { error } = await supabase.from('snapshot_tokens' as any).insert({
        snapshot_id: snapshot.id, token, expires_at: expiresAt.toISOString(), created_by: user.id,
      });
      if (error) throw error;
      const link = `${window.location.origin}/snapshot/${token}`;
      setGeneratedLink(link); setActiveSnapshot(snapshot); setEmailSent(false); setLinkOpen(true);
      await supabase.from('daily_student_snapshots' as any).update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', snapshot.id);
      loadData();
    } catch (err: any) { toast({ title: 'Error generating link', description: err.message, variant: 'destructive' }); }
  };

  const copyLink = () => { navigator.clipboard.writeText(generatedLink); toast({ title: 'Link copied!' }); };

  const sendEmail = async (contact: ParentContact) => {
    if (!contact.email || !activeSnapshot) return;
    setSendingEmail(true);
    try {
      const { data, error } = await cloudSupabase.functions.invoke('send-parent-snapshot', {
        body: {
          recipient_email: contact.email, recipient_name: contact.name,
          student_name: studentName, snapshot_link: generatedLink,
          snapshot_date: activeSnapshot.snapshot_date,
          points_earned: activeSnapshot.points_earned,
          highlights: activeSnapshot.highlights, teacher_note: activeSnapshot.teacher_note,
        },
      });
      if (error) throw error;
      setEmailSent(true);
      toast({ title: '📧 Email sent!', description: `Snapshot sent to ${contact.name}` });
      // Log delivery
      await supabase.from('daily_student_snapshots' as any).update({ status: 'delivered' }).eq('id', activeSnapshot.id);
    } catch (err: any) { toast({ title: 'Email failed', description: err.message, variant: 'destructive' }); }
    finally { setSendingEmail(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-heading flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" /> Parent Snapshots
        </h3>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> New Snapshot
        </Button>
      </div>

      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {contacts.map(c => (
            <Badge key={c.id} variant="outline" className="text-[10px] gap-1">
              {c.preferred_channel === 'email' ? <Mail className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
              {c.name} ({c.relationship})
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : snapshots.length === 0 ? (
        <Card className="border-dashed border-2 border-border"><CardContent className="py-6 text-center"><Camera className="mx-auto h-6 w-6 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">No snapshots yet for {studentName}</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {snapshots.map(snap => (
            <Card key={snap.id} className="border-border/40">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{formatDate(snap.snapshot_date)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">⭐ {snap.points_earned} earned</span>
                      {snap.highlights?.length > 0 && <span className="text-[10px] text-muted-foreground">✨ {snap.highlights.length} highlights</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={cn('text-[9px]',
                      snap.status === 'delivered' ? 'bg-accent/20 text-accent-foreground' :
                      snap.status === 'sent' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {snap.status === 'delivered' ? <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> : snap.status === 'sent' ? <Send className="h-2.5 w-2.5 mr-0.5" /> : <Clock className="h-2.5 w-2.5 mr-0.5" />}
                      {snap.status}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => generateSecureLink(snap)}>
                      <Link2 className="h-3 w-3" /> Share
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> New Snapshot for {studentName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Highlights (one per line)</Label><Textarea value={highlights} onChange={e => setHighlights(e.target.value)} placeholder="Great participation in math&#10;Helped a classmate" rows={3} /></div>
            <div className="space-y-1"><Label className="text-xs">Teacher Note (optional)</Label><Textarea value={teacherNote} onChange={e => setTeacherNote(e.target.value)} placeholder="Additional notes for parents…" rows={2} /></div>
            <Button onClick={generateSnapshot} disabled={generating} className="w-full gap-1.5">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Camera className="h-4 w-4" /> Generate Snapshot</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link + Send Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Share Snapshot</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Secure link expires in 7 days.</p>
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <code className="flex-1 text-xs break-all text-foreground">{generatedLink}</code>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={copyLink}><Copy className="h-3.5 w-3.5" /></Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-1.5 text-xs" onClick={copyLink}><Copy className="h-3 w-3" /> Copy Link</Button>
              <Button variant="outline" className="gap-1.5 text-xs" onClick={() => window.open(generatedLink, '_blank')}><ExternalLink className="h-3 w-3" /> Preview</Button>
            </div>

            {contacts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold">Send to parents:</p>
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
                    <div className="flex items-center gap-2 text-xs min-w-0">
                      {c.email ? <Mail className="h-3 w-3 text-primary shrink-0" /> : <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.email || c.phone || 'No contact info'}</p>
                      </div>
                    </div>
                    {c.email && (
                      <Button size="sm" variant={emailSent ? "outline" : "default"} className="h-7 text-xs gap-1 shrink-0"
                        disabled={sendingEmail} onClick={() => sendEmail(c)}>
                        {sendingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : emailSent ? <><CheckCircle className="h-3 w-3" /> Sent</> : <><Mail className="h-3 w-3" /> Email</>}
                      </Button>
                    )}
                    {c.phone && !c.email && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                        onClick={() => { window.open(`sms:${c.phone}?body=Check out ${studentName}'s daily snapshot: ${generatedLink}`, '_blank'); toast({ title: 'SMS app opened' }); }}>
                        <MessageSquare className="h-3 w-3" /> Text
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {contacts.length === 0 && (
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground">No parent contacts on file. Use "Copy Link" to share manually.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
