import type { TranslationKey } from '@/i18n/fr';
import type { TutorialScreen } from '../tutorialScreens';
import type {
  TutorialAdvance,
  TutorialEvent,
  TutorialMissionId,
  TutorialStateV3,
} from '../tutorialTypes';
export interface TutorialMissionStep {
  id: string;
  /**
   * L'écran qui porte l'ancre `targetId`. C'est lui qui décide de la
   * navigation, et non plus le `routePrefix` de la mission : celui-ci répond à
   * « de quel onglet cette mission parle-t-elle », pas à « où est le bouton ».
   */
  screen: TutorialScreen;
  /**
   * `wait` pour une étape qu'on n'a pas le droit d'atteindre à la place de
   * l'utilisateur : le bilan s'ouvre parce qu'il a fini sa séance, et les
   * Réglages ne sont pas un endroit où le jeter à la seconde où il vient
   * d'enregistrer sa première séance. Le coach attend alors qu'il y arrive.
   */
  reach: 'navigate' | 'wait';
  /**
   * L'ancre encadrée, ou `null` quand l'étape parle de l'écran entier.
   *
   * Une étape sans cible n'attend rien pour parler : c'est le seul cas, et il
   * est explicite. Toutes les autres se taisent tant que leur commande n'est
   * pas là.
   */
  targetId: string | null;
  instructionKey: TranslationKey;
  detailKey: TranslationKey;
  /**
   * Le clip enregistré, quand il existe.
   *
   * Absent pour les consignes écrites dans ce chantier : leur texte se relit et
   * se corrige à l'écran, l'enregistrer coûte une génération payante, et la
   * phase voix vient après validation des textes en navigateur. Le panneau
   * porte alors la consigne en entier — c'est déjà ce qui se passe en Silence.
   */
  clipId?: string;
  advance: TutorialAdvance;
  /** Ce que l'étape retient de l'événement qui l'a fait passer. */
  remember?: (state: TutorialStateV3, event: TutorialEvent) => TutorialStateV3;
}

export interface TutorialMission {
  id: TutorialMissionId;
  /** La zone de l'application dont la mission parle — pour l'aide de la page. */
  routePrefix:
    | '/routines'
    | '/workout'
    | '/settings'
    | '/programs'
    | '/history'
    | '/analytics'
    | '/exercises'
    | '/knowledge'
    | '/';
  titleKey: TranslationKey;
  guard:
    | 'always'
    | 'requires-active-workout'
    | 'requires-no-active-workout'
    | 'requires-history'
    | 'requires-effort-prompt'
    | 'requires-rep-pacing'
    | 'external';
  steps: readonly TutorialMissionStep[];
  nextMissionId: TutorialMissionId | null;
  /** L'état de campagne que la dernière étape laisse derrière elle. */
  completes?: (state: TutorialStateV3) => TutorialStateV3;
}

/**
 * Ce que l'application sait de la base, au moment de proposer une mission.
 *
 * `null` veut dire « pas encore lu » et non « non » : une mission n'est ni
 * proposée ni refusée sur une lecture en cours, sinon l'aide clignote au
 * chargement de chaque écran.
 */
export interface TutorialMissionFacts {
  hasActiveWorkout: boolean | null;
  /** Au moins une séance terminée — sans quoi l'historique est vide. */
  hasHistory: boolean | null;
  /**
   * La bande d'effort apparaît-elle après une série validée ?
   *
   * Un réglage, pas une donnée : `fittrack:effortPrompt`. Éteint, la bande
   * n'est jamais rendue, et une mission qui demande d'y répondre désignerait
   * une commande absente de la page — pas dans certains cas, jamais.
   */
  hasEffortPrompt: boolean | null;
  /**
   * Le métronome de répétitions a-t-il le droit de tourner ?
   *
   * Faux en « Voix uniquement », où il n'existe pas du tout — cf.
   * `guidancePolicy`. La mission qui apprend à le lancer ne se propose donc pas
   * dans ce mode : elle attendrait un départ que le moteur refuse.
   */
  hasRepPacing: boolean | null;
}

/** Une étape que seul un geste métier fait avancer — le cas courant. */
export const onEvent = (
  accepts: (event: TutorialEvent, state: TutorialStateV3) => boolean,
): TutorialAdvance => ({
  kind: 'event',
  accepts,
});

/** Une étape qui n'a rien à faire faire : elle montre, et attend « Continuer ». */
export const MANUAL: TutorialAdvance = { kind: 'manual' };

export const eventIs =
  <T extends TutorialEvent['type']>(type: T) =>
  (event: TutorialEvent): boolean =>
    event.type === type;

export const positiveRest = (event: TutorialEvent): boolean =>
  event.type === 'routine-rest-updated' && event.seconds > 0;

export const recordableSet = (event: TutorialEvent): boolean =>
  event.type === 'workout-set-written' && event.recordable;

export function isMissionAvailable(mission: TutorialMission, facts: TutorialMissionFacts): boolean {
  if (mission.guard === 'requires-active-workout') return facts.hasActiveWorkout === true;
  if (mission.guard === 'requires-no-active-workout') return facts.hasActiveWorkout === false;
  if (mission.guard === 'requires-history') return facts.hasHistory === true;
  if (mission.guard === 'requires-effort-prompt') {
    return facts.hasActiveWorkout === true && facts.hasEffortPrompt === true;
  }
  if (mission.guard === 'requires-rep-pacing') {
    return facts.hasActiveWorkout === true && facts.hasRepPacing === true;
  }
  return mission.guard === 'always';
}
