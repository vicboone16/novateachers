import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Link2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface RedeemAgencyInviteCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRedeemed?: () => void;
}

export function RedeemAgencyInviteCode({ open, onOpenChange, onRedeemed }: RedeemAgencyInviteCodeProps) {
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Validate code format: alphanumeric with dashes, max 64 chars
    if (trimmed.length > 64 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      toast.error('Invalid invite code format');
      return;
    }
    setRedeeming(true);
    try {
      const { data, error } = await (supabase.rpc as any)('redeem_agency_invite_code', {
        p_code: trimmed,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        toast.error(result.error || 'Failed to redeem code');
        return;
      }
      setSuccess(true);
      toast.success('Successfully joined agency!');
      onRedeemed?.();
    } catch (err: any) {
      toast.error('Something went wrong: ' + err.message);
    } finally {
      setRedeeming(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Join Agency
          </DialogTitle>
          <DialogDescription>
            Enter an agency invite code to join an organization.
          </DialogDescription>
        </DialogHeader>
        {success ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="font-medium">You've joined the agency!</p>
            <p className="text-sm text-muted-foreground">Refresh to see it.</p>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <Label>Invite Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AGY-XXXX-XXXX"
                className="font-mono tracking-wider"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRedeem} disabled={redeeming || !code.trim()}>
                {redeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Join Agency
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
