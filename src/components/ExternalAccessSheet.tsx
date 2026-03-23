/**
 * ExternalAccessSheet — Teacher-facing sheet to generate, manage, and share
 * external parent & student access links.
 * Calls Nova Core RPCs: create_external_access_link, get_student_external_links, deactivate_external_access_link.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Link2, Copy, ExternalLink, RefreshCw, XCircle,
  ChevronDown, Clock, Loader2, Check, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExternalLink {
  id: string;
  student_id: string;
  link_type: string; // 'parent' | 'student'
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  created_by: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  agencyId: string;
}

const EXPIRATION_OPTIONS = [
  { label: 'No expiration', value: 'none' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

function getExpirationDate(value: string): string | null {
  if (value === 'none') return null;
  const now = new Date();
  if (value === '24h') now.setHours(now.getHours() + 24);
  else if (value === '7d') now.setDate(now.getDate() + 7);
  else if (value === '30d') now.setDate(now.getDate() + 30);
  return now.toISOString();
}

export function ExternalAccessSheet({ open, onOpenChange, studentId, studentName, agencyId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [parentExpiry, setParentExpiry] = useState('none');
  const [studentExpiry, setStudentExpiry] = useState('none');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_student_external_links' as any, {
        p_student_id: studentId,
      });
      if (error) throw error;
      setLinks((data || []) as ExternalLink[]);
    } catch (err: any) {
      console.warn('[ExternalAccess] Failed to load links:', err.message);
      // Fallback: try direct table query
      try {
        const { data } = await supabase
          .from('external_access_links' as any)
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });
        setLinks((data || []) as ExternalLink[]);
      } catch {
        setLinks([]);
      }
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    if (open) loadLinks();
  }, [open, loadLinks]);

  const activeParentLink = links.find(l => l.link_type === 'parent' && l.is_active);
  const activeStudentLink = links.find(l => l.link_type === 'student' && l.is_active);
  const inactiveLinks = links.filter(l => !l.is_active);

  const generateLink = async (linkType: 'parent' | 'student', deactivateExisting = false) => {
    if (!user) return;
    setGenerating(linkType);
    try {
      const expiry = linkType === 'parent' ? parentExpiry : studentExpiry;
      const { data, error } = await supabase.rpc('create_external_access_link' as any, {
        p_student_id: studentId,
        p_link_type: linkType,
        p_created_by: user.id,
        p_agency_id: agencyId,
        p_expires_at: getExpirationDate(expiry),
        p_deactivate_existing: deactivateExisting,
      });
      if (error) throw error;
      toast({ title: `${linkType === 'parent' ? 'Parent' : 'Student'} link created!` });
      loadLinks();
    } catch (err: any) {
      toast({ title: 'Failed to create link', description: err.message, variant: 'destructive' });
    }
    setGenerating(null);
  };

  const deactivateLink = async (linkId: string) => {
    try {
      const { error } = await supabase.rpc('deactivate_external_access_link' as any, {
        p_link_id: linkId,
      });
      if (error) throw error;
      toast({ title: 'Link deactivated' });
      loadLinks();
    } catch (err: any) {
      toast({ title: 'Failed to deactivate', description: err.message, variant: 'destructive' });
    }
  };

  const buildUrl = (link: ExternalLink) => {
    const base = window.location.origin;
    const path = link.link_type === 'parent' ? 'external/parent' : 'external/student';
    return `${base}/${path}/${link.token}`;
  };

  const copyLink = async (link: ExternalLink) => {
    const url = buildUrl(link);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: 'Link copied!' });
    } catch {
      toast({ title: 'Copy failed — try manually', description: url });
    }
  };

  const previewLink = (link: ExternalLink) => {
    window.open(buildUrl(link), '_blank');
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isExpired = (link: ExternalLink) => {
    if (!link.expires_at) return false;
    return new Date(link.expires_at) < new Date();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-safe">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-base font-heading flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            External Access
          </SheetTitle>
          <SheetDescription className="text-xs">
            Create parent and student links for {studentName}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* ── PARENT LINK SECTION ── */}
            <LinkSection
              title="Parent Link"
              description="Safe view with points, feed, and progress"
              linkType="parent"
              activeLink={activeParentLink}
              expiry={parentExpiry}
              onExpiryChange={setParentExpiry}
              generating={generating === 'parent'}
              copiedId={copiedId}
              onGenerate={() => generateLink('parent')}
              onRegenerate={() => generateLink('parent', true)}
              onDeactivate={() => activeParentLink && deactivateLink(activeParentLink.id)}
              onCopy={() => activeParentLink && copyLink(activeParentLink)}
              onPreview={() => activeParentLink && previewLink(activeParentLink)}
              buildUrl={buildUrl}
              formatDate={formatDate}
              isExpired={isExpired}
            />

            {/* ── STUDENT LINK SECTION ── */}
            <LinkSection
              title="Student Link"
              description="Game board, points, and rewards preview"
              linkType="student"
              activeLink={activeStudentLink}
              expiry={studentExpiry}
              onExpiryChange={setStudentExpiry}
              generating={generating === 'student'}
              copiedId={copiedId}
              onGenerate={() => generateLink('student')}
              onRegenerate={() => generateLink('student', true)}
              onDeactivate={() => activeStudentLink && deactivateLink(activeStudentLink.id)}
              onCopy={() => activeStudentLink && copyLink(activeStudentLink)}
              onPreview={() => activeStudentLink && previewLink(activeStudentLink)}
              buildUrl={buildUrl}
              formatDate={formatDate}
              isExpired={isExpired}
            />

            {/* ── LINK HISTORY ── */}
            {inactiveLinks.length > 0 && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium">Link History ({inactiveLinks.length})</span>
                  <ChevronDown className={cn('h-3 w-3 ml-auto transition-transform', historyOpen && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1.5 pt-1">
                  {inactiveLinks.map(link => (
                    <div key={link.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[9px] px-1.5">
                            {link.link_type === 'parent' ? '👨‍👩‍👧' : '🎮'} {link.link_type}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] px-1.5 text-muted-foreground">
                            inactive
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Created {formatDate(link.created_at)}
                          {link.expires_at && ` · Expired ${formatDate(link.expires_at)}`}
                          {link.last_used_at && ` · Last used ${formatDate(link.last_used_at)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Link Section subcomponent ── */
function LinkSection({
  title, description, linkType, activeLink, expiry, onExpiryChange,
  generating, copiedId, onGenerate, onRegenerate, onDeactivate,
  onCopy, onPreview, buildUrl, formatDate, isExpired,
}: {
  title: string;
  description: string;
  linkType: 'parent' | 'student';
  activeLink: ExternalLink | undefined;
  expiry: string;
  onExpiryChange: (v: string) => void;
  generating: boolean;
  copiedId: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onDeactivate: () => void;
  onCopy: () => void;
  onPreview: () => void;
  buildUrl: (link: ExternalLink) => string;
  formatDate: (iso: string | null) => string;
  isExpired: (link: ExternalLink) => boolean;
}) {
  const emoji = linkType === 'parent' ? '👨‍👩‍👧' : '🎮';
  const hasActive = !!activeLink;
  const expired = activeLink ? isExpired(activeLink) : false;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{emoji}</span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>

      {hasActive && !expired ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="gap-1 bg-accent/20 text-accent-foreground border-accent/30 text-[10px]">
              <Shield className="h-2.5 w-2.5" /> Active
            </Badge>
            {activeLink.expires_at && (
              <span className="text-[10px] text-muted-foreground">
                Expires {formatDate(activeLink.expires_at)}
              </span>
            )}
            {activeLink.last_used_at && (
              <span className="text-[10px] text-muted-foreground">
                · Last used {formatDate(activeLink.last_used_at)}
              </span>
            )}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={onCopy}>
              {copiedId === activeLink.id ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
              {copiedId === activeLink.id ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={onPreview}>
              <ExternalLink className="h-3 w-3" /> Preview
            </Button>
            <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 text-destructive hover:text-destructive" onClick={onDeactivate}>
              <XCircle className="h-3 w-3" /> Deactivate
            </Button>
            <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={onRegenerate} disabled={generating}>
              <RefreshCw className={cn('h-3 w-3', generating && 'animate-spin')} /> Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {expired && (
            <p className="text-[10px] text-destructive font-medium">Previous link expired. Generate a new one.</p>
          )}
          <div className="flex items-center gap-2">
            <Select value={expiry} onValueChange={onExpiryChange}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1 text-xs h-7" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              Generate {title}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
