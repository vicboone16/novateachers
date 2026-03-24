/**
 * StudentPresenceSheet — Quick status/move sheet opened from student cards.
 * Writes to Nova Core via set_student_presence(...) RPC.
 */
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Check, MapPin, TreePine, Coffee, DoorOpen, Users,
  BookOpen, Stethoscope, Building2, Bath,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentPresenceData } from './StudentPresenceChip';

const LOCATIONS = [
  { value: 'classroom',  label: 'In Classroom',  icon: Check },
  { value: 'playground', label: 'Playground',     icon: TreePine },
  { value: 'cafeteria',  label: 'Cafeteria',      icon: Coffee },
  { value: 'pull_out',   label: 'Pull-Out',       icon: BookOpen },
  { value: 'therapist',  label: 'With Therapist', icon: Stethoscope },
  { value: 'office',     label: 'Office',         icon: Building2 },
  { value: 'with_staff', label: 'With Staff',     icon: Users },
  { value: 'hallway',    label: 'Hallway',        icon: MapPin },
  { value: 'restroom',   label: 'Restroom',       icon: Bath },
  { value: 'on_break',   label: 'On Break',       icon: Coffee },
  { value: 'absent',     label: 'Absent',         icon: DoorOpen },
] as const;

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'transitioning', label: 'Transitioning' },
  { value: 'absent', label: 'Absent' },
  { value: 'dismissed', label: 'Dismissed' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  groupId: string;
  agencyId: string;
  currentPresence: StudentPresenceData | null;
  onPresenceUpdate: (studentId: string, presence: StudentPresenceData) => void;
}

export function StudentPresenceSheet({
  open, onOpenChange, studentId, studentName,
  groupId, agencyId, currentPresence, onPresenceUpdate,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [locationType, setLocationType] = useState(currentPresence?.location_type || 'classroom');
  const [locationLabel, setLocationLabel] = useState(currentPresence?.location_label || '');
  const [status, setStatus] = useState(currentPresence?.status || 'active');

  const save = async () => {
    if (!user) return;
    setSaving(true);

    // Optimistic update
    const newPresence: StudentPresenceData = {
      student_id: studentId,
      location_type: locationType,
      location_label: locationLabel || null,
      status,
      updated_at: new Date().toISOString(),
    };
    onPresenceUpdate(studentId, newPresence);

    try {
      const { error } = await supabase.rpc('set_student_presence' as any, {
        p_agency_id: agencyId,
        p_student_id: studentId,
        p_classroom_group_id: groupId,
        p_location_type: locationType,
        p_location_label: locationLabel || null,
        p_status: status,
        p_changed_by: user.id,
      });
      if (error) {
        console.warn('[StudentPresence] RPC failed:', error.message);
        toast({ title: 'Status update failed', variant: 'destructive' });
      } else {
        toast({ title: `${studentName} → ${LOCATIONS.find(l => l.value === locationType)?.label || locationType}` });
      }
    } catch (err) {
      console.warn('[StudentPresence] save error:', err);
    } finally {
      setSaving(false);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm font-heading">{studentName} — Location</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Location */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Where?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {LOCATIONS.map(loc => {
                const Icon = loc.icon;
                const selected = locationType === loc.value;
                return (
                  <button
                    key={loc.value}
                    onClick={() => setLocationType(loc.value)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-all',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground font-bold'
                        : 'border-border/60 bg-card hover:bg-muted/50 text-foreground font-medium',
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "text-foreground/70")} />
                    {loc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom label */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label (optional)</p>
            <Input
              placeholder="e.g. Room 204, Ms. Rivera"
              value={locationLabel}
              onChange={e => setLocationLabel(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
            <div className="flex gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all text-center',
                    status === s.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 bg-card hover:bg-muted/50 text-foreground',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
