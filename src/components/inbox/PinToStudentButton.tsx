import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Pin, Loader2, Check } from 'lucide-react';

interface Props {
  messageBody: string;
  documentType: 'fba' | 'bip';
  clientId?: string | null;
  subject?: string | null;
}

const PinToStudentButton = ({ messageBody, documentType, clientId, subject }: Props) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState(clientId || '');
  const [saving, setSaving] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!open || !currentWorkspace) return;
    loadStudents();
  }, [open, currentWorkspace]);

  const loadStudents = async () => {
    if (!currentWorkspace) return;
    let result = await supabase.from('clients').select('id, first_name, last_name, name').eq('agency_id', currentWorkspace.agency_id);
    if (result.error) {
      result = await supabase.from('students').select('id, first_name, last_name, name').eq('agency_id', currentWorkspace.agency_id);
    }
    if (result.data) {
      setStudents(result.data.map((s: any) => ({
        id: s.id,
        name: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.name || s.id.slice(0, 8),
      })));
    }
  };

  const handlePin = async () => {
    if (!selectedStudent || !user || !currentWorkspace) return;
    setSaving(true);
    try {
      // Update the student's documents array with this FBA/BIP
      const docEntry = {
        id: crypto.randomUUID(),
        type: documentType,
        title: subject || `${documentType.toUpperCase()} Document`,
        content: messageBody,
        pinned_at: new Date().toISOString(),
        pinned_by: user.id,
      };

      // First get current documents
      let result = await supabase.from('clients').select('documents').eq('id', selectedStudent).single();
      if (result.error) {
        result = await supabase.from('students').select('documents').eq('id', selectedStudent).single();
      }

      const currentDocs = (result.data?.documents as any[]) || [];
      const updatedDocs = [...currentDocs, docEntry];

      let updateResult = await supabase.from('clients').update({ documents: updatedDocs }).eq('id', selectedStudent);
      if (updateResult.error) {
        updateResult = await supabase.from('students').update({ documents: updatedDocs }).eq('id', selectedStudent);
      }

      if (updateResult.error) throw updateResult.error;
      setPinned(true);
      toast({ title: `${documentType.toUpperCase()} pinned to student profile` });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Error pinning document', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (pinned) {
    return (
      <Button size="sm" variant="ghost" disabled className="gap-1 text-xs text-primary">
        <Check className="h-3 w-3" /> Pinned
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1 text-xs">
        <Pin className="h-3 w-3" /> Pin to Profile
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Pin {documentType.toUpperCase()} to Student</DialogTitle>
          </DialogHeader>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger>
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              {students.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handlePin} disabled={saving || !selectedStudent} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className="h-4 w-4" />}
              {saving ? 'Pinning…' : 'Pin Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PinToStudentButton;
