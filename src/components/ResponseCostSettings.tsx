/**
 * ResponseCostSettings — Per-student toggle for response cost.
 * Reads/writes student_reinforcement_profiles.response_cost_enabled
 * and custom_settings JSON for deduction amount.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, ShieldAlert, User } from 'lucide-react';

interface StudentOption {
  id: string;
  name: string;
}

interface Props {
  agencyId: string;
  classroomId?: string;
  students: StudentOption[];
}

interface ProfileData {
  id?: string;
  response_cost_enabled: boolean;
  default_deduction: number;
}

const DEFAULT_PROFILE: ProfileData = {
  response_cost_enabled: false,
  default_deduction: 1,
};

export function ResponseCostSettings({ agencyId, classroomId, students }: Props) {
  const { toast } = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    try {
      const { data } = await cloudSupabase
        .from('student_reinforcement_profiles' as any)
        .select('id, response_cost_enabled, custom_settings')
        .eq('agency_id', agencyId)
        .eq('student_id', studentId)
        .eq('is_active', true)
        .limit(1)
        .single();
      if (data) {
        const d = data as any;
        const cs = d.custom_settings || {};
        setProfile({
          id: d.id,
          response_cost_enabled: d.response_cost_enabled ?? false,
          default_deduction: cs.default_deduction ?? 1,
        });
      } else {
        setProfile(DEFAULT_PROFILE);
      }
    } catch {
      setProfile(DEFAULT_PROFILE);
    }
    setLoading(false);
  }, [agencyId]);

  useEffect(() => {
    if (selectedStudentId) loadProfile(selectedStudentId);
  }, [selectedStudentId, loadProfile]);

  // Auto-select first student
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const saveProfile = async () => {
    if (!selectedStudentId) return;
    setSaving(true);
    try {
      const customSettings = { default_deduction: profile.default_deduction };
      if (profile.id) {
        await cloudSupabase
          .from('student_reinforcement_profiles' as any)
          .update({
            response_cost_enabled: profile.response_cost_enabled,
            custom_settings: customSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      } else {
        const { data } = await cloudSupabase
          .from('student_reinforcement_profiles' as any)
          .insert({
            agency_id: agencyId,
            student_id: selectedStudentId,
            classroom_id: classroomId || null,
            response_cost_enabled: profile.response_cost_enabled,
            custom_settings: customSettings,
            reinforcement_mode: 'custom',
            use_template_defaults: false,
          })
          .select('id')
          .single();
        if (data) setProfile(prev => ({ ...prev, id: (data as any).id }));
      }
      toast({ title: 'Response cost settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Response Cost Settings
        </CardTitle>
        <CardDescription className="text-xs">
          Control whether points can be deducted per student when logging behaviors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Student picker */}
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <User className="h-3 w-3" /> Student
          </Label>
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {students.length === 0 && <option value="">No students</option>}
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : selectedStudentId ? (
          <>
            {/* Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <div>
                <p className="text-sm font-medium">Enable Response Cost</p>
                <p className="text-[10px] text-muted-foreground">
                  Allow points to be deducted for this student
                </p>
              </div>
              <Switch
                checked={profile.response_cost_enabled}
                onCheckedChange={v => setProfile(prev => ({ ...prev, response_cost_enabled: v }))}
              />
            </div>

            {profile.response_cost_enabled && (
              <div className="space-y-1">
                <Label className="text-xs">Default Deduction Amount</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={profile.default_deduction}
                    onChange={e => setProfile(prev => ({ ...prev, default_deduction: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="h-8 text-xs w-20"
                    min={1}
                    max={20}
                  />
                  <Badge variant="outline" className="text-[9px]">points per deduction</Badge>
                </div>
              </div>
            )}

            <Button onClick={saveProfile} disabled={saving} className="w-full gap-1.5" size="sm">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
