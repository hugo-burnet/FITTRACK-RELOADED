import type { TranslationKey } from '@/i18n/fr';

export type TutorialTopic =
  | 'home'
  | 'routines'
  | 'programs'
  | 'workout'
  | 'coach'
  | 'history'
  | 'analytics'
  | 'exercises'
  | 'settings';

/**
 * Ce que le chapitre encadre, quand il y a quelque chose à encadrer.
 *
 * La visite ne savait viser que l'en-tête ou la zone de contenu. Sur 375 × 812,
 * ce contenu mesure 375 × 671 : le cadre couvrait 83 % de l'écran et le panneau
 * du tutoriel se posait par-dessus. Un cadre qui entoure tout n'entoure rien,
 * et c'est le décalage remonté du téléphone.
 *
 * `nav` désigne un onglet de la barre du bas — l'ancre `data-tutorial-nav`
 * existait déjà et ne servait à personne. `anchor` réutilise le vocabulaire des
 * missions, `data-tutorial-id`, plutôt que d'en inventer un troisième. `null`
 * quand le chapitre parle de l'écran entier : on assombrit, on n'encadre pas.
 */
export type TutorialSpotlight = { kind: 'nav'; to: string } | { kind: 'anchor'; id: string };

export interface TutorialStep {
  id: string;
  topic: TutorialTopic;
  clip: string;
  /** One glance while the voice carries the full explanation. */
  summaryKey: TranslationKey;
  route?: string;
  spotlight: TutorialSpotlight | null;
  /**
   * Un chapitre dont l'écran ne peut pas être ouvert : la séance en direct et
   * son bilan n'existent pas tant qu'aucune séance ne tourne, et la visite se
   * fait avant la première. Le panneau le dit alors, au lieu de laisser croire
   * que l'accueil derrière est le sujet.
   */
  offScreen?: true;
}

const STEPS: readonly TutorialStep[] = [
  {
    id: 'intro',
    topic: 'home',
    clip: 'tutorial-intro-1',
    summaryKey: 'tutorial.step.intro',
    route: '/',
    spotlight: null,
  },
  {
    id: 'home',
    topic: 'home',
    clip: 'tutorial-home-1',
    summaryKey: 'tutorial.step.home',
    route: '/',
    spotlight: { kind: 'nav', to: '/' },
  },
  {
    id: 'routines',
    topic: 'routines',
    clip: 'tutorial-routines-1',
    summaryKey: 'tutorial.step.routines',
    route: '/routines',
    spotlight: { kind: 'nav', to: '/routines' },
  },
  /*
   * Les blocs, enfin montrés.
   *
   * Ils n'ont pas d'onglet — on entre par l'accueil — et la visite ne passait
   * donc jamais par leur écran. Le chapitre Routines les annonce depuis
   * toujours dans sa seconde phrase, devant la liste des routines : la voix
   * décrivait un écran que personne n'avait vu. Celui-ci vient juste après et
   * l'ouvre.
   */
  {
    id: 'programs',
    topic: 'programs',
    clip: 'tutorial-programs-1',
    summaryKey: 'tutorial.step.programs',
    route: '/programs',
    spotlight: { kind: 'anchor', id: 'program-create' },
  },
  {
    id: 'workout',
    topic: 'workout',
    clip: 'tutorial-workout-1',
    summaryKey: 'tutorial.step.workout',
    route: '/',
    spotlight: null,
    offScreen: true,
  },
  {
    id: 'coach',
    topic: 'coach',
    clip: 'tutorial-coach-1',
    summaryKey: 'tutorial.step.coach',
    route: '/',
    spotlight: null,
    offScreen: true,
  },
  {
    id: 'history',
    topic: 'history',
    clip: 'tutorial-history-1',
    summaryKey: 'tutorial.step.history',
    route: '/history',
    spotlight: { kind: 'nav', to: '/history' },
  },
  {
    id: 'analytics',
    topic: 'analytics',
    clip: 'tutorial-analytics-1',
    summaryKey: 'tutorial.step.analytics',
    route: '/analytics',
    spotlight: { kind: 'nav', to: '/analytics' },
  },
  {
    id: 'exercises',
    topic: 'exercises',
    clip: 'tutorial-exercises-1',
    summaryKey: 'tutorial.step.exercises',
    route: '/exercises',
    spotlight: { kind: 'nav', to: '/exercises' },
  },
  {
    id: 'settings',
    topic: 'settings',
    clip: 'tutorial-settings-1',
    summaryKey: 'tutorial.step.settings',
    route: '/settings',
    spotlight: null,
  },
];

export const FULL_TUTORIAL: readonly TutorialStep[] = STEPS;

/** Le sélecteur CSS de ce qu'un chapitre encadre, `null` quand il encadre tout. */
export function spotlightSelector(spotlight: TutorialSpotlight | null): string | null {
  if (spotlight === null) return null;
  return spotlight.kind === 'nav'
    ? `[data-tutorial-nav="${spotlight.to}"]`
    : `[data-tutorial-id="${spotlight.id}"]`;
}

/**
 * Le chapitre de cette page — sur sa page.
 *
 * L'aide effaçait la route du chapitre pour « ne pas déplacer l'utilisateur ».
 * Depuis `/routines/:id`, elle expliquait donc Routines devant un éditeur : le
 * chapitre parle de la liste, encadre l'onglet Routines, et rien de ce qu'il
 * décrit n'était à l'écran. Ouvrir la bonne page est le moindre déplacement des
 * deux.
 */
export function contextualTutorial(topic: TutorialTopic): readonly TutorialStep[] {
  const step = STEPS.find((candidate) => candidate.id === topic) ?? STEPS[1]!;
  return [step];
}

export function tutorialTopicForPath(pathname: string): TutorialTopic {
  if (pathname.startsWith('/workout/finish')) return 'coach';
  if (pathname.startsWith('/workout')) return 'workout';
  // Les blocs ont leur propre chapitre depuis qu'ils ont leur propre écran :
  // l'aide de cette page ne renvoie plus vers celui des routines.
  if (pathname.startsWith('/programs')) return 'programs';
  if (pathname.startsWith('/routines')) return 'routines';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/exercises')) return 'exercises';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'home';
}

export const TUTORIAL_TOPIC_LABEL_KEYS: Record<TutorialTopic, TranslationKey> = {
  home: 'tutorial.topic.home',
  routines: 'tutorial.topic.routines',
  programs: 'tutorial.topic.programs',
  workout: 'tutorial.topic.workout',
  coach: 'tutorial.topic.coach',
  history: 'tutorial.topic.history',
  analytics: 'tutorial.topic.analytics',
  exercises: 'tutorial.topic.exercises',
  settings: 'tutorial.topic.settings',
};

export const TUTORIAL_VOICE_CHOICE_CLIP = 'tutorial-voice-choice-1';
