import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Search, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Client, ClientAccess } from '@/lib/types';

const Students = () => {
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    try {
      if (isSoloMode) {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('agency_id', currentWorkspace.agency_id)
          .order('last_name');

        if (error) throw error;
        setClients(data || []);
      } else {
        // Connected mode: use user_client_access view
        const { data, error } = await supabase
          .from('user_client_access')
          .select('*, client:clients(*)')
          .eq('user_id', user?.id);

        if (error) throw error;
        setClients((data || []).map((d: any) => d.client));
      }
    } catch (err: any) {
      console.error('Failed to load clients:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!currentWorkspace || !newFirst.trim() || !newLast.trim()) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('clients').insert({
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        agency_id: currentWorkspace.agency_id,
      });

      if (error) throw error;

      toast({ title: 'Student added' });
      setShowAdd(false);
      setNewFirst('');
      setNewLast('');
      loadClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return c.first_name.toLowerCase().includes(q) || c.last_name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Students
          </h2>
          <p className="text-sm text-muted-foreground">
            {isSoloMode ? 'Manage your classroom roster' : 'View your assigned students'}
          </p>
        </div>

        {isSoloMode && (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={newLast} onChange={(e) => setNewLast(e.target.value)} />
                </div>
                <Button onClick={handleAdd} disabled={saving} className="w-full">
                  {saving ? 'Adding…' : 'Add Student'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <User className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No students match your search' : 'No students yet'}
          </p>
          {isSoloMode && !search && (
            <Button variant="link" className="mt-2" onClick={() => setShowAdd(true)}>
              Add your first student
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer border-border/50 transition-shadow hover:shadow-md"
              onClick={() => navigate(`/students/${client.id}`)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-sm font-semibold">
                    {client.first_name[0]}{client.last_name[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {client.first_name} {client.last_name}
                  </p>
                  {client.grade && (
                    <p className="text-xs text-muted-foreground">Grade {client.grade}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Students;
