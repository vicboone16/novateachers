/**
 * StudentNameEditor — Inline editable display name for a student.
 * Saves to student_game_profiles.display_name_override in Cloud.
 */
import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { displayName } from '@/lib/student-utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Props {
  studentId: string;
  currentName: string;
  firstName?: string;
  lastName?: string;
  displayNameOverride?: string | null;
  onSaved?: (newName: string) => void;
  className?: string;
}

export function StudentNameEditor({ studentId, currentName, firstName, lastName, displayNameOverride, onSaved, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  const startEdit = () => {
    setDraft(displayNameOverride || currentName || `${firstName || ''} ${lastName || ''}`.trim());
    setEditing(true);
  };

  const cancel = () => { setEditing(false); setDraft(''); };

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { cancel(); return; }
    setSaving(true);
    try {
      const { data: updatedRow, error: updateError } = await cloudSupabase
        .from('student_game_profiles')
        .update({ display_name_override: trimmed } as any)
        .eq('student_id', studentId)
        .select('student_id')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedRow) {
        const agencyId = currentWorkspace?.agency_id;
        if (!agencyId) throw new Error('No active workspace found for this student');

        const { error: upsertError } = await cloudSupabase
          .from('student_game_profiles')
          .upsert({
            student_id: studentId,
            agency_id: agencyId,
            display_name_override: trimmed,
          } as any, { onConflict: 'student_id' });

        if (upsertError) throw upsertError;
      }

      toast({ title: 'Name updated' });
      onSaved?.(trimmed);
      setEditing(false);
    } catch (err: any) {
      toast({ title: 'Failed to save name', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={`flex items-center gap-1 ${className || ''}`}>
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="h-7 text-sm w-32"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        />
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={save} disabled={saving}>
          <Check className="h-3.5 w-3.5 text-accent" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancel} disabled={saving}>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 group cursor-pointer ${className || ''}`} onClick={startEdit}>
      <span>{currentName}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
}
