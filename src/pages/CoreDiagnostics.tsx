/**
 * Core Diagnostics — shows which Nova Core tables, columns, and RPCs
 * are available at runtime. Helps debug schema mismatches.
 */
import { useState } from 'react';
import { diagnoseSchema, type CoreDiagnostics } from '@/lib/core-bridge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, ChevronDown, Database, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const CoreDiagnosticsPage = () => {
  const [data, setData] = useState<CoreDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await diagnoseSchema();
      if (res.error) throw res.error;
      setData(res.data);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const tableEntries = data ? Object.entries(data.tables).sort(([a], [b]) => a.localeCompare(b)) : [];
  const existingTables = tableEntries.filter(([, v]) => v.exists);
  const missingTables = tableEntries.filter(([, v]) => !v.exists);
  const rpcEntries = data ? Object.entries(data.rpcs).sort(([a], [b]) => a.localeCompare(b)) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Core Schema Diagnostics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspect which Nova Core tables, columns, and RPCs are available at runtime.
          </p>
        </div>
        <Button onClick={runDiagnostics} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {loading ? 'Scanning…' : data ? 'Re-scan' : 'Run Diagnostics'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryCard label="Tables Found" value={existingTables.length} total={tableEntries.length} />
            <SummaryCard label="Tables Missing" value={missingTables.length} total={tableEntries.length} variant="destructive" />
            <SummaryCard label="RPCs Available" value={rpcEntries.filter(([,v]) => v.available).length} total={rpcEntries.length} />
            <Card className="border-border/40">
              <CardContent className="py-3 px-4">
                <p className="text-[10px] text-muted-foreground">Core URL</p>
                <p className="text-xs font-mono truncate mt-0.5">{data.core_url}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="tables">
            <TabsList>
              <TabsTrigger value="tables">Tables ({tableEntries.length})</TabsTrigger>
              <TabsTrigger value="rpcs">RPCs ({rpcEntries.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tables" className="space-y-2 mt-3">
              {tableEntries.map(([name, info]) => (
                <Collapsible key={name}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-card px-4 py-2.5 text-left hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2.5">
                      {info.exists ? (
                        <Check className="h-4 w-4 text-accent shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="text-sm font-mono font-medium">{name}</span>
                      {info.exists && info.columns && (
                        <Badge variant="secondary" className="text-[10px]">{info.columns.length} cols</Badge>
                      )}
                      {info.error && (
                        <Badge variant="destructive" className="text-[10px]">error</Badge>
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 rounded-lg border border-border/30 bg-muted/10 p-3">
                      {info.exists && info.columns && info.columns.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Column</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {info.columns.map(col => (
                              <TableRow key={col}>
                                <TableCell className="text-xs font-mono py-1.5">{col}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : info.exists ? (
                        <p className="text-xs text-muted-foreground">Table exists but no sample row to infer columns (empty table).</p>
                      ) : (
                        <p className="text-xs text-destructive">Table does not exist on Core.</p>
                      )}
                      {info.error && (
                        <p className="text-xs text-destructive mt-2">Error: {info.error}</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </TabsContent>

            <TabsContent value="rpcs" className="mt-3">
              <Card className="border-border/40">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">RPC Function</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rpcEntries.map(([name, info]) => (
                        <TableRow key={name}>
                          <TableCell className="text-sm font-mono">{name}</TableCell>
                          <TableCell>
                            {info.available ? (
                              <Badge variant="secondary" className="gap-1 text-[10px]">
                                <Check className="h-3 w-3" /> Available
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <X className="h-3 w-3" /> Missing
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {info.error || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!data && !loading && (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-12 text-center">
            <Database className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Click "Run Diagnostics" to scan the Core schema.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function SummaryCard({ label, value, total, variant }: {
  label: string; value: number; total: number; variant?: 'destructive';
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="py-3 px-4">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-semibold leading-none mt-0.5", variant === 'destructive' && value > 0 && "text-destructive")}>
          {value}<span className="text-xs text-muted-foreground font-normal">/{total}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default CoreDiagnosticsPage;
