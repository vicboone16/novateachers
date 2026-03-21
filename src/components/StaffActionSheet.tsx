/**
 * StaffActionSheet — quick controls to move rooms, change status,
 * assign to student, change support availability.
 * Writes via set_staff_presence RPC.
 */
import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  UserCheck, Coffee, Briefcase, Radio, ShieldCheck, UserCog, UserX, HelpCircle,
  MapPin, Loader2,
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
  { value: 'classroom', label: 'Classroom' },
  { value: 'playground', label: 'Playground' },
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'office', label: 'Office' },
  { value: 'therapy_room', label: 'Therapy Room' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'gym', label: 'Gym' },
  { value: 'other', label: 'Other' },
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
  const [availableForSupport, setAvailableForSupport] = useState(currentPresence?.available_for_support ?? true);
  const [assignedStudentId, setAssignedStudentId] = useState(currentPresence?.assigned_student_id || '');
  const [note, setNote] = useState(currentPresence?.note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await cloudSupabase.rpc('set_staff_presence', {
        p_agency_id: agencyId,
        p_user_id: userId,
        p_classroom_group_id: status === 'in_room' ? currentGroupId : (currentPresence?.classroom_group_id || null),
        p_location_type: locationType,
        p_location_label: locationLabel || null,
        p_status: status,
        p_availability_status: availableForSupport ? 'available' : 'busy',
        p_available_for_support: availableForSupport,
        p_assigned_student_id: assignedStudentId || null,
        p_note: note || null,
        p_changed_by: user?.id || null,
      });

      if (error) throw error;
      toast({ title: '✓ Status updated' });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('[StaffAction] save failed:', err);
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Quick status buttons
  const quickMove = async (newStatus: PresenceStatus, newLocation?: string) => {
    setSaving(true);
    try {
      const { error } = await cloudSupabase.rpc('set_staff_presence', {
        p_agency_id: agencyId,
        p_user_id: userId,
        p_classroom_group_id: newStatus === 'in_room' ? currentGroupId : null,
        p_location_type: newLocation || locationType,
        p_status: newStatus,
        p_available_for_support: newStatus === 'in_room' || newStatus === 'floating',
        p_changed_by: user?.id || null,
      });
      if (error) throw error;
      toast({ title: `✓ ${PRESENCE_STATUS_MAP[newStatus].label}` });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const studentEntries = studentMap ? Object.entries(studentMap) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {isMe ? 'My Status' : 'Staff Status'}
          </DialogTitle>
        </DialogHeader>

        {/* Quick action buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {PRESENCE_STATUS_ORDER.map(s => {
            const cfg = PRESENCE_STATUS_MAP[s];
            const Icon = cfg.icon;
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => { setStatus(s); if (isMe) quickMove(s, s === 'in_room' ? 'classroom' : undefined); }}
                disabled={saving}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all active:scale-95",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-card text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[8px] font-medium leading-tight">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Detailed controls */}
        <div className="space-y-3 pt-2 border-t border-border/30">
          {/* Location */}
          <div className="space-y-1">
            <Label className="text-xs">Location</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_PRESETS.map(l => (
                  <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {locationType === 'other' && (
              <Input
                value={locationLabel}
                onChange={e => setLocationLabel(e.target.value)}
                placeholder="Room name…"
                className="h-7 text-xs mt-1"
              />
            )}
          </div>

          {/* Assign to student */}
          {studentEntries.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Assigned Student</Label>
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

          {/* Available for support */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Available for Support</Label>
            <Switch
              checked={availableForSupport}
              onCheckedChange={setAvailableForSupport}
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. covering for Ms. Smith…"
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          Save Status
        </Button>
      </DialogContent>
    </Dialog>
  );
}
