import type { WalkthroughFlow } from '@/contexts/WalkthroughContext';

/* ═══════════════════════════════════════════════════════════ */
/*  PRE-BUILT WALKTHROUGH FLOWS                               */
/* ═══════════════════════════════════════════════════════════ */

export const WALKTHROUGH_FLOWS: WalkthroughFlow[] = [
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
];
