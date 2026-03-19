/**
 * StudentCodeGenerator — Teacher UI to generate student login codes and QR.
 * Used in student quick action modal or settings.
 */
import { useState } from 'react';
import { generateStudentLoginCode, getActiveStudentCode } from '@/lib/game-data';
import type { StudentLoginCode } from '@/lib/game-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, QrCode, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  studentId: string;
  agencyId: string;
  studentName: string;
}

export const StudentCodeGenerator = ({ studentId, agencyId, studentName }: Props) => {
  const { toast } = useToast();
  const [code, setCode] = useState<StudentLoginCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkExisting = async () => {
    setLoading(true);
    const existing = await getActiveStudentCode(studentId);
    setCode(existing);
    setChecked(true);
    setLoading(false);
  };

  const generate = async () => {
    setLoading(true);
    const newCode = await generateStudentLoginCode(studentId, agencyId);
    setCode(newCode);
    setLoading(false);
    if (newCode) {
      toast({ title: 'Code generated', description: `Code: ${newCode.login_code}` });
    }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code.login_code);
    toast({ title: 'Copied!', description: `Code ${code.login_code} copied.` });
  };

  const copyPortalLink = () => {
    if (!code) return;
    const url = `${window.location.origin}/portal/${code.login_code}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: 'Portal link copied.' });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold">Student Portal Access</p>
        </div>
        <p className="text-xs text-muted-foreground">{studentName}</p>

        {!checked && !code && (
          <Button size="sm" variant="outline" onClick={checkExisting} disabled={loading}>
            {loading ? 'Checking…' : 'Check for Active Code'}
          </Button>
        )}

        {code ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <span className="text-3xl font-bold tracking-[0.3em] font-mono">{code.login_code}</span>
              <Button size="sm" variant="ghost" onClick={copyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Expires: {new Date(code.expires_at).toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={copyPortalLink}>
                <Copy className="h-3 w-3 mr-1" /> Copy Link
              </Button>
              <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
                <RefreshCw className="h-3 w-3 mr-1" /> New Code
              </Button>
            </div>
          </div>
        ) : checked ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">No active code found.</p>
            <Button size="sm" onClick={generate} disabled={loading}>
              {loading ? 'Generating…' : 'Generate Code'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
