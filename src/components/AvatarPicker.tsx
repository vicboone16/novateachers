/**
 * AvatarPicker — Grid of emoji avatars for students.
 * Saves selection to student_game_profiles.avatar_emoji.
 */
import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const AVATAR_EMOJIS = [
  '🦊', '🐻', '🐼', '🐨', '🦁', '🐯', '🐸', '🐙',
  '🦄', '🐲', '🦋', '🐬', '🦅', '🐢', '🦩', '🐝',
  '🌟', '⚡', '🔥', '🌈', '🎯', '🚀', '💎', '🏆',
  '🎨', '🎵', '📚', '🧩', '🎮', '⚽', '🏀', '🎪',
  '👤', '😊', '😎', '🤩', '🥳', '💪', '🧠', '❤️',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  agencyId: string;
  currentEmoji: string;
  onSelect?: (emoji: string) => void;
}

export function AvatarPicker({ open, onOpenChange, studentId, agencyId, currentEmoji, onSelect }: Props) {
  const [selected, setSelected] = useState(currentEmoji || '👤');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await cloudSupabase
        .from('student_game_profiles')
        .upsert({
          student_id: studentId,
          agency_id: agencyId,
          avatar_emoji: selected,
        } as any, { onConflict: 'student_id' });
      
      if (error) throw error;
      onSelect?.(selected);
      toast({ title: `${selected} Avatar updated!` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Failed to save avatar', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Choose Avatar</DialogTitle>
        </DialogHeader>
        <div className="text-center mb-3">
          <span className="text-5xl">{selected}</span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATAR_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => setSelected(emoji)}
              className={cn(
                'text-2xl h-10 w-10 rounded-xl flex items-center justify-center transition-all active:scale-90',
                selected === emoji
                  ? 'bg-primary/20 ring-2 ring-primary scale-110'
                  : 'hover:bg-secondary'
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
          {saving ? 'Saving…' : 'Save Avatar'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
