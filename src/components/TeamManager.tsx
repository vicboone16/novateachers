/**
 * TeamManager — Lightweight team assignment UI for teachers.
 * Lets teachers create 2-3 teams and assign students quickly.
 */
import { useState, useEffect } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Student {
  student_id: string;
  name: string;
  avatar_emoji: string;
}

interface Team {
  id: string;
  team_name: string;
  team_color: string;
  team_icon: string;
}

interface TeamMember {
  team_id: string;
  student_id: string;
}

const TEAM_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
const TEAM_ICONS = ['🔴', '🔵', '🟢', '🟡', '🟣'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  agencyId: string;
  students: Student[];
  onTeamsChanged?: () => void;
}

export function TeamManager({ open, onOpenChange, groupId, agencyId, students, onTeamsChanged }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && groupId) loadTeams();
  }, [open, groupId]);

  const loadTeams = async () => {
    const { data: teamData } = await cloudSupabase
      .from('classroom_teams')
      .select('id, team_name, team_color, team_icon')
      .eq('group_id', groupId)
      .order('sort_order');
    setTeams((teamData || []) as Team[]);

    const { data: memberData } = await cloudSupabase
      .from('classroom_team_members')
      .select('team_id, student_id')
      .eq('group_id', groupId);
    setMembers((memberData || []) as TeamMember[]);
  };

  const addTeam = async () => {
    if (!newTeamName.trim() || teams.length >= 5) return;
    const idx = teams.length;
    const { data } = await cloudSupabase.from('classroom_teams').insert({
      group_id: groupId,
      agency_id: agencyId,
      team_name: newTeamName.trim(),
      team_color: TEAM_COLORS[idx % TEAM_COLORS.length],
      team_icon: TEAM_ICONS[idx % TEAM_ICONS.length],
      sort_order: idx,
    }).select().single();
    if (data) {
      setTeams(prev => [...prev, data as Team]);
      setNewTeamName('');
    }
  };

  const removeTeam = async (teamId: string) => {
    await cloudSupabase.from('classroom_team_members').delete().eq('team_id', teamId);
    await cloudSupabase.from('classroom_teams').delete().eq('id', teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
    setMembers(prev => prev.filter(m => m.team_id !== teamId));
  };

  const assignStudent = async (studentId: string, teamId: string) => {
    // Remove from any existing team
    await cloudSupabase.from('classroom_team_members').delete().eq('student_id', studentId).eq('group_id', groupId);
    // Assign to new team
    await cloudSupabase.from('classroom_team_members').insert({
      team_id: teamId,
      student_id: studentId,
      group_id: groupId,
    });
    setMembers(prev => [
      ...prev.filter(m => m.student_id !== studentId),
      { team_id: teamId, student_id: studentId },
    ]);
  };

  const randomAssign = async () => {
    if (teams.length < 2) return;
    setSaving(true);
    // Delete all current assignments
    await cloudSupabase.from('classroom_team_members').delete().eq('group_id', groupId);
    // Shuffle and assign
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const newMembers: TeamMember[] = [];
    for (let i = 0; i < shuffled.length; i++) {
      const team = teams[i % teams.length];
      newMembers.push({ team_id: team.id, student_id: shuffled[i].student_id });
    }
    // Batch insert
    await cloudSupabase.from('classroom_team_members').insert(
      newMembers.map(m => ({ ...m, group_id: groupId }))
    );
    setMembers(newMembers);
    setSaving(false);
    toast({ title: '🎲 Teams shuffled!' });
  };

  const getTeamForStudent = (studentId: string) => members.find(m => m.student_id === studentId)?.team_id;
  const unassigned = students.filter(s => !getTeamForStudent(s.student_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Team Manager
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create team */}
          <div className="flex gap-2">
            <Input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="Team name…"
              className="h-9 text-sm"
              maxLength={30}
              onKeyDown={e => e.key === 'Enter' && addTeam()}
            />
            <Button size="sm" onClick={addTeam} disabled={!newTeamName.trim() || teams.length >= 5}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Teams */}
          {teams.map(team => {
            const teamMembers = members.filter(m => m.team_id === team.id);
            const teamStudents = teamMembers.map(m => students.find(s => s.student_id === m.student_id)).filter(Boolean);
            return (
              <Card key={team.id} className="border-border/40">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{team.team_icon}</span>
                      <span className="text-sm font-bold" style={{ color: team.team_color }}>{team.team_name}</span>
                      <Badge variant="outline" className="text-[9px]">{teamMembers.length} members</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTeam(team.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {teamStudents.map(s => s && (
                      <Badge key={s.student_id} variant="secondary" className="text-xs gap-1 py-1">
                        {s.avatar_emoji} {s.name}
                      </Badge>
                    ))}
                    {teamMembers.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">No members yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Random assign button */}
          {teams.length >= 2 && (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={randomAssign} disabled={saving}>
              <Shuffle className="h-4 w-4" /> Randomly Assign All Students
            </Button>
          )}

          {/* Unassigned students */}
          {unassigned.length > 0 && teams.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Unassigned ({unassigned.length})</p>
              {unassigned.map(s => (
                <div key={s.student_id} className="flex items-center gap-2 py-1">
                  <span className="text-lg">{s.avatar_emoji}</span>
                  <span className="text-sm flex-1">{s.name}</span>
                  <div className="flex gap-1">
                    {teams.map(t => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        style={{ borderColor: t.team_color, color: t.team_color }}
                        onClick={() => assignStudent(s.student_id, t.id)}
                      >
                        {t.team_icon}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button className="w-full" onClick={() => { onOpenChange(false); onTeamsChanged?.(); }}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
