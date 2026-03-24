/**
 * ClassroomReinforcementPanel — Assign a reinforcement template to an entire classroom,
 * then override per-student. Shows all students with their current template + overrides.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ReinforcementAssignPanel } from '@/components/ReinforcementAssignPanel';
import { Settings2, Loader2, Check, Users, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface StudentProfile {
  student_id: string;
  student_name: string;
  template_id: string | null;
  template_name: string | null;
  response_cost: boolean;
  bonus_points: boolean;
  has_custom_rules: boolean;
}

interface ClassroomReinforcementPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  agencyId: string;
  students: Array<{ id: string; name: string }>;
}

export function ClassroomReinforcementPanel({
  open, onOpenChange, groupId, agencyId, students,
}: ClassroomReinforcementPanelProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [classTemplateId, setClassTemplateId] = useState<string>('__none__');
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [editStudent, setEditStudent] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, bctRes] = await Promise.all([
        cloudSupabase.from('beacon_reinforcement_templates').select('id, name, category, description').order('name'),
        cloudSupabase.from('beacon_classroom_templates').select('template_id').eq('group_id', groupId).maybeSingle(),
      ]);
      setTemplates((tRes.data || []) as Template[]);
      setClassTemplateId(bctRes.data?.template_id || '__none__');

      // Load per-student profiles
      const studentIds = students.map(s => s.id);
      if (studentIds.length > 0) {
        const { data: profiles } = await cloudSupabase
          .from('student_reinforcement_profiles')
          .select('student_id, reinforcement_template_id, response_cost_enabled, bonus_points_enabled')
          .in('student_id', studentIds)
          .eq('agency_id', agencyId)
          .eq('is_active', true);

        const { data: rules } = await cloudSupabase
          .from('student_reinforcement_rules')
          .select('student_id')
          .in('student_id', studentIds)
          .eq('is_active', true);

        const profileMap = new Map((profiles || []).map(p => [p.student_id, p]));
        const ruleStudents = new Set((rules || []).map(r => r.student_id));
        const templateMap = new Map((tRes.data || []).map((t: any) => [t.id, t.name]));

        const merged: StudentProfile[] = students.map(s => {
          const p = profileMap.get(s.id);
          return {
            student_id: s.id,
            student_name: s.name,
            template_id: p?.reinforcement_template_id || null,
            template_name: p?.reinforcement_template_id ? (templateMap.get(p.reinforcement_template_id) || 'Unknown') : null,
            response_cost: p?.response_cost_enabled ?? false,
            bonus_points: p?.bonus_points_enabled ?? true,
            has_custom_rules: ruleStudents.has(s.id),
          };
        });
        setStudentProfiles(merged);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [groupId, agencyId, students]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const applyToClass = async () => {
    if (classTemplateId === '__none__') return;
    setApplying(true);
    try {
      // Save classroom template assignment
      await cloudSupabase.from('beacon_classroom_templates').upsert({
        group_id: groupId,
        template_id: classTemplateId,
        applied_by: 'system',
      }, { onConflict: 'group_id' });

      // Apply to all students who don't have a custom override
      const studentIds = students.map(s => s.id);
      for (const sid of studentIds) {
        const existing = studentProfiles.find(p => p.student_id === sid);
        // Only apply if student doesn't already have a custom template
        if (!existing?.template_id || existing.template_id === classTemplateId) {
          await cloudSupabase.from('student_reinforcement_profiles').upsert({
            student_id: sid,
            agency_id: agencyId,
            reinforcement_template_id: classTemplateId,
            reinforcement_mode: 'template',
            is_active: true,
          }, { onConflict: 'student_id,agency_id' } as any);
        }
      }

      toast({ title: '✓ Template applied to classroom' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setApplying(false);
  };

  const classTemplateName = templates.find(t => t.id === classTemplateId)?.name;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="pb-3">
            <SheetTitle className="font-heading text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Classroom Reinforcement
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Class-level template */}
              <div className="space-y-2 p-3 rounded-xl border border-border/60 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <Label className="text-xs font-bold">Classroom Default Template</Label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  This template applies to all students unless individually overridden.
                </p>
                <Select value={classTemplateId} onValueChange={setClassTemplateId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="No template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">No template</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name} — {t.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={applyToClass}
                  disabled={applying || classTemplateId === '__none__'}
                  className="w-full gap-1.5"
                  size="sm"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Apply to All Students
                </Button>
              </div>

              {/* Per-student list */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Per-Student Overrides
                </Label>
                <div className="space-y-1">
                  {studentProfiles.map(sp => (
                    <button
                      key={sp.student_id}
                      onClick={() => setEditStudent({ id: sp.student_id, name: sp.student_name })}
                      className="flex items-center gap-2 w-full rounded-lg border border-border/60 bg-card px-3 py-2.5 hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{sp.student_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {sp.template_name ? (
                            <Badge variant="secondary" className="text-[8px] h-4 px-1.5">
                              {sp.template_name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] h-4 px-1.5 text-muted-foreground">
                              {classTemplateName ? `Using: ${classTemplateName}` : 'No template'}
                            </Badge>
                          )}
                          {sp.response_cost && (
                            <Badge variant="destructive" className="text-[8px] h-4 px-1.5">RC</Badge>
                          )}
                          {sp.has_custom_rules && (
                            <Badge variant="secondary" className="text-[8px] h-4 px-1.5">Custom Rules</Badge>
                          )}
                        </div>
                      </div>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Per-student editor */}
      {editStudent && (
        <ReinforcementAssignPanel
          open={!!editStudent}
          onOpenChange={(o) => { if (!o) { setEditStudent(null); load(); } }}
          studentId={editStudent.id}
          studentName={editStudent.name}
          agencyId={agencyId}
        />
      )}
    </>
  );
}
