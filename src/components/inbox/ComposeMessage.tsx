import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
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
  { value: 'action_item', label: 'Action Item / Task' },
  { value: 'document', label: 'Document' },
];

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

  // Load team members as potential recipients
  useEffect(() => {
    if (!open || !currentWorkspace) return;
    loadRecipients();
  }, [open, currentWorkspace]);

  const loadRecipients = async () => {
    if (!currentWorkspace) return;
    setLoadingRecipients(true);
    try {
      // Fetch agency members from Core profiles
      const { data } = await supabase
        .from('user_agency_access')
        .select('user_id')
        .eq('agency_id', currentWorkspace.agency_id);

      if (data && data.length > 0) {
        const userIds = data.map((d: any) => d.user_id).filter((id: string) => id !== user?.id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, display_name, email')
            .in('id', userIds);

          if (profiles) {
            setRecipients(
              (profiles as any[]).map(p => ({
                id: p.id,
                name: p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id.slice(0, 8),
              }))
            );
          }
        }
      }
    } catch {
      // Fallback: empty recipients
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
      const { data: inserted, error } = await supabase
        .from('teacher_messages')
        .insert({
          agency_id: currentWorkspace.agency_id,
          sender_id: user.id,
          recipient_id: recipientId,
          message_type: messageType,
          subject: subject.trim() || null,
          body: body.trim(),
        })
        .select('id')
        .single();

      if (error) throw error;

      if (files.length > 0 && inserted) {
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
          {/* Recipient */}
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
                    No team members found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
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

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject (optional)"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={5}
            />
          </div>

          {/* Attachments */}
          <AttachmentUploader files={files} onFilesChange={setFiles} />

          {/* Send */}
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
