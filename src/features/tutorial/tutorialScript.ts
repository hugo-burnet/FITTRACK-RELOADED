export type TutorialTopic =
  'home' | 'routines' | 'workout' | 'coach' | 'history' | 'analytics' | 'exercises' | 'settings';

export type TutorialTarget = 'header' | 'content';

export interface TutorialStep {
  id: string;
  topic: TutorialTopic;
  clip: string;
  route?: string;
  target: TutorialTarget;
  /** Reading time when the recorded clip is absent. */
  fallbackMs: number;
}

const STEPS: readonly TutorialStep[] = [
  {
    id: 'intro',
    topic: 'home',
    clip: 'tutorial-intro-1',
    route: '/',
    target: 'header',
    fallbackMs: 9_000,
  },
  {
    id: 'home',
    topic: 'home',
    clip: 'tutorial-home-1',
    route: '/',
    target: 'content',
    fallbackMs: 16_000,
  },
  {
    id: 'routines',
    topic: 'routines',
    clip: 'tutorial-routines-1',
    route: '/routines',
    target: 'content',
    fallbackMs: 20_000,
  },
  {
    id: 'workout',
    topic: 'workout',
    clip: 'tutorial-workout-1',
    route: '/',
    target: 'content',
    fallbackMs: 29_000,
  },
  {
    id: 'coach',
    topic: 'coach',
    clip: 'tutorial-coach-1',
    route: '/',
    target: 'content',
    fallbackMs: 18_000,
  },
  {
    id: 'history',
    topic: 'history',
    clip: 'tutorial-history-1',
    route: '/history',
    target: 'content',
    fallbackMs: 15_000,
  },
  {
    id: 'analytics',
    topic: 'analytics',
    clip: 'tutorial-analytics-1',
    route: '/analytics',
    target: 'content',
    fallbackMs: 16_000,
  },
  {
    id: 'exercises',
    topic: 'exercises',
    clip: 'tutorial-exercises-1',
    route: '/exercises',
    target: 'content',
    fallbackMs: 13_000,
  },
  {
    id: 'settings',
    topic: 'settings',
    clip: 'tutorial-settings-1',
    route: '/settings',
    target: 'content',
    fallbackMs: 14_000,
  },
];

export const FULL_TUTORIAL: readonly TutorialStep[] = STEPS;

/** The page help reuses the relevant chapter without taking the user elsewhere. */
export function contextualTutorial(topic: TutorialTopic): readonly TutorialStep[] {
  const step = STEPS.find((candidate) => candidate.id === topic) ?? STEPS[1]!;
  return [{ ...step, route: undefined }];
}

export function tutorialTopicForPath(pathname: string): TutorialTopic {
  if (pathname.startsWith('/workout/finish')) return 'coach';
  if (pathname.startsWith('/workout')) return 'workout';
  if (pathname.startsWith('/programs') || pathname.startsWith('/routines')) return 'routines';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/exercises')) return 'exercises';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'home';
}

export const TUTORIAL_TOPIC_LABELS: Record<TutorialTopic, string> = {
  home: 'Accueil',
  routines: 'Routines et blocs',
  workout: 'Séance',
  coach: 'Coach',
  history: 'Historique',
  analytics: 'Progression',
  exercises: 'Exercices',
  settings: 'Réglages',
};

export const TUTORIAL_VOICE_CHOICE_CLIP = 'tutorial-voice-choice-1';
