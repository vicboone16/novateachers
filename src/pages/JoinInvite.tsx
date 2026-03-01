import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, KeyRound, CheckCircle2, Building2, Users, UserPlus } from 'lucide-react';
import { z } from 'zod';

const codeSchema = z.string().trim().min(1, 'Code is required').max(64, 'Code is too long').regex(/^[A-Za-z0-9_-]+$/, 'Invalid code format');

type RedeemResult = {
  agency_id?: string;
  agency_name?: string;
  invite_scope?: string;
  client_id?: string;
  group_id?: string;
  role_slug?: string;
  message?: string;
};

const JoinInvite = () => {
  const { user } = useAuth();
  const { loading: wsLoading } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState('');

  const handleRedeem = async () => {
    setError('');
    setResult(null);

    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    if (!user) {
      setError('You must be logged in to redeem an invite.');
      return;
    }

    setRedeeming(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('redeem_invite_code', {
        p_code: parsed.data,
        p_app_context: 'novatrack_teacher',
      });

      if (rpcError) throw rpcError;

      const res = data as RedeemResult;
      setResult(res);

      const scope = res.invite_scope || '';

      if (scope === 'agency') {
        toast({
          title: 'Agency connected!',
          description: `You've been added to ${res.agency_name || 'the agency'} as ${res.role_slug || 'member'}.`,
        });
      } else if (scope === 'group') {
        toast({
          title: 'Classroom group joined!',
          description: 'You now have access to the students in this classroom.',
        });
      } else if (scope === 'student') {
        toast({
          title: 'Student shared with you!',
          description: 'The student has been added to your roster.',
        });
      } else {
        toast({ title: 'Invite redeemed', description: res.message || 'Success' });
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to redeem invite code';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRedeeming(false);
    }
  };

  const scopeConfig: Record<string, { icon: React.ReactNode; label: string; action: string }> = {
    agency: { icon: <Building2 className="h-5 w-5" />, label: 'Agency Connected', action: 'Go to Workspaces' },
    group: { icon: <Users className="h-5 w-5" />, label: 'Classroom Joined', action: 'View Students' },
    student: { icon: <UserPlus className="h-5 w-5" />, label: 'Student Shared', action: 'View Students' },
  };

  const handlePostRedeem = () => {
    if (!result) return;
    const scope = result.invite_scope || '';
    if (scope === 'agency') {
      // Reload workspaces by navigating to workspace selector
      navigate('/workspace');
      window.location.reload();
    } else {
      navigate('/students');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/students')} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading">Join with Invite Code</h2>
          <p className="text-sm text-muted-foreground">Enter a code to connect to an agency, classroom, or student</p>
        </div>
      </div>

      {!result ? (
        <Card className="max-w-md mx-auto border-border/50">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-heading">Redeem Invite Code</CardTitle>
            <CardDescription>Paste the code you received from your administrator</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-code">Invite Code</Label>
              <Input
                id="invite-code"
                value={code}
                onChange={e => setCode(e.target.value.trim())}
                placeholder="e.g. ABC123-XYZ"
                maxLength={64}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleRedeem(); }}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button onClick={handleRedeem} disabled={redeeming || !code.trim()} className="w-full">
              {redeeming ? 'Redeeming…' : 'Redeem Code'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-md mx-auto border-border/50">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-heading">
                {scopeConfig[result.invite_scope || '']?.label || 'Invite Redeemed'}
              </h3>
              {result.agency_name && (
                <p className="text-sm text-muted-foreground mt-1">Agency: {result.agency_name}</p>
              )}
              {result.role_slug && (
                <Badge variant="secondary" className="mt-2">{result.role_slug}</Badge>
              )}
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => { setResult(null); setCode(''); }}>
                Redeem Another
              </Button>
              <Button onClick={handlePostRedeem}>
                {scopeConfig[result.invite_scope || '']?.action || 'Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JoinInvite;
