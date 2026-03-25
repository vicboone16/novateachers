/**
 * QuickStartSetup — 3-step guided classroom setup with prebuilt templates.
 * Teachers can start using Beacon in under 3 minutes.
 */
import { useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Rocket, GraduationCap, Shield, Heart, Users,
  ChevronRight, Check, Sparkles, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  ageBand: string;
  config: {
    behaviors: { name: string; points: number; type: 'response_cost' | 'reinforcement' }[];
    positiveActions: { label: string; icon: string; points: number }[];
    reinforcementType: string;
    tokenGoal: number;
    rewards: { name: string; emoji: string; cost: number }[];
  };
}

const TEMPLATES: QuickStartTemplate[] = [
  {
    id: 'elementary_sdc',
    name: 'Elementary SDC',
    description: 'Special day class with structured reinforcement, visual supports, and token boards.',
    icon: Shield,
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    ageBand: 'K–5',
    config: {
      behaviors: [
        { name: 'Aggression', points: 2, type: 'response_cost' },
        { name: 'Elopement', points: 3, type: 'response_cost' },
        { name: 'Disruption', points: 1, type: 'response_cost' },
        { name: 'Noncompliance', points: 1, type: 'response_cost' },
      ],
      positiveActions: [
        { label: 'Following Directions', icon: '✅', points: 1 },
        { label: 'Kind Words', icon: '💬', points: 1 },
        { label: 'Staying Safe', icon: '🛡️', points: 2 },
        { label: 'Transition Success', icon: '🚶', points: 1 },
      ],
      reinforcementType: 'FR1',
      tokenGoal: 5,
      rewards: [
        { name: '5 min free choice', emoji: '🎮', cost: 10 },
        { name: 'Sticker', emoji: '⭐', cost: 5 },
        { name: 'Line leader', emoji: '🏆', cost: 8 },
        { name: 'Extra recess', emoji: '🏃', cost: 20 },
      ],
    },
  },
  {
    id: 'mild_mod',
    name: 'Mild/Mod Classroom',
    description: 'Resource or inclusion setting with balanced reinforcement and fewer restrictions.',
    icon: Heart,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    ageBand: '3–8',
    config: {
      behaviors: [
        { name: 'Off-task', points: 1, type: 'response_cost' },
        { name: 'Disruption', points: 1, type: 'response_cost' },
      ],
      positiveActions: [
        { label: 'On Task', icon: '📚', points: 1 },
        { label: 'Participation', icon: '🙋', points: 1 },
        { label: 'Helping Others', icon: '🤝', points: 2 },
        { label: 'Task Complete', icon: '✅', points: 2 },
      ],
      reinforcementType: 'FR2',
      tokenGoal: 8,
      rewards: [
        { name: 'Homework pass', emoji: '📝', cost: 15 },
        { name: 'Lunch w/ teacher', emoji: '🍕', cost: 20 },
        { name: 'Prize box', emoji: '🎁', cost: 10 },
        { name: 'Free seating', emoji: '💺', cost: 8 },
      ],
    },
  },
  {
    id: 'gen_ed_behavior',
    name: 'Gen Ed Behavior Support',
    description: 'Whole-class PBIS-aligned system with positive reinforcement emphasis.',
    icon: GraduationCap,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    ageBand: 'K–12',
    config: {
      behaviors: [
        { name: 'Major Disruption', points: 2, type: 'response_cost' },
      ],
      positiveActions: [
        { label: 'Be Respectful', icon: '🤝', points: 1 },
        { label: 'Be Responsible', icon: '📋', points: 1 },
        { label: 'Be Safe', icon: '🛡️', points: 1 },
        { label: 'Great Effort', icon: '💪', points: 2 },
      ],
      reinforcementType: 'VR3',
      tokenGoal: 10,
      rewards: [
        { name: 'Class party', emoji: '🎉', cost: 100 },
        { name: 'Extra recess', emoji: '⚽', cost: 50 },
        { name: 'DJ for the day', emoji: '🎵', cost: 30 },
        { name: 'Treasure box', emoji: '💎', cost: 15 },
      ],
    },
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  onComplete: (groupId: string) => void;
}

export function QuickStartSetup({ open, onOpenChange, agencyId, onComplete }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<QuickStartTemplate | null>(null);
  const [classroomName, setClassroomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const DEMO_STUDENTS = [
    { first_name: 'Jayceon', last_name: 'M.' },
    { first_name: 'Aaliyah', last_name: 'R.' },
    { first_name: 'Lorenzo', last_name: 'G.' },
    { first_name: 'Maya', last_name: 'T.' },
    { first_name: 'Khalil', last_name: 'W.' },
  ];

  const handleCreate = async () => {
    if (!user || !selectedTemplate || !classroomName.trim()) return;
    setCreating(true);

    try {
      // 1. Create classroom group
      const { data: group, error: groupErr } = await cloudSupabase
        .from('classroom_groups')
        .insert({
          agency_id: agencyId,
          name: classroomName.trim(),
          created_by: user.id,
          grade_band: selectedTemplate.ageBand,
        })
        .select('group_id')
        .single();

      if (groupErr || !group) throw groupErr || new Error('Failed to create classroom');
      const groupId = (group as any).group_id;

      // 2. Add teacher to classroom
      await cloudSupabase.from('classroom_group_teachers').insert({
        group_id: groupId,
        user_id: user.id,
      });

      // 3. Create classroom settings
      await cloudSupabase.from('classroom_settings').insert({
        group_id: groupId,
        agency_id: agencyId,
        point_goal: selectedTemplate.config.tokenGoal * 10,
        point_goal_label: 'Daily Goal',
        mission_text: 'Be Kind, Be Safe, Be Respectful',
        word_of_week: 'Perseverance',
      });

      // 4. Create point rules (positive actions)
      for (const action of selectedTemplate.config.positiveActions) {
        await cloudSupabase.from('teacher_point_rules').insert({
          agency_id: agencyId,
          rule_name: action.label,
          source_table: 'teacher_data_events',
          event_type: 'positive_action',
          event_subtype: action.label.toLowerCase().replace(/\s+/g, '_'),
          points: action.points,
          rule_type: 'reinforcement',
          active: true,
        } as any);
      }

      // 5. Create behavior rules (response costs)
      for (const behavior of selectedTemplate.config.behaviors) {
        await cloudSupabase.from('teacher_point_rules').insert({
          agency_id: agencyId,
          rule_name: behavior.name,
          source_table: 'teacher_frequency_entries',
          behavior_name: behavior.name,
          points: -behavior.points,
          rule_type: 'response_cost',
          active: true,
        } as any);
      }

      // 6. Create demo students if demo mode
      if (demoMode) {
        for (const s of DEMO_STUDENTS) {
          const { data: client } = await (cloudSupabase
            .from('clients' as any)
            .insert({
              first_name: s.first_name,
              last_name: s.last_name,
              agency_id: agencyId,
              student_origin: 'demo',
              created_in_app: 'beacon',
            }) as any)
            .select('id')
            .single();

          if (client) {
            await cloudSupabase.from('classroom_group_students').insert({
              group_id: groupId,
              client_id: (client as any).id,
              agency_id: agencyId,
            });
          }
        }
      }

      // 7. Create default rewards via core-bridge
      try {
        const { supabase: coreSupabase } = await import('@/integrations/supabase/client');
        for (const reward of selectedTemplate.config.rewards) {
          await coreSupabase.functions.invoke('core-bridge', {
            body: {
              action: 'create_reward',
              name: reward.name,
              emoji: reward.emoji,
              cost: reward.cost,
              scope_type: 'classroom',
              scope_id: groupId,
              agency_id: agencyId,
              created_by: user.id,
            },
          });
        }
      } catch { /* rewards are optional; continue */ }

      toast({ title: '🚀 Classroom created!', description: `"${classroomName}" is ready to go.` });
      onComplete(groupId);
      onOpenChange(false);

      // Reset
      setStep(1);
      setSelectedTemplate(null);
      setClassroomName('');
      setDemoMode(false);
    } catch (err: any) {
      toast({ title: 'Setup failed', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Quick Start — {step}/3
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-2 mb-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              s <= step ? 'bg-primary' : 'bg-muted',
            )} />
          ))}
        </div>

        {/* Step 1: Choose template */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose a template that matches your classroom:</p>
            {TEMPLATES.map(template => {
              const Icon = template.icon;
              const isSelected = selectedTemplate?.id === template.id;
              return (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    isSelected && 'ring-2 ring-primary border-primary/50',
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', template.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{template.name}</p>
                        <Badge variant="outline" className="text-[9px]">{template.ageBand}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{template.description}</p>
                      <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span>{template.config.positiveActions.length} actions</span>
                        <span>·</span>
                        <span>{template.config.behaviors.length} behaviors</span>
                        <span>·</span>
                        <span>{template.config.rewards.length} rewards</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <Button
              className="w-full gap-1.5"
              disabled={!selectedTemplate}
              onClick={() => setStep(2)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Name classroom */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="classroom-name" className="text-sm font-semibold">Classroom Name</Label>
              <Input
                id="classroom-name"
                value={classroomName}
                onChange={e => setClassroomName(e.target.value)}
                placeholder="e.g. Room 204, Mrs. Johnson's Class"
                className="mt-1.5"
                autoFocus
              />
            </div>

            <div className="rounded-xl border border-border/60 p-3">
              <button
                onClick={() => setDemoMode(!demoMode)}
                className="flex items-center gap-3 w-full text-left"
              >
                <div className={cn(
                  'h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors',
                  demoMode ? 'bg-primary border-primary' : 'border-border',
                )}>
                  {demoMode && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Demo Mode</p>
                  <p className="text-[11px] text-muted-foreground">Add 5 sample students with simulated data to try it out</p>
                </div>
              </button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button
                className="flex-1 gap-1.5"
                disabled={!classroomName.trim()}
                onClick={() => setStep(3)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {step === 3 && selectedTemplate && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Review your setup:</p>

            <div className="rounded-xl bg-muted/50 p-3 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Classroom</span>
                <span className="text-xs font-bold text-foreground">{classroomName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Template</span>
                <span className="text-xs font-bold text-foreground">{selectedTemplate.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Positive Actions</span>
                <span className="text-xs font-bold text-foreground">{selectedTemplate.config.positiveActions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Behavior Tracking</span>
                <span className="text-xs font-bold text-foreground">{selectedTemplate.config.behaviors.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Rewards</span>
                <span className="text-xs font-bold text-foreground">{selectedTemplate.config.rewards.length}</span>
              </div>
              {demoMode && (
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Demo Students</span>
                  <span className="text-xs font-bold text-foreground">5 sample students</span>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-muted-foreground">This will create:</p>
              <ul className="text-[11px] text-foreground/80 space-y-1 mt-1.5">
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Classroom with settings</li>
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Point rules & behavior tracking</li>
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Reward store items</li>
                {demoMode && <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Demo students for testing</li>}
              </ul>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <>
                    <Rocket className="h-4 w-4" /> Create Classroom
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
