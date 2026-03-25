/**
 * TrackSelector — Lets teachers pick a track from available game_tracks.
 * Shows a mini SVG preview of each track shape.
 */
import { useState } from 'react';
import type { GameTrack } from '@/hooks/useGameTrack';
import { generateSmoothPath } from '@/hooks/useGameTrack';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tracks: GameTrack[];
  activeTrackId: string | null;
  onSelect: (trackId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TrackPreview({ track, isActive }: { track: GameTrack; isActive: boolean }) {
  const w = 160;
  const h = 64;
  const pathD = generateSmoothPath(track.nodes, w, h);

  return (
    <Card className={cn(
      "cursor-pointer transition-all border-2",
      isActive ? "border-primary ring-2 ring-primary/20" : "border-border/40 hover:border-primary/40"
    )}>
      <CardContent className="p-3 space-y-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 rounded-lg" style={{ background: 'hsl(220, 14%, 96%)' }}>
          <path d={pathD} fill="none" stroke="hsl(220, 70%, 50%)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          {/* Zones preview */}
          {track.zones.map((z, i) => {
            const sx = (track.nodes[0]?.x || 0) / 100 * w;
            const zoneWidth = (z.end_pct - z.start_pct) * w;
            return (
              <rect key={i} x={z.start_pct * w} y={0} width={zoneWidth} height={h}
                fill={z.color} opacity="0.15" rx="4" />
            );
          })}
          {/* Checkpoints */}
          {track.checkpoints.map((cp, i) => {
            const cx = cp.progress_pct * w;
            return <circle key={i} cx={cx} cy={h / 2} r={3} fill="hsl(48, 96%, 53%)" opacity="0.6" />;
          })}
        </svg>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{track.name}</p>
            <p className="text-[10px] text-muted-foreground">{track.total_steps} steps · {track.nodes.length} nodes · {track.zones.length} zones</p>
          </div>
          {isActive && <Check className="h-4 w-4 text-primary" />}
        </div>
        {track.zones.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {track.zones.map((z, i) => (
              <Badge key={i} variant="outline" className="text-[9px] py-0" style={{ borderColor: z.color, color: z.color }}>
                {z.label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TrackSelector({ tracks, activeTrackId, onSelect, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" /> Select Track
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {tracks.map(t => (
            <div key={t.id} onClick={() => { onSelect(t.id); onOpenChange(false); }}>
              <TrackPreview track={t} isActive={t.id === activeTrackId} />
            </div>
          ))}
          {tracks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No tracks available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
