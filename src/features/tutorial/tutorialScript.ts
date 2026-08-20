export type TutorialTopic =
  'home' | 'routines' | 'workout' | 'coach' | 'history' | 'analytics' | 'exercises' | 'settings';

export type TutorialTarget = 'header' | 'content';

export interface TutorialStep {
  id: string;
  topic: TutorialTopic;
  clip: string;
  /** One glance while the voice carries the full explanation. */
  summary: string;
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
    summary: 'Un tour rapide des écrans essentiels avant ta première séance.',
    route: '/',
    target: 'header',
    fallbackMs: 9_000,
  },
  {
    id: 'home',
    topic: 'home',
    clip: 'tutorial-home-1',
    summary: 'L’accueil te montre quoi lancer et où tu en es.',
    route: '/',
    target: 'content',
    fallbackMs: 16_000,
  },
  {
    id: 'routines',
    topic: 'routines',
    clip: 'tutorial-routines-1',
    summary: 'Prépare tes séances, puis organise-les en blocs de plusieurs semaines.',
    route: '/routines',
    target: 'content',
    fallbackMs: 20_000,
  },
  {
    id: 'workout',
    topic: 'workout',
    clip: 'tutorial-workout-1',
    summary: 'Renseigne charge et répétitions : la voix cadence, compte et relance.',
    route: '/',
    target: 'content',
    fallbackMs: 29_000,
  },
  {
    id: 'coach',
    topic: 'coach',
    clip: 'tutorial-coach-1',
    summary: 'Le coach résume la séance et explique la prochaine progression.',
    route: '/',
    target: 'content',
    fallbackMs: 18_000,
  },
  {
    id: 'history',
    topic: 'history',
    clip: 'tutorial-history-1',
    summary: 'Chaque séance terminée reste consultable et modifiable.',
    route: '/history',
    target: 'content',
    fallbackMs: 15_000,
  },
  {
    id: 'analytics',
    topic: 'analytics',
    clip: 'tutorial-analytics-1',
    summary: 'Suis tes records, ton volume, ta régularité et tes muscles.',
    route: '/analytics',
    target: 'content',
    fallbackMs: 16_000,
  },
  {
    id: 'exercises',
    topic: 'exercises',
    clip: 'tutorial-exercises-1',
    summary: 'Chaque exercice rassemble son historique et ses performances.',
    route: '/exercises',
    target: 'content',
    fallbackMs: 13_000,
  },
  {
    id: 'settings',
    topic: 'settings',
    clip: 'tutorial-settings-1',
    summary: 'Adapte la voix, les sons et le comportement de FitTrack.',
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
