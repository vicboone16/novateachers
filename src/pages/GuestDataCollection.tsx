import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Minus, Check, ClipboardList, Loader2 } from 'lucide-react';

interface GuestSession {
  group_id: string;
  agency_id: string;
  guest_name: string | null;
  permissions: { can_collect_data: boolean; can_view_notes: boolean };
  student_ids: string[];
  student_names?: Record<string, string>;
}

const GuestDataCollection = () => {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<GuestSession | null>(null);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});

  // Collection state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [behaviorName, setBehaviorName] = useState('');
  const [count, setCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<number>(0);

  useEffect(() => {
    if (!code) return;
    validateCode();
  }, [code]);

  const validateCode = async () => {
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('guest-collect-data', {
        body: { code, action: 'validate' },
      });
      if (fnErr || !data?.valid) {
        setError(data?.error || 'Invalid or expired access code');
        return;
      }
      setSession(data);
      // Resolve student names from classroom_group_students
      if (data.student_ids?.length > 0) {
        const { data: students } = await supabase
          .from('classroom_group_students')
          .select('client_id, first_name, last_name')
          .in('client_id', data.student_ids);
        const names: Record<string, string> = {};
        for (const s of (students || []) as any[]) {
          const name = ((s.first_name || '') + ' ' + (s.last_name || '')).trim();
          if (name) names[s.client_id] = name;
        }
        setStudentNames(names);
      }
      if (data.student_ids?.length === 1) setSelectedStudent(data.student_ids[0]);
    } catch {
      setError('Failed to validate code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!session || !selectedStudent || !behaviorName.trim()) return;
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('guest-collect-data', {
        body: {
          code,
          action: 'collect',
          payload: {
            client_id: selectedStudent,
            entry_type: 'tally',
            behavior_name: behaviorName.trim(),
            value: count,
            notes: notes.trim() || null,
          },
        },
      });
      if (fnErr || data?.error) throw new Error(data?.error || 'Failed to save');
      toast({ title: '✓ Data saved' });
      setSubmitted(prev => prev + 1);
      setCount(0);
      setNotes('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Please contact the lead teacher for a valid code.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            NovaTrack — Guest Mode
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {session?.guest_name ? `Welcome, ${session.guest_name}` : 'Substitute Data Collection'}
          </p>
          {submitted > 0 && (
            <Badge variant="outline" className="mt-2">{submitted} entries saved</Badge>
          )}
        </div>

        {/* Context banner so substitutes know whose classroom they're covering */}
        {session && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-foreground mb-0.5">You're covering:</p>
              <p className="text-sm text-muted-foreground">
                {session.student_ids.length} student{session.student_ids.length !== 1 ? 's' : ''} in this session.
                Log behavior tallies below — each entry is saved immediately to the teacher's records.
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Tip: Use the same behavior names the teacher tracks (e.g. "Aggression", "Elopement", "Noncompliance") so data matches their records.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Log Behavior
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {session && session.student_ids.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {session.student_ids.map(id => (
                      <SelectItem key={id} value={id}>{studentNames[id] || `Student ${id.slice(0, 4)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Behavior Name</Label>
              <Input
                value={behaviorName}
                onChange={e => setBehaviorName(e.target.value)}
                placeholder="e.g. aggression, elopement, on-task"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Count</Label>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => setCount(Math.max(0, count - 1))}
                  disabled={count === 0}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <span className="text-4xl font-bold text-primary w-20 text-center">{count}</span>
                <Button
                  size="icon"
                  className="h-14 w-14 rounded-full"
                  onClick={() => setCount(count + 1)}
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Brief description…"
                className="min-h-[60px] resize-none"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedStudent || !behaviorName.trim() || count === 0}
              className="w-full gap-2 h-12"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? 'Saving…' : 'Save Entry'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuestDataCollection;
