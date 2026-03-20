/**
 * MaydayContactsManager — Admin UI to manage mayday alert recipients.
 * Supports external contacts (not in system) with phone/email.
 * Recipients can opt out on specific days. Admin can override.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Phone, Mail, Shield, UserPlus, Pencil, Save, X } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MaydayContact {
  id: string;
  agency_id: string;
  user_id: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  role_label: string;
  notify_email: boolean;
  notify_sms: boolean;
  notify_in_app: boolean;
  opt_out_days: number[];
  admin_override: boolean;
  is_active: boolean;
}

interface Props {
  agencyId: string;
}

export function MaydayContactsManager({ agencyId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<MaydayContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('staff');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [optOutDays, setOptOutDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await cloudSupabase
        .from('mayday_contacts' as any)
        .select('*')
        .eq('agency_id', agencyId)
        .order('contact_name');
      setContacts((data || []) as any as MaydayContact[]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [agencyId]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setRole('staff');
    setNotifyEmail(true); setNotifySms(false); setNotifyInApp(true);
    setOptOutDays([]); setEditingId(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const row: any = {
        agency_id: agencyId,
        contact_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role_label: role,
        notify_email: notifyEmail,
        notify_sms: notifySms,
        notify_in_app: notifyInApp,
        opt_out_days: optOutDays,
        created_by: user?.id,
      };

      if (editingId) {
        const { error } = await cloudSupabase.from('mayday_contacts' as any).update(row).eq('id', editingId);
        if (error) throw error;
        toast({ title: '✓ Contact updated' });
      } else {
        const { error } = await cloudSupabase.from('mayday_contacts' as any).insert(row);
        if (error) throw error;
        toast({ title: '✓ Contact added' });
      }
      resetForm();
      setShowAdd(false);
      loadContacts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleEdit = (c: MaydayContact) => {
    setEditingId(c.id);
    setName(c.contact_name);
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setRole(c.role_label);
    setNotifyEmail(c.notify_email);
    setNotifySms(c.notify_sms);
    setNotifyInApp(c.notify_in_app);
    setOptOutDays(c.opt_out_days || []);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this mayday contact?')) return;
    await cloudSupabase.from('mayday_contacts' as any).delete().eq('id', id);
    toast({ title: 'Contact removed' });
    loadContacts();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await cloudSupabase.from('mayday_contacts' as any).update({ is_active: !current }).eq('id', id);
    loadContacts();
  };

  const handleToggleOverride = async (id: string, current: boolean) => {
    await cloudSupabase.from('mayday_contacts' as any).update({ admin_override: !current }).eq('id', id);
    toast({ title: !current ? 'Admin override enabled' : 'Admin override removed' });
    loadContacts();
  };

  const toggleOptOutDay = (day: number) => {
    setOptOutDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" /> Mayday Contacts
          </CardTitle>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="h-3 w-3" /> Add Contact
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage who gets notified during emergencies. External contacts (not in system) can be added with phone/email.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-2">No mayday contacts configured</p>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="gap-1">
              <UserPlus className="h-3 w-3" /> Add First Contact
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className={`rounded-lg border p-3 space-y-1.5 ${c.is_active ? 'border-border/60' : 'border-border/30 opacity-60'}`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{c.contact_name}</span>
                      <Badge variant="outline" className="text-[9px]">{c.role_label}</Badge>
                      {c.user_id && <Badge variant="secondary" className="text-[9px]">System</Badge>}
                      {!c.user_id && <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">External</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.email && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{c.email}</span>}
                      {c.phone && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{c.phone}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {c.notify_email && <Badge variant="outline" className="text-[8px] px-1">Email</Badge>}
                      {c.notify_sms && <Badge variant="outline" className="text-[8px] px-1">SMS</Badge>}
                      {c.notify_in_app && <Badge variant="outline" className="text-[8px] px-1">In-App</Badge>}
                      {c.opt_out_days?.length > 0 && (
                        <Badge variant="outline" className="text-[8px] px-1 text-amber-600">
                          Off: {c.opt_out_days.map(d => DAYS[d]).join(', ')}
                        </Badge>
                      )}
                      {c.admin_override && (
                        <Badge className="text-[8px] px-1 bg-destructive/10 text-destructive border-destructive/30">Override</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={c.is_active} onCheckedChange={() => handleToggleActive(c.id, c.is_active)} className="scale-75" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(c)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleToggleOverride(c.id, c.admin_override)} title="Admin override (ignore opt-out)">
                      <Shield className="h-3 w-3 text-destructive" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showAdd} onOpenChange={(v) => { if (!v) { resetForm(); } setShowAdd(v); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">{editingId ? 'Edit' : 'Add'} Mayday Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dr. Smith, Principal Jones" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-8 text-sm" type="email" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-123-4567" className="h-8 text-sm" type="tel" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="bcba">BCBA</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="rbt">RBT</SelectItem>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="nurse">School Nurse</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="parent">Parent/Guardian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notification Channels</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={notifyEmail} onCheckedChange={(v) => setNotifyEmail(!!v)} /> Email
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={notifySms} onCheckedChange={(v) => setNotifySms(!!v)} /> SMS
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={notifyInApp} onCheckedChange={(v) => setNotifyInApp(!!v)} /> In-App
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Opt-Out Days (recipient won't be notified)</Label>
                <div className="flex gap-1">
                  {DAYS.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => toggleOptOutDay(i)}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium border transition-colors ${
                        optOutDays.includes(i)
                          ? 'bg-destructive/10 text-destructive border-destructive/30'
                          : 'bg-muted border-border'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full gap-1.5" size="sm">
                <Save className="h-3.5 w-3.5" /> {editingId ? 'Update' : 'Add'} Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
