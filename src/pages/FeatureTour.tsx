import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  Zap,
  Camera,
  BookOpen,
  Gamepad2,
  LogIn,
  Play,
  Pause,
  Heart,
  Clock,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

// Tour images
import heroWelcome from '@/assets/tour/hero-welcome.jpg';
import classroomView from '@/assets/tour/classroom-view.jpg';
import dataCollection from '@/assets/tour/data-collection.jpg';
import beaconPoints from '@/assets/tour/beacon-points.jpg';
import rewardStore from '@/assets/tour/reward-store.jpg';
import engagementProbes from '@/assets/tour/engagement-probes.jpg';
import gameBoard from '@/assets/tour/game-board.jpg';
import communication from '@/assets/tour/communication.jpg';
import maydayAlert from '@/assets/tour/mayday-alert.jpg';

const slides = [
  {
    icon: BookOpen,
    badge: 'Welcome',
    title: 'Welcome to Beacon',
    subtitle: 'Built by educators, for educators',
    description: 'Beacon connects teachers, BCBAs, and families with real-time data collection, reinforcement systems, and communication tools — all designed to fit seamlessly into your school day.',
    visual: 'welcome',
    gradient: 'from-primary/20 via-accent/10 to-primary/5',
    image: heroWelcome,
    teacherTip: 'No training manual needed — if you can tap a phone, you can use Beacon.',
    teacherTipIcon: Heart,
  },
  {
    icon: BarChart3,
    badge: 'Data Collection',
    title: 'Tap. Track. Done.',
    subtitle: 'Frequency, duration, and ABC logging in seconds',
    description: 'Quick Add lets you record behaviors with a single tap. Track frequency counts, start/stop duration timers, and log detailed ABC data — all saved instantly for BCBA review.',
    visual: 'data',
    gradient: 'from-primary/15 via-blue-500/10 to-primary/5',
    image: dataCollection,
    teacherTip: 'No clipboards, no paper forms. One tap while you keep teaching.',
    teacherTipIcon: Clock,
  },
  {
    icon: Target,
    badge: 'Engagement & Probes',
    title: 'Measure What Matters',
    subtitle: 'Engagement sampling & skill probes on autopilot',
    description: 'Set interval prompts to track on-task behavior. Run quick skill probes during instruction. Every data point feeds trend charts and weekly summaries automatically.',
    visual: 'engagement',
    gradient: 'from-accent/20 via-emerald-500/10 to-accent/5',
    image: engagementProbes,
    teacherTip: 'Prompts pop up on your schedule — just tap Yes or No and keep going.',
    teacherTipIcon: CheckCircle2,
  },
  {
    icon: Star,
    badge: 'Beacon Points',
    title: 'Points That Motivate',
    subtitle: 'Award, override, and reset — all in real time',
    description: 'Beacon Points auto-award for engagement and probes. Manually award or apply response cost with one tap. Token boards visualize progress. Reset per student or whole class.',
    visual: 'points',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-amber-500/5',
    image: beaconPoints,
    teacherTip: 'Points auto-award when you log data — less work for you, more motivation for students.',
    teacherTipIcon: Star,
  },
  {
    icon: Gift,
    badge: 'Reward Store',
    title: 'Earn & Redeem',
    subtitle: 'A store students love, managed by you',
    description: 'Create tangible, activity, social, or edible rewards with point costs. Students redeem from the store, stock limits prevent over-use, and sponsored rewards appear alongside yours.',
    visual: 'rewards',
    gradient: 'from-pink-500/20 via-rose-500/10 to-pink-500/5',
    image: rewardStore,
    teacherTip: 'Set it up once — students manage their own redemptions with your approval.',
    teacherTipIcon: Gift,
  },
  {
    icon: Users,
    badge: 'Classroom View',
    title: 'Your Classroom at a Glance',
    subtitle: 'Attendance, presence, points, and staff — one screen',
    description: 'See who\'s here, where students are, who\'s paired with staff, and live point balances. Update attendance and presence in real time. Everything your team needs, instantly.',
    visual: 'classroom',
    gradient: 'from-indigo-500/20 via-violet-500/10 to-indigo-500/5',
    image: classroomView,
    teacherTip: 'Morning attendance takes 30 seconds. Staff assignments update in real time.',
    teacherTipIcon: Users,
  },
  {
    icon: Gamepad2,
    badge: 'Game Board',
    title: 'Gamify the Day',
    subtitle: 'Avatars, leaderboards, and class goals',
    description: 'Students pick avatars and unlock new ones with points. The classroom game board shows live standings, class-wide goals, and the word of the week — displayed on any screen.',
    visual: 'game',
    gradient: 'from-violet-500/20 via-purple-500/10 to-violet-500/5',
    image: gameBoard,
    teacherTip: 'Project it on your smartboard — students stay engaged all day watching their progress.',
    teacherTipIcon: Gamepad2,
  },
  {
    icon: MessageCircle,
    badge: 'Communication',
    title: 'Stay Connected',
    subtitle: 'Threads, inbox, and parent snapshots',
    description: 'Create public or private threads for your team. Send formal messages through the inbox. Generate secure parent snapshot links with daily highlights — no login required.',
    visual: 'comms',
    gradient: 'from-cyan-500/20 via-sky-500/10 to-cyan-500/5',
    image: communication,
    teacherTip: 'Share a parent snapshot link via text — families see highlights without downloading anything.',
    teacherTipIcon: Camera,
  },
  {
    icon: Shield,
    badge: 'Safety',
    title: 'Mayday When It Matters',
    subtitle: 'Emergency alerts to your entire team, instantly',
    description: 'The MAYDAY button sends urgency-leveled alerts to admins and supervisors. Select recipients, add notes, and trigger immediate in-app notifications across your team.',
    visual: 'safety',
    gradient: 'from-destructive/20 via-red-500/10 to-destructive/5',
    image: maydayAlert,
    teacherTip: 'One button press and your whole support team knows exactly what\'s happening.',
    teacherTipIcon: Shield,
  },
  {
    icon: Zap,
    badge: 'Get Started',
    title: 'You\'re Ready',
    subtitle: 'Start collecting data and reinforcing great behavior',
    description: 'Head to your Classroom page to see your students. Open the Teacher Guide anytime for step-by-step instructions. Every data point helps your BCBA make better decisions.',
    visual: 'ready',
    gradient: 'from-primary/20 via-accent/10 to-primary/5',
    image: heroWelcome,
    teacherTip: 'Your BCBA handles the analysis — you just keep being an amazing teacher.',
    teacherTipIcon: Heart,
  },
];

const StarShape = ({ className }: { className: string }) => (
  <div className={`absolute ${className}`}>
    <Star className="w-full h-full fill-current" />
  </div>
);

const visualElements: Record<string, { shapes: Array<{ type: string; className: string }> }> = {
  welcome: { shapes: [
    { type: 'circle', className: 'w-32 h-32 bg-primary/10 top-8 right-8' },
    { type: 'circle', className: 'w-20 h-20 bg-accent/15 bottom-12 left-12' },
  ]},
  data: { shapes: [
    { type: 'rect', className: 'w-12 h-20 bg-primary/15 bottom-8 left-[20%] rounded-t-md' },
    { type: 'rect', className: 'w-12 h-32 bg-primary/20 bottom-8 left-[35%] rounded-t-md' },
    { type: 'rect', className: 'w-12 h-24 bg-primary/18 bottom-8 left-[50%] rounded-t-md' },
  ]},
  engagement: { shapes: [
    { type: 'circle', className: 'w-40 h-40 border-4 border-accent/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  ]},
  points: { shapes: [
    { type: 'star', className: 'text-amber-400/30 top-8 right-12 w-12 h-12' },
    { type: 'star', className: 'text-amber-500/20 bottom-16 left-16 w-8 h-8' },
  ]},
  rewards: { shapes: [
    { type: 'rect', className: 'w-20 h-24 bg-pink-500/10 rounded-lg top-8 left-[20%]' },
    { type: 'rect', className: 'w-20 h-24 bg-rose-500/10 rounded-lg top-8 left-[50%]' },
  ]},
  classroom: { shapes: [
    { type: 'rect', className: 'w-16 h-16 bg-indigo-500/10 rounded-lg top-6 left-[15%]' },
    { type: 'rect', className: 'w-16 h-16 bg-indigo-400/10 rounded-lg top-6 left-[40%]' },
  ]},
  game: { shapes: [
    { type: 'circle', className: 'w-24 h-24 bg-violet-500/10 top-8 left-1/4' },
  ]},
  comms: { shapes: [
    { type: 'rect', className: 'w-40 h-10 bg-cyan-500/10 rounded-2xl rounded-bl-none top-8 left-8' },
    { type: 'rect', className: 'w-32 h-10 bg-sky-500/10 rounded-2xl rounded-br-none top-24 right-8' },
  ]},
  safety: { shapes: [
    { type: 'circle', className: 'w-48 h-48 border-8 border-destructive/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  ]},
  ready: { shapes: [
    { type: 'circle', className: 'w-24 h-24 bg-primary/10 top-4 right-8' },
    { type: 'circle', className: 'w-16 h-16 bg-accent/15 bottom-8 left-12' },
  ]},
};

const FeatureTour = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const autoPlayRef = useRef(autoPlay);
  const navigate = useNavigate();

  autoPlayRef.current = autoPlay;

  const goTo = useCallback(
    (index: number) => {
      if (isAnimating || index === current) return;
      setDirection(index > current ? 'right' : 'left');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrent(index);
        setIsAnimating(false);
      }, 350);
    },
    [current, isAnimating]
  );

  const next = useCallback(() => {
    const nextIndex = current < slides.length - 1 ? current + 1 : 0;
    goTo(nextIndex);
  }, [current, goTo]);

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      if (autoPlayRef.current) {
        setCurrent((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { setAutoPlay(false); next(); }
      if (e.key === 'ArrowLeft') { setAutoPlay(false); prev(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev]);

  const slide = slides[current];
  const Icon = slide.icon;
  const TipIcon = slide.teacherTipIcon;
  const visual = visualElements[slide.visual];

  // Progress bar width
  const progress = ((current + 1) / slides.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Top bar with login */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-lg">Beacon</span>
            <Badge variant="secondary" className="text-[10px] ml-1">for Teachers</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoPlay(!autoPlay)}
              className="text-muted-foreground"
            >
              {autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline text-xs">
                {autoPlay ? 'Pause' : 'Play'}
              </span>
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/login')}
              className="gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            See What Beacon Can Do
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            A quick tour of every tool designed to save you time, keep students engaged, and make data collection effortless.
          </p>
        </div>

        {/* Main slide */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
          <div
            className={`transition-all duration-350 ease-out ${
              isAnimating
                ? direction === 'right'
                  ? 'opacity-0 -translate-x-6 scale-[0.98]'
                  : 'opacity-0 translate-x-6 scale-[0.98]'
                : 'opacity-100 translate-x-0 scale-100'
            }`}
          >
            {/* Image area */}
            <div className={`relative overflow-hidden bg-gradient-to-br ${slide.gradient}`}>
              <div className="relative aspect-[16/9] max-h-[400px] overflow-hidden">
                {/* Abstract shapes behind */}
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
                {/* Actual screenshot */}
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover object-top"
                  loading={current === 0 ? 'eager' : 'lazy'}
                  width={1280}
                  height={720}
                />
                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                {/* Floating badge */}
                <div className="absolute top-4 left-4">
                  <Badge className="bg-card/90 backdrop-blur-sm text-foreground border border-border/30 shadow-sm gap-1.5 px-3 py-1">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {slide.badge}
                  </Badge>
                </div>
                {/* Slide counter */}
                <div className="absolute top-4 right-4">
                  <Badge variant="outline" className="bg-card/90 backdrop-blur-sm text-xs border-border/30">
                    {current + 1} / {slides.length}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="space-y-2">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {slide.title}
                </h3>
                <p className="text-base font-semibold text-primary">
                  {slide.subtitle}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {slide.description}
                </p>
              </div>

              {/* Teacher tip callout */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/5 border border-accent/15">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
                  <TipIcon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-0.5">
                    Teacher Tip
                  </p>
                  <p className="text-sm text-foreground/80">
                    {slide.teacherTip}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Nav arrows */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-3 top-[200px] sm:top-[220px] h-10 w-10 rounded-full bg-card/90 backdrop-blur-sm shadow-lg border border-border/30 hover:bg-card disabled:opacity-30 z-10"
            onClick={() => { setAutoPlay(false); prev(); }}
            disabled={current === 0 || isAnimating}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-[200px] sm:top-[220px] h-10 w-10 rounded-full bg-card/90 backdrop-blur-sm shadow-lg border border-border/30 hover:bg-card disabled:opacity-30 z-10"
            onClick={() => { setAutoPlay(false); next(); }}
            disabled={isAnimating}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setAutoPlay(false); goTo(i); }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>

        {/* Quick jump chips */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {slides.map((s, i) => {
            const SIcon = s.icon;
            return (
              <button
                key={i}
                onClick={() => { setAutoPlay(false); goTo(i); }}
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

        {/* Why Teachers Love Beacon section */}
        <div className="pt-4 space-y-4">
          <h2 className="text-xl font-bold text-foreground text-center">
            Why Teachers Love Beacon
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: Clock,
                title: 'Saves Hours Every Week',
                desc: 'No more paper forms, manual tallies, or end-of-day data entry. Everything syncs instantly.',
              },
              {
                icon: Heart,
                title: 'Built for the Classroom',
                desc: 'Large tap targets, one-tap logging, snooze-able prompts — designed for real teaching moments.',
              },
              {
                icon: CheckCircle2,
                title: 'BCBA-Ready Data',
                desc: 'Frequency, duration, ABC, engagement, and probes — all formatted for clinical review automatically.',
              },
            ].map((item) => (
              <Card key={item.title} className="border-border/50 bg-card/50">
                <CardContent className="p-4 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-6 space-y-4">
          <p className="text-muted-foreground text-sm">
            Ready to simplify your classroom?
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              onClick={() => navigate('/login')}
              className="gap-2 px-8"
            >
              <LogIn className="h-5 w-5" />
              Sign In to Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/faq')}
              className="gap-2 px-6"
            >
              <HelpCircle className="h-5 w-5" />
              FAQ & Tutorials
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureTour;
