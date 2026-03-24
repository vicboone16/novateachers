import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Star,
  Users,
  Shield,
  MessageCircle,
  Target,
  Gift,
  Bell,
  Zap,
  Camera,
  BookOpen,
  Gamepad2,
} from 'lucide-react';

const slides = [
  {
    icon: BookOpen,
    badge: 'Welcome',
    title: 'Welcome to Beacon',
    subtitle: 'Your all-in-one classroom behavior & reinforcement platform',
    description: 'Beacon connects teachers, BCBAs, and families with real-time data collection, reinforcement systems, and communication tools.',
    visual: 'welcome',
    gradient: 'from-primary/20 via-accent/10 to-primary/5',
  },
  {
    icon: BarChart3,
    badge: 'Data Collection',
    title: 'Tap. Track. Done.',
    subtitle: 'Frequency, duration, and ABC logging in seconds',
    description: 'Quick Add lets you record behaviors with a single tap. Track frequency counts, start/stop duration timers, and log detailed ABC data — all saved instantly for BCBA review.',
    visual: 'data',
    gradient: 'from-primary/15 via-blue-500/10 to-primary/5',
  },
  {
    icon: Target,
    badge: 'Engagement & Probes',
    title: 'Measure What Matters',
    subtitle: 'Engagement sampling & skill probes on autopilot',
    description: 'Set interval prompts to track on-task behavior. Run quick skill probes during instruction. Every data point feeds trend charts and weekly summaries automatically.',
    visual: 'engagement',
    gradient: 'from-accent/20 via-emerald-500/10 to-accent/5',
  },
  {
    icon: Star,
    badge: 'Beacon Points',
    title: 'Points That Motivate',
    subtitle: 'Award, override, and reset — all in real time',
    description: 'Beacon Points auto-award for engagement and probes. Manually award or apply response cost with one tap. Token boards visualize progress. Reset per student or whole class.',
    visual: 'points',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-amber-500/5',
  },
  {
    icon: Gift,
    badge: 'Reward Store',
    title: 'Earn & Redeem',
    subtitle: 'A store students love, managed by you',
    description: 'Create tangible, activity, social, or edible rewards with point costs. Students redeem from the store, stock limits prevent over-use, and sponsored rewards appear alongside yours.',
    visual: 'rewards',
    gradient: 'from-pink-500/20 via-rose-500/10 to-pink-500/5',
  },
  {
    icon: Users,
    badge: 'Classroom View',
    title: 'Your Classroom at a Glance',
    subtitle: 'Attendance, presence, points, and staff — one screen',
    description: 'See who\'s here, where students are, who\'s paired with staff, and live point balances. Update attendance and presence in real time. Everything your team needs, instantly.',
    visual: 'classroom',
    gradient: 'from-indigo-500/20 via-violet-500/10 to-indigo-500/5',
  },
  {
    icon: Gamepad2,
    badge: 'Game Board',
    title: 'Gamify the Day',
    subtitle: 'Avatars, leaderboards, and class goals',
    description: 'Students pick avatars and unlock new ones with points. The classroom game board shows live standings, class-wide goals, and the word of the week — displayed on any screen.',
    visual: 'game',
    gradient: 'from-violet-500/20 via-purple-500/10 to-violet-500/5',
  },
  {
    icon: MessageCircle,
    badge: 'Communication',
    title: 'Stay Connected',
    subtitle: 'Threads, inbox, and parent snapshots',
    description: 'Create public or private threads for your team. Send formal messages through the inbox. Generate secure parent snapshot links with daily highlights — no login required.',
    visual: 'comms',
    gradient: 'from-cyan-500/20 via-sky-500/10 to-cyan-500/5',
  },
  {
    icon: Shield,
    badge: 'Safety',
    title: 'Mayday When It Matters',
    subtitle: 'Emergency alerts to your entire team, instantly',
    description: 'The MAYDAY button sends urgency-leveled alerts to admins and supervisors. Select recipients, add notes, and trigger immediate in-app notifications across your team.',
    visual: 'safety',
    gradient: 'from-destructive/20 via-red-500/10 to-destructive/5',
  },
  {
    icon: Zap,
    badge: 'Get Started',
    title: 'You\'re Ready',
    subtitle: 'Start collecting data and reinforcing great behavior',
    description: 'Head to your Classroom page to see your students. Open the Teacher Guide anytime for step-by-step instructions. Every data point helps your BCBA make better decisions.',
    visual: 'ready',
    gradient: 'from-primary/20 via-accent/10 to-primary/5',
  },
];

const visualElements: Record<string, { shapes: Array<{ type: string; className: string }> }> = {
  welcome: {
    shapes: [
      { type: 'circle', className: 'w-32 h-32 bg-primary/10 top-8 right-8' },
      { type: 'circle', className: 'w-20 h-20 bg-accent/15 bottom-12 left-12' },
      { type: 'rect', className: 'w-40 h-2 bg-primary/20 top-1/2 left-1/4 rounded-full' },
      { type: 'rect', className: 'w-24 h-2 bg-accent/20 top-[55%] left-1/4 rounded-full' },
      { type: 'circle', className: 'w-8 h-8 bg-primary/25 top-16 left-1/3' },
    ],
  },
  data: {
    shapes: [
      { type: 'rect', className: 'w-12 h-20 bg-primary/20 bottom-8 left-[20%] rounded-t-md' },
      { type: 'rect', className: 'w-12 h-32 bg-primary/30 bottom-8 left-[35%] rounded-t-md' },
      { type: 'rect', className: 'w-12 h-24 bg-primary/25 bottom-8 left-[50%] rounded-t-md' },
      { type: 'rect', className: 'w-12 h-40 bg-primary/35 bottom-8 left-[65%] rounded-t-md' },
      { type: 'rect', className: 'w-12 h-16 bg-primary/15 bottom-8 left-[80%] rounded-t-md' },
      { type: 'circle', className: 'w-6 h-6 bg-accent/30 top-12 right-16' },
    ],
  },
  engagement: {
    shapes: [
      { type: 'circle', className: 'w-40 h-40 border-4 border-accent/30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { type: 'circle', className: 'w-28 h-28 border-4 border-accent/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { type: 'circle', className: 'w-16 h-16 bg-accent/25 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { type: 'rect', className: 'w-1 h-16 bg-accent/20 top-4 left-1/2 origin-bottom rotate-45' },
    ],
  },
  points: {
    shapes: [
      { type: 'star', className: 'text-amber-400/40 top-8 right-12 w-12 h-12' },
      { type: 'star', className: 'text-amber-500/30 top-20 left-16 w-8 h-8' },
      { type: 'star', className: 'text-amber-400/20 bottom-16 right-1/3 w-10 h-10' },
      { type: 'rect', className: 'w-48 h-3 bg-amber-400/20 top-1/2 left-1/4 rounded-full' },
      { type: 'rect', className: 'w-32 h-3 bg-amber-500/30 top-1/2 left-1/4 translate-y-4 rounded-full' },
    ],
  },
  rewards: {
    shapes: [
      { type: 'rect', className: 'w-20 h-24 bg-pink-500/15 rounded-lg top-8 left-[20%]' },
      { type: 'rect', className: 'w-20 h-24 bg-rose-500/15 rounded-lg top-8 left-[45%]' },
      { type: 'rect', className: 'w-20 h-24 bg-pink-400/15 rounded-lg top-8 left-[70%]' },
      { type: 'circle', className: 'w-6 h-6 bg-pink-500/30 bottom-12 left-1/3' },
    ],
  },
  classroom: {
    shapes: [
      { type: 'rect', className: 'w-16 h-16 bg-indigo-500/15 rounded-lg top-6 left-[15%]' },
      { type: 'rect', className: 'w-16 h-16 bg-indigo-400/15 rounded-lg top-6 left-[38%]' },
      { type: 'rect', className: 'w-16 h-16 bg-indigo-500/10 rounded-lg top-6 left-[61%]' },
      { type: 'rect', className: 'w-16 h-16 bg-indigo-400/10 rounded-lg top-6 left-[84%]' },
      { type: 'rect', className: 'w-16 h-16 bg-violet-400/15 rounded-lg top-28 left-[15%]' },
      { type: 'rect', className: 'w-16 h-16 bg-violet-500/15 rounded-lg top-28 left-[38%]' },
    ],
  },
  game: {
    shapes: [
      { type: 'circle', className: 'w-24 h-24 bg-violet-500/15 top-8 left-1/4' },
      { type: 'circle', className: 'w-16 h-16 bg-purple-500/20 top-12 right-1/4' },
      { type: 'circle', className: 'w-20 h-20 bg-violet-400/15 bottom-8 left-1/3' },
      { type: 'rect', className: 'w-1 h-full bg-violet-500/10 left-1/2' },
    ],
  },
  comms: {
    shapes: [
      { type: 'rect', className: 'w-40 h-10 bg-cyan-500/15 rounded-2xl rounded-bl-none top-8 left-8' },
      { type: 'rect', className: 'w-32 h-10 bg-sky-500/15 rounded-2xl rounded-br-none top-24 right-8' },
      { type: 'rect', className: 'w-36 h-10 bg-cyan-400/15 rounded-2xl rounded-bl-none top-40 left-12' },
      { type: 'circle', className: 'w-4 h-4 bg-cyan-500/30 bottom-12 left-16' },
      { type: 'circle', className: 'w-4 h-4 bg-cyan-500/25 bottom-12 left-24' },
      { type: 'circle', className: 'w-4 h-4 bg-cyan-500/20 bottom-12 left-32' },
    ],
  },
  safety: {
    shapes: [
      { type: 'circle', className: 'w-48 h-48 border-8 border-destructive/15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { type: 'circle', className: 'w-32 h-32 border-4 border-destructive/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
      { type: 'circle', className: 'w-16 h-16 bg-destructive/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
    ],
  },
  ready: {
    shapes: [
      { type: 'circle', className: 'w-24 h-24 bg-primary/10 top-4 right-8' },
      { type: 'circle', className: 'w-16 h-16 bg-accent/15 bottom-8 left-12' },
      { type: 'rect', className: 'w-2 h-12 bg-primary/20 top-8 left-1/3 rounded-full rotate-12' },
      { type: 'rect', className: 'w-2 h-16 bg-accent/20 top-6 left-[40%] rounded-full -rotate-12' },
      { type: 'rect', className: 'w-2 h-10 bg-primary/15 top-10 left-[47%] rounded-full rotate-6' },
    ],
  },
};

const StarShape = ({ className }: { className: string }) => (
  <div className={`absolute ${className}`}>
    <Star className="w-full h-full fill-current" />
  </div>
);

const FeatureTour = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (isAnimating || index === current) return;
      setDirection(index > current ? 'right' : 'left');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrent(index);
        setIsAnimating(false);
      }, 300);
    },
    [current, isAnimating]
  );

  const next = useCallback(() => {
    if (current < slides.length - 1) goTo(current + 1);
  }, [current, goTo]);

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev]);

  const slide = slides[current];
  const Icon = slide.icon;
  const visual = visualElements[slide.visual];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight font-heading flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Feature Tour
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            See what Beacon can do for your classroom
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {current + 1} / {slides.length}
        </Badge>
      </div>

      {/* Slide */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
        <div
          className={`transition-all duration-300 ease-out ${
            isAnimating
              ? direction === 'right'
                ? 'opacity-0 -translate-x-4'
                : 'opacity-0 translate-x-4'
              : 'opacity-100 translate-x-0'
          }`}
        >
          {/* Visual area */}
          <div className={`relative h-48 sm:h-56 bg-gradient-to-br ${slide.gradient} overflow-hidden`}>
            {visual?.shapes.map((shape, i) =>
              shape.type === 'star' ? (
                <StarShape key={i} className={shape.className} />
              ) : (
                <div
                  key={i}
                  className={`absolute ${shape.type === 'circle' ? 'rounded-full' : ''} ${shape.className}`}
                />
              )
            )}
            {/* Central icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-card/80 backdrop-blur-sm shadow-lg flex items-center justify-center border border-border/30">
                <Icon className="h-10 w-10 text-primary" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8 space-y-3">
            <Badge variant="secondary" className="text-xs font-medium">
              {slide.badge}
            </Badge>
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {slide.title}
            </h3>
            <p className="text-base font-medium text-primary">
              {slide.subtitle}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {slide.description}
            </p>
          </div>
        </div>

        {/* Nav arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm shadow border border-border/30 hover:bg-card disabled:opacity-30"
          onClick={prev}
          disabled={current === 0 || isAnimating}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm shadow border border-border/30 hover:bg-card disabled:opacity-30"
          onClick={next}
          disabled={current === slides.length - 1 || isAnimating}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current
                ? 'w-8 bg-primary'
                : 'w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40'
            }`}
          />
        ))}
      </div>

      {/* Quick jump */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {slides.map((s, i) => {
          const SIcon = s.icon;
          return (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i === current
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <SIcon className="h-3.5 w-3.5" />
              {s.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FeatureTour;
