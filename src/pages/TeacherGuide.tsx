import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Hash, Clock, Target, Zap, Bell, BellOff, HelpCircle, BookOpen } from 'lucide-react';

const sections = [
  {
    icon: Hash,
    title: 'How to Record Behaviors',
    color: 'text-primary',
    content: [
      'Open the **Quick Add** panel at the bottom of any page.',
      'Select the student, then choose a behavior from the dropdown.',
      'Use the **Frequency** tab to tap +1 each time a behavior occurs.',
      'Use the **Duration** tab to start/stop a timer for timed behaviors.',
      'All data is saved directly to the student record for BCBA review.',
      'Quick Add buttons: **Aggression**, **Elopement**, **Property Destruction**, **Major Disruption**, **Noncompliance**.',
    ],
  },
  {
    icon: Bell,
    title: 'Engagement Sampling',
    color: 'text-accent',
    content: [
      'On a student\'s Data tab, toggle **Engagement Sampling** on.',
      'A prompt will appear at your chosen interval (5, 10, or 15 minutes).',
      'The prompt asks: "Is the student engaged in the task right now?"',
      'Tap **Yes** or **No** — your response is instantly recorded.',
      'The engagement percentage is shown in real-time.',
      'Use this data to track on-task behavior trends over time.',
    ],
  },
  {
    icon: Target,
    title: 'Skill Probes',
    color: 'text-primary',
    content: [
      'On a student\'s Data tab, find the **Skill Probe** card.',
      'Enter the skill name (e.g. "Identify colors") and tap **Start Probe**.',
      'For each trial, tap **+** (correct) or **−** (incorrect).',
      'The live percentage updates after every trial.',
      'Tap **End** when done — the session summary is saved automatically.',
      'Run short probes during natural instruction breaks.',
    ],
  },
  {
    icon: Zap,
    title: 'When to Use ABC Logging',
    color: 'text-destructive',
    content: [
      'Use the **Trigger Tracker** page for detailed ABC (Antecedent-Behavior-Consequence) logging.',
      'Use **Quick Log** for rapid, one-tap entries during instruction.',
      'Toggle **Detailed Log** for additional fields (notes, duration, staff initials).',
      'ABC data helps BCBAs identify behavior patterns and develop intervention plans.',
      'Log as close to the event as possible for best accuracy.',
    ],
  },
  {
    icon: BellOff,
    title: 'When to Snooze Prompts',
    color: 'text-muted-foreground',
    content: [
      'During non-instructional time (lunch, recess, specials), snooze engagement prompts.',
      'Choose **5 min** or **10 min** snooze from the prompt banner.',
      'You can also toggle sampling off entirely during breaks.',
      'Snooze events are recorded so BCBAs know when data was paused.',
      'Resume sampling when instruction begins again.',
    ],
  },
  {
    icon: HelpCircle,
    title: 'Teacher FAQ',
    color: 'text-primary',
    content: [
      '**Q: What happens if I lose internet?** — Data is queued locally and syncs when you reconnect.',
      '**Q: Can I delete a log?** — Yes, on the student Data tab, hover over any session or ABC log to delete.',
      '**Q: Who sees my data?** — Your assigned BCBA and supervisors with access to the student.',
      '**Q: How often should I log?** — Log behaviors as they occur. Engagement prompts run on a timer.',
      '**Q: What is the Weekly Summary?** — An automated report of all data collected that week, sent to your BCBA.',
    ],
  },
];

const TeacherGuide = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-semibold tracking-tight font-heading flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary" />
        Data Collection Guide
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Everything you need to know about collecting data in Beacon
      </p>
    </div>

    <div className="grid gap-4">
      {sections.map((section) => (
        <Card key={section.title} className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <section.icon className={`h-5 w-5 ${section.color}`} />
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {section.content.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <Badge variant="outline" className="text-[9px] mt-0.5 shrink-0 h-4 w-4 justify-center p-0">
                    {i + 1}
                  </Badge>
                  <span dangerouslySetInnerHTML={{
                    __html: item.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>'),
                  }} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-4">
        <p className="text-sm text-foreground font-medium">💡 Remember</p>
        <p className="text-sm text-muted-foreground mt-1">
          Teachers tap behaviors when they occur, answer engagement prompts when possible, and run short skill probes during instruction. Every data point helps your BCBA make better decisions for the student.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default TeacherGuide;
