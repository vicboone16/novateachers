import type { WalkthroughFlow } from '@/contexts/WalkthroughContext';

/* ═══════════════════════════════════════════════════════════ */
/*  PRE-BUILT WALKTHROUGH FLOWS                               */
/* ═══════════════════════════════════════════════════════════ */

export const WALKTHROUGH_FLOWS: WalkthroughFlow[] = [
  /* ── Mayday ── */
  {
    id: 'send-mayday',
    title: 'Send a Mayday',
    description: 'Request immediate help from your team.',
    icon: 'AlertTriangle',
    steps: [
      {
        selector: '[data-walkthrough="mayday-button"]',
        title: 'Find the Mayday Button',
        description: 'Look for the red MAYDAY button at the bottom of the screen. Tap it to begin.',
        placement: 'top',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="mayday-urgency"]',
        title: 'Select Urgency',
        description: 'Choose the urgency level: Urgent, High, or Standard.',
        placement: 'bottom',
        waitForClick: true,
      },
      {
        selector: '[data-walkthrough="mayday-send"]',
        title: 'Send the Alert',
        description: 'Add an optional message, then tap Send. All your configured contacts will be notified instantly.',
        placement: 'top',
        waitForClick: true,
      },
    ],
  },

  /* ── Points ── */
  {
    id: 'add-points',
    title: 'Add Points to a Student',
    description: 'Award Beacon Points for positive behavior.',
    icon: 'Star',
    steps: [
      {
        selector: '[data-walkthrough="student-card"]',
        title: 'Select a Student',
        description: 'Tap any student card in the Classroom View to open their quick actions.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="points-add"]',
        title: 'Award Points',
        description: 'Tap the + button to add points. Choose a point amount or use the default value.',
        placement: 'left',
        waitForClick: true,
      },
      {
        selector: '[data-walkthrough="points-confirm"]',
        title: 'Done!',
        description: 'Points are recorded instantly and appear on the Game Board. Great job reinforcing positive behavior!',
        placement: 'top',
      },
    ],
  },

  /* ── Classroom creation ── */
  {
    id: 'create-classroom',
    title: 'Create a Classroom',
    description: 'Set up your first classroom group.',
    icon: 'LayoutDashboard',
    steps: [
      {
        selector: '[data-walkthrough="more-menu"]',
        title: 'Open the More Menu',
        description: 'Tap the "More" dropdown in the navigation bar.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="nav-classrooms"]',
        title: 'Go to Classroom Manager',
        description: 'Select "Classrooms" from the dropdown to open the Classroom Manager.',
        placement: 'right',
        waitForClick: true,
      },
      {
        selector: '[data-walkthrough="create-classroom"]',
        title: 'Create a New Classroom',
        description: 'Tap "Create Classroom" and enter a name, school, and grade band.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classrooms',
      },
    ],
  },

  /* ── Staff messaging ── */
  {
    id: 'send-message',
    title: 'Send a Staff Message',
    description: 'Message your team through Threads.',
    icon: 'MessageCircle',
    steps: [
      {
        selector: '[data-walkthrough="nav-threads"]',
        title: 'Open Threads',
        description: 'Tap the "Threads" tab in the navigation bar.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="thread-compose"]',
        title: 'Select or Create a Thread',
        description: 'Pick an existing thread or tap "New Thread" to start a conversation.',
        placement: 'bottom',
        waitForClick: true,
        route: '/threads',
      },
      {
        selector: '[data-walkthrough="thread-send"]',
        title: 'Send Your Message',
        description: 'Type your message and tap Send. It\'s delivered instantly to all thread members.',
        placement: 'top',
        waitForClick: true,
      },
    ],
  },

  /* ── Parent snapshot ── */
  {
    id: 'message-parent',
    title: 'Share a Parent Snapshot',
    description: 'Send a daily highlight summary to a parent.',
    icon: 'Heart',
    steps: [
      {
        selector: '[data-walkthrough="student-card"]',
        title: 'Select a Student',
        description: 'Tap a student card to open their detail view.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="parent-snapshot"]',
        title: 'Open Parent Snapshot',
        description: 'Tap the "Parent Snapshot" button to generate a secure sharing link.',
        placement: 'bottom',
        waitForClick: true,
      },
      {
        selector: '[data-walkthrough="snapshot-share"]',
        title: 'Share the Link',
        description: 'Copy the link and send it to the parent via text or email. No login required!',
        placement: 'top',
      },
    ],
  },

  /* ── Reward Store ── */
  {
    id: 'use-rewards',
    title: 'Use the Reward Store',
    description: 'Set up rewards students can earn and redeem.',
    icon: 'Gift',
    steps: [
      {
        selector: '[data-walkthrough="nav-rewards"]',
        title: 'Open the Rewards Tab',
        description: 'Tap "Rewards" in the navigation bar.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="rewards-list"]',
        title: 'Browse Available Rewards',
        description: 'This is the Reward Store. Students browse here to pick what they want to earn.',
        placement: 'top',
        route: '/rewards',
      },
      {
        selector: '[data-walkthrough="add-reward"]',
        title: 'Add a Reward',
        description: 'Tap "+ Add Reward" to create a new item. Set a name, point cost, and category.',
        placement: 'left',
        waitForClick: true,
      },
    ],
  },

  /* ── Game Board ── */
  {
    id: 'use-game-board',
    title: 'Use the Game Board',
    description: 'Project a live race to motivate your class.',
    icon: 'Gamepad2',
    steps: [
      {
        selector: '[data-walkthrough="nav-game"]',
        title: 'Open the Game Board',
        description: 'Tap "Game" in the navigation bar to open the live race view.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="game-race"]',
        title: 'Watch the Race',
        description: 'Each student\'s avatar moves forward as they earn points. Great for smartboard projection!',
        placement: 'top',
        route: '/game-board',
      },
      {
        selector: '[data-walkthrough="game-standings"]',
        title: 'Check Standings',
        description: 'The standings panel shows who\'s leading and who might need encouragement.',
        placement: 'left',
      },
    ],
  },

  /* ── Who's Here ── */
  {
    id: 'whos-here',
    title: "Use Who's Here",
    description: 'See which staff are available to help right now.',
    icon: 'Users',
    steps: [
      {
        selector: '[data-walkthrough="nav-threads"]',
        title: 'Open Threads',
        description: "Who's Here lives at the top of the Threads page. Tap Threads to get there.",
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="whos-here-panel"]',
        title: 'See Staff Availability',
        description: 'Green = available, Yellow = nearby, Blue = assigned, Red = busy, Gray = offline.',
        placement: 'bottom',
        route: '/threads',
      },
      {
        selector: '[data-walkthrough="staff-chip"]',
        title: 'Tap a Staff Chip',
        description: 'Tap any staff member to message them or request help.',
        placement: 'top',
        waitForClick: true,
      },
    ],
  },

  /* ── Classroom setup (orientation) ── */
  {
    id: 'classroom-orientation',
    title: 'Classroom Page Tour',
    description: 'Learn where everything is on your main screen.',
    icon: 'LayoutDashboard',
    steps: [
      {
        selector: '[data-walkthrough="classroom-header"]',
        title: 'Classroom Header',
        description: 'Shows your classroom name, mission text, and word of the week.',
        placement: 'bottom',
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="student-grid"]',
        title: 'Student Cards',
        description: 'Each card shows attendance, presence, points, and quick action buttons.',
        placement: 'top',
      },
      {
        selector: '[data-walkthrough="mayday-button"]',
        title: 'Mayday Button',
        description: 'Your emergency help button. Always accessible from this screen.',
        placement: 'top',
      },
    ],
  },

  /* ── Data collection ── */
  {
    id: 'collect-data',
    title: 'Collect Behavior Data',
    description: 'Log frequency, duration, and ABC data.',
    icon: 'BarChart3',
    steps: [
      {
        selector: '[data-walkthrough="student-card"]',
        title: 'Select a Student',
        description: 'Tap a student card to open quick actions and data tools.',
        placement: 'bottom',
        waitForClick: true,
        route: '/classroom',
      },
      {
        selector: '[data-walkthrough="quick-add"]',
        title: 'Use Quick Add',
        description: 'Tap a behavior button to log one occurrence instantly. Each tap = one data point.',
        placement: 'left',
        waitForClick: true,
      },
      {
        selector: '[data-walkthrough="data-summary"]',
        title: 'Review Your Data',
        description: 'Check the data summary to see trends and ensure nothing was missed.',
        placement: 'top',
      },
    ],
  },
];
