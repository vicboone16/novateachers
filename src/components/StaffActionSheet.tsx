/**
 * StaffActionSheet — full status update sheet with location presets,
 * status selector, availability, student assignment, and note.
 * Writes via Nova Core RPC: set_staff_presence(...).
 */
import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  UserCheck, Coffee, Briefcase, Radio, ShieldCheck, UserCog, UserX, HelpCircle,
  MapPin, Loader2, School, TreePine, UtensilsCrossed, Building2, DoorOpen, Dumbbell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESENCE_STATUS_ORDER, PRESENCE_STATUS_MAP, type PresenceStatus } from './StaffPresencePanel';

interface StaffActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  agencyId: string;
  currentGroupId: string;
  currentPresence: {
    status: PresenceStatus;
    location_type: string;
    location_label: string | null;
    availability_status: string;
    available_for_support: boolean;
    assigned_student_id: string | null;
    note: string | null;
    classroom_group_id: string | null;
  } | null;
  onUpdated: () => void;
  studentMap?: Record<string, string>;
}

const LOCATION_PRESETS = [
  { value: 'classroom', label: 'This Classroom', icon: School },
  { value: 'other_classroom', label: 'Another Classroom', icon: DoorOpen },
  { value: 'playground', label: 'Playground', icon: TreePine },
  { value: 'hallway', label: 'Hallway', icon: DoorOpen },
  { value: 'cafeteria', label: 'Cafeteria', icon: UtensilsCrossed },
  { value: 'office', label: 'Office', icon: Building2 },
  { value: 'therapy_room', label: 'Therapy / Pull-Out', icon: UserCog },
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'support_room', label: 'Support Room', icon: ShieldCheck },
  { value: 'other', label: 'Other', icon: MapPin },
];

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', color: 'bg-green-500' },
  { value: 'limited', label: 'Limited', color: 'bg-amber-500' },
  { value: 'unavailable', label: 'Unavailable', color: 'bg-muted-foreground' },
];

export function StaffActionSheet({
  open, onOpenChange, userId, agencyId, currentGroupId,
  currentPresence, onUpdated, studentMap,
}: StaffActionSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMe = user?.id === userId;

  const [status, setStatus] = useState<PresenceStatus>(currentPresence?.status || 'in_room');
  const [locationType, setLocationType] = useState(currentPresence?.location_type || 'classroom');
  const [locationLabel, setLocationLabel] = useState(currentPresence?.location_label || '');
  const [availability, setAvailability] = useState(
    currentPresence?.availability_status || (currentPresence?.available_for_support ? 'available' : 'unavailable')
  );
  const [assignedStudentId, setAssignedStudentId] = useState(currentPresence?.assigned_student_id || '');
  const [note, setNote] = useState(currentPresence?.note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const isAvailable = availability === 'available' || availability === 'limited';
      const payload = {
        agency_id: agencyId,
        user_id: userId,
        classroom_group_id: status === 'in_room' ? currentGroupId : (currentPresence?.classroom_group_id || null),
        location_type: locationType,
        location_label: locationLabel || LOCATION_PRESETS.find(l => l.value === locationType)?.label || null,
        status,
        availability_status: availability,
        available_for_support: isAvailable,
        assigned_student_id: assignedStudentId || null,
        note: note || null,
        updated_at: new Date().toISOString(),
      };

      // Upsert into Lovable Cloud staff_presence table
      const { error } = await cloudSupabase
        .from('staff_presence')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        // Fallback: try insert if upsert fails (no existing row with unique constraint)
        const { error: insertErr } = await cloudSupabase.from('staff_presence').insert(payload);
        if (insertErr) {
          console.warn('[StaffAction] save failed:', insertErr.message);
          toast({ title: 'Error saving status', description: insertErr.message, variant: 'destructive' });
        } else {
          toast({ title: '✓ Status updated' });
        }
      } else {
        toast({ title: '✓ Status updated' });
      }

      // Also log to history
      await cloudSupabase.from('staff_presence_history').insert({
        agency_id: agencyId,
        user_id: userId,
        classroom_group_id: payload.classroom_group_id,
        location_type: locationType,
        location_label: payload.location_label,
        status,
        availability_status: availability,
        available_for_support: isAvailable,
        assigned_student_id: assignedStudentId || null,
        note: note || null,
        changed_by: user?.id || null,
      });

      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('[StaffAction] save failed:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Quick status tap
  const quickMove = async (newStatus: PresenceStatus) => {
    if (!isMe) { setStatus(newStatus); return; }
    setSaving(true);
    try {
      const isAvailable = newStatus === 'in_room' || newStatus === 'floating';
      const payload = {
        agency_id: agencyId,
        user_id: userId,
        classroom_group_id: newStatus === 'in_room' ? currentGroupId : null,
        location_type: newStatus === 'in_room' ? 'classroom' : locationType,
        status: newStatus,
        availability_status: isAvailable ? 'available' : 'unavailable',
        available_for_support: isAvailable,
        updated_at: new Date().toISOString(),
      };

      const { error } = await cloudSupabase
        .from('staff_presence')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        await cloudSupabase.from('staff_presence').insert(payload);
      }

      // Log history
      await cloudSupabase.from('staff_presence_history').insert({
        agency_id: agencyId,
        user_id: userId,
        classroom_group_id: payload.classroom_group_id,
        location_type: payload.location_type,
        status: newStatus,
        availability_status: payload.availability_status,
        available_for_support: isAvailable,
        changed_by: user?.id || null,
      });

      toast({ title: `✓ ${PRESENCE_STATUS_MAP[newStatus].label}` });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      console.warn('[StaffAction] quickMove error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const studentEntries = studentMap ? Object.entries(studentMap) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {isMe ? 'Update My Status' : 'Staff Status'}
          </SheetTitle>
        </SheetHeader>

        {/* Section 1: Quick status buttons */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">What's my status?</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESENCE_STATUS_ORDER.map(s => {
              const cfg = PRESENCE_STATUS_MAP[s];
              const Icon = cfg.icon;
              const active = status === s;
              return (
                <button
                  key={s}
                  onClick={() => { setStatus(s); if (isMe) quickMove(s); }}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all active:scale-95",
                    active
                      ? "border-primary bg-primary/10 text-foreground font-bold"
                      : "border-border/50 bg-card text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-foreground/70")} />
                  <span className="text-[9px] font-semibold leading-tight">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Where am I? */}
        <div className="space-y-1.5 pt-4 border-t border-border/30 mt-4">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Where am I?</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {LOCATION_PRESETS.map(loc => {
              const LocIcon = loc.icon;
              const active = locationType === loc.value;
              return (
                <button
                  key={loc.value}
                  onClick={() => setLocationType(loc.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all active:scale-95",
                    active
                      ? "border-primary bg-primary/10 text-foreground font-bold"
                      : "border-border/50 bg-card text-foreground hover:bg-muted/50"
                  )}
                >
                  <LocIcon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-foreground/70")} />
                  <span className="text-[11px] font-semibold">{loc.label}</span>
                </button>
              );
            })}
          </div>
          {(locationType === 'other' || locationType === 'other_classroom') && (
            <Input
              value={locationLabel}
              onChange={e => setLocationLabel(e.target.value)}
              placeholder={locationType === 'other_classroom' ? 'Room name…' : 'Location name…'}
              className="h-8 text-xs mt-1"
            />
          )}
        </div>

        {/* Section 3: Availability */}
        <div className="space-y-1.5 pt-4 border-t border-border/30 mt-4">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Availability</Label>
          <div className="flex gap-2">
            {AVAILABILITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAvailability(opt.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 transition-all active:scale-95",
                  availability === opt.value
                    ? "border-primary bg-primary/10 text-foreground font-bold"
                    : "border-border/50 bg-card text-foreground hover:bg-muted/50"
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", opt.color)} />
                <span className="text-[11px] font-semibold">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Student assignment */}
        {studentEntries.length > 0 && (
          <div className="space-y-1.5 pt-4 border-t border-border/30 mt-4">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned Student (optional)</Label>
            <Select value={assignedStudentId} onValueChange={setAssignedStudentId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">None</SelectItem>
                {studentEntries.map(([id, name]) => (
                  <SelectItem key={id} value={id} className="text-xs">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Section 5: Note */}
        <div className="space-y-1.5 pt-4 border-t border-border/30 mt-4">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. covering lunch, with Jayden, playground support…"
            rows={2}
            className="text-xs"
          />
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-4 mt-4 border-t border-border/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
