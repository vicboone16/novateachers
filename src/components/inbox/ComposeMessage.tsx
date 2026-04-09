import { useState, useEffect } from 'react';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { getAuthToken } from '@/lib/auth-token';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { sendMessageViaBridge } from '@/lib/core-bridge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2 } from 'lucide-react';
import { AttachmentUploader, uploadAttachments } from './InboxAttachments';

interface Recipient {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

const MESSAGE_TYPES = [
  { value: 'note', label: 'General Note' },
  { value: 'bip', label: 'Behavior Intervention Plan' },
  { value: 'fba', label: 'Functional Behavior Assessment' },
  { value: 'action_item', label: 'Action Item / Task' },
  { value: 'document', label: 'Document' },
];

const isIdLikeName = (value: string | undefined, id: string) => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return true;
  const compact = trimmed.replace(/[\s\-…]/g, '');
  return trimmed === id || trimmed === id.slice(0, 8) || /^[0-9a-f]{6,}$/i.test(compact);
};

const formatRoleLabel = (role?: string | null) => {
  if (!role) return null;
  return role
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const ComposeMessage = ({ open, onOpenChange, onSent }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [messageType, setMessageType] = useState('note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !currentWorkspace) return;
    loadRecipients();
  }, [open, currentWorkspace]);

  const loadRecipients = async () => {
    if (!currentWorkspace || !user) return;
    setLoadingRecipients(true);
    try {
      const authToken = await getAuthToken();
      const [{ data: agencyAccess }, { data: memberships }] = await Promise.all([
        supabase
          .from('user_agency_access')
          .select('user_id')
          .eq('agency_id', currentWorkspace.agency_id),
        supabase
          .from('agency_memberships')
          .select('user_id, role')
          .eq('agency_id', currentWorkspace.agency_id),
      ]);

      const roleByUserId = new Map(
        (memberships || []).map((row: any) => [row.user_id as string, row.role as string | null])
      );

      const userIds = Array.from(
        new Set(
          [
            ...(agencyAccess || []).map((row: any) => row.user_id),
            ...(memberships || []).map((row: any) => row.user_id),
          ].filter(Boolean)
        )
      ).filter(id => id !== user.id);

      if (userIds.length === 0) {
        setRecipients([]);
        return;
      }

      const resolved = authToken ? await resolveDisplayNames(userIds, authToken) : new Map<string, string>();
      const mapped = userIds
        .map((id, index) => {
          const resolvedName = resolved.get(id);
          const fallbackRole = formatRoleLabel(roleByUserId.get(id));
          return {
            id,
            name: isIdLikeName(resolvedName, id)
              ? fallbackRole || `Team Member ${index + 1}`
              : resolvedName!.trim(),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setRecipients(mapped);
    } catch {
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const resetForm = () => {
    setRecipientId('');
    setMessageType('note');
    setSubject('');
    setBody('');
    setFiles([]);
  };

  const handleSend = async () => {
    if (!recipientId || !body.trim() || !user || !currentWorkspace) return;
    setSending(true);
    try {
      const { data: inserted, error } = await sendMessageViaBridge({
        agencyId: currentWorkspace.agency_id,
        senderId: user.id,
        recipientId,
        messageType: messageType,
        subject: subject.trim() || null,
        body: body.trim(),
        metadata: { app_source: 'teacher_hub' },
      });

      if (error) throw error;

      if (files.length > 0 && inserted?.id) {
        const ok = await uploadAttachments(inserted.id, user.id, files);
        if (!ok) {
          toast({ title: 'Message sent but some attachments failed', variant: 'destructive' });
        }
      }

      toast({ title: 'Message sent' });
      resetForm();
      onOpenChange(false);
      onSent();
    } catch (err: any) {
      toast({ title: 'Error sending message', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Compose Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingRecipients ? 'Loading team…' : 'Select recipient'} />
              </SelectTrigger>
              <SelectContent>
                {recipients.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
                {recipients.length === 0 && !loadingRecipients && (
                  <SelectItem value="__none" disabled>
                    No recipients available in this workspace
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject (optional)"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={5}
            />
          </div>

          <AttachmentUploader files={files} onFilesChange={setFiles} />

          <div className="flex justify-end">
            <Button onClick={handleSend} disabled={sending || !recipientId || !body.trim()} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Sending…' : 'Send Message'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeMessage;
