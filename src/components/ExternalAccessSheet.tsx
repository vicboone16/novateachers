/**
 * ExternalAccessSheet — Teacher-facing sheet to generate, manage, and share
 * external parent & student access links.
 * Uses current parent_access_links + student_portal_tokens contracts.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
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
import { displayName as getStudentDisplayName } from '@/lib/student-utils';

interface ExternalLink {
  id: string;
  student_id: string;
  link_type: 'parent' | 'student';
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  created_by: string | null;
  account_id?: string | null;
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

const NON_EXPIRING_TOKEN_DATE = '2099-12-31T23:59:59.999Z';

function getExpirationDate(value: string): string | null {
  if (value === 'none') return null;
  const now = new Date();
  if (value === '24h') now.setHours(now.getHours() + 24);
  else if (value === '7d') now.setDate(now.getDate() + 7);
  else if (value === '30d') now.setDate(now.getDate() + 30);
  return now.toISOString();
}

function getStudentTokenExpirationDate(value: string): string {
  return getExpirationDate(value) ?? NON_EXPIRING_TOKEN_DATE;
}

function isNonExpiringStudentToken(iso: string | null) {
  return Boolean(iso && new Date(iso).getFullYear() >= 2099);
}

function generateAccessToken() {
  return crypto.randomUUID().replace(/-/g, '');
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
      const [parentRes, accountRes] = await Promise.all([
        cloudSupabase
          .from('parent_access_links')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_portal_accounts' as any)
          .select('id')
          .eq('student_id', studentId)
          .maybeSingle(),
      ]);

      const parentLinks: ExternalLink[] = ((parentRes.data || []) as any[]).map(link => ({
        ...link,
        link_type: 'parent',
      }));

      let studentLinks: ExternalLink[] = [];
      const accountId = (accountRes.data as any)?.id;
      if (accountId) {
        const { data: tokenData } = await supabase
          .from('student_portal_tokens' as any)
          .select('id, account_id, token, is_active, expires_at, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false });

        studentLinks = ((tokenData || []) as any[]).map(link => ({
          id: link.id,
          student_id: studentId,
          link_type: 'student',
          token: link.token,
          is_active: Boolean(link.is_active),
          expires_at: isNonExpiringStudentToken(link.expires_at) ? null : link.expires_at,
          created_at: link.created_at,
          last_used_at: null,
          created_by: user?.id || null,
          account_id: link.account_id,
        }));
      }

      setLinks(
        [...parentLinks, ...studentLinks].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } catch (err: any) {
      console.warn('[ExternalAccess] Failed to load links:', err.message);
      setLinks([]);
    }
    setLoading(false);
  }, [studentId, user?.id]);

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
      if (linkType === 'parent') {
        if (deactivateExisting) {
          const { error: deactivateError } = await cloudSupabase
            .from('parent_access_links')
            .update({ is_active: false })
            .eq('student_id', studentId)
            .eq('is_active', true);
          if (deactivateError) throw deactivateError;
        }

        const { error } = await cloudSupabase
          .from('parent_access_links')
          .insert({
            student_id: studentId,
            agency_id: agencyId,
            created_by: user.id,
            token: generateAccessToken(),
            expires_at: getExpirationDate(expiry),
            is_active: true,
          });
        if (error) throw error;
      } else {
        const safeStudentName = getStudentDisplayName({
          id: studentId,
          client_id: studentId,
          name: studentName,
        });

        const { data: existingAccount, error: accountLookupError } = await supabase
          .from('student_portal_accounts' as any)
          .select('id')
          .eq('student_id', studentId)
          .maybeSingle();
        if (accountLookupError) throw accountLookupError;

        let accountId = (existingAccount as any)?.id as string | undefined;

        if (accountId) {
          const { error: accountUpdateError } = await supabase
            .from('student_portal_accounts' as any)
            .update({
              agency_id: agencyId,
              display_name: safeStudentName,
              is_active: true,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', accountId);
          if (accountUpdateError) throw accountUpdateError;
        } else {
          const { data: createdAccount, error: accountCreateError } = await supabase
            .from('student_portal_accounts' as any)
            .insert({
              student_id: studentId,
              agency_id: agencyId,
              display_name: safeStudentName,
              created_by: user.id,
              is_active: true,
            } as any)
            .select('id')
            .single();
          if (accountCreateError) throw accountCreateError;
          accountId = (createdAccount as any)?.id;
        }

        if (!accountId) throw new Error('Could not prepare student portal account.');

        if (deactivateExisting) {
          const { error: deactivateError } = await supabase
            .from('student_portal_tokens' as any)
            .update({ is_active: false } as any)
            .eq('account_id', accountId)
            .eq('is_active', true);
          if (deactivateError) throw deactivateError;
        }

        const { error } = await supabase
          .from('student_portal_tokens' as any)
          .insert({
            account_id: accountId,
            token: generateAccessToken(),
            expires_at: getStudentTokenExpirationDate(expiry),
            is_active: true,
          } as any);
        if (error) throw error;
      }

      toast({ title: `${linkType === 'parent' ? 'Parent' : 'Student'} link created!` });
      await loadLinks();
    } catch (err: any) {
      toast({ title: 'Failed to create link', description: err.message, variant: 'destructive' });
    }
    setGenerating(null);
  };

   const deactivateLink = async (link: ExternalLink) => {
    try {
      const error = link.link_type === 'parent'
        ? (await cloudSupabase
            .from('parent_access_links')
            .update({ is_active: false })
            .eq('id', link.id)).error
        : (await supabase
            .from('student_portal_tokens' as any)
            .update({ is_active: false } as any)
            .eq('id', link.id)).error;
      if (error) throw error;
      toast({ title: 'Link deactivated' });
      await loadLinks();
    } catch (err: any) {
      toast({ title: 'Failed to deactivate', description: err.message, variant: 'destructive' });
    }
  };

  const buildUrl = (link: ExternalLink) => {
    const base = window.location.origin;
    return link.link_type === 'parent'
      ? `${base}/external/parent/${link.token}`
      : `${base}/portal/${link.token}`;
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
              onDeactivate={() => activeParentLink && deactivateLink(activeParentLink)}
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
              onDeactivate={() => activeStudentLink && deactivateLink(activeStudentLink)}
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
