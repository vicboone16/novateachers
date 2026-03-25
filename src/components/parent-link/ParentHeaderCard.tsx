import { Card, CardContent } from '@/components/ui/card';

interface Props {
  studentName: string;
  avatarEmoji: string;
}

export function ParentHeaderCard({ studentName, avatarEmoji }: Props) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 via-indigo-50 to-violet-50 dark:from-sky-900/30 dark:via-indigo-900/20 dark:to-violet-900/20 p-6 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.06),transparent_60%)]" />
      <div className="relative space-y-3">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/70 dark:bg-white/10 text-5xl mx-auto shadow-sm ring-2 ring-white/50">
          {avatarEmoji}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{studentName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You're viewing updates for <span className="font-medium text-foreground/70">{studentName}</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground/70">{today}</p>
      </div>
    </div>
  );
}
