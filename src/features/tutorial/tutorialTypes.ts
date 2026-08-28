import type { Equipment, MeasurementType, MuscleGroup } from '@/data/types';
import type { PeriodKey } from '@/lib/analytics/periods';

export type TutorialCompletion = 'completed' | 'skipped';

/**
 * Où en est la campagne débutant.
 *
 * `routine-ready` est le seul état qui compte vraiment : la préparation est
 * faite, et le tutoriel **attend** que l'utilisateur démarre lui-même cette
 * routine. Sans lui, la seule façon d'enchaîner sur la séance serait d'en
 * fabriquer une — ce que la spec interdit.
 */
export type TutorialCampaignStatus =
  'not-started' | 'preparing' | 'routine-ready' | 'workout-active' | 'completed' | 'dismissed';

export const TUTORIAL_MISSION_IDS = [
  'TUT-CAM-01',
  'TUT-CAM-02',
  'TUT-REC-01',
  'TUT-ROU-01',
  'TUT-ROU-02',
  'TUT-ROU-03',
  'TUT-ROU-04',
  'TUT-WRK-01',
  'TUT-WRK-02',
  'TUT-WRK-03',
  'TUT-WRK-04',
  'TUT-DAT-01',
  'TUT-DAT-02',
  'TUT-PRG-01',
  'TUT-PRG-02',
  'TUT-PRG-03',
  'TUT-PRG-04',
  'TUT-WRK-05',
  'TUT-WRK-06',
  'TUT-WRK-07',
  'TUT-WRK-08',
  'TUT-WRK-09',
  'TUT-WRK-10',
  'TUT-WRK-11',
  'TUT-WRK-12',
  'TUT-HIS-01',
  'TUT-HIS-02',
  'TUT-HIS-03',
  'TUT-IMP-01',
  'TUT-ANA-01',
  'TUT-ANA-02',
  'TUT-EXE-01',
  'TUT-EXE-02',
  'TUT-KNW-01',
  'TUT-KNW-02',
  'TUT-HOME-01',
  'TUT-SET-01',
  'TUT-SET-02',
] as const;

export type TutorialMissionId = (typeof TUTORIAL_MISSION_IDS)[number];

export type TutorialMissionStatus = 'completed' | 'dismissed';

export interface TutorialStateV3 {
  version: 3;
  scriptVersion: 2;
  orientation: TutorialCompletion | null;
  campaign: TutorialCampaignStatus;
  activeMissionId: TutorialMissionId | null;
  activeStepIndex: number;
  /**
   * La routine créée pendant la campagne — « Séance découverte ».
   *
   * Distincte de `missionRoutineId` : la campagne doit reconnaître **son**
   * `workout-started`, pas n'importe lequel. Une séance lancée sur une autre
   * routine ne reprend pas l'acte 2.
   */
  campaignRoutineId: string | null;
  /**
   * La routine dont les missions de composition parlent — la dernière ouverte.
   *
   * Sans elle, `/routines/:id` n'est pas une adresse : on sait qu'une étape
   * vit dans l'éditeur d'une routine, pas dans lequel, et on ne peut donc ni
   * y renvoyer l'utilisateur ni décider qu'il n'y est pas. Persistée avec le
   * reste : une mission reprise après un rechargement doit retrouver la sienne.
   */
  missionRoutineId: string | null;
  /** Même rôle que `missionRoutineId`, pour `/programs/:id`. */
  missionProgramId: string | null;
  /** Même rôle, pour la séance archivée de `/history/:workoutId`. */
  missionWorkoutId: string | null;
  missions: Partial<Record<TutorialMissionId, TutorialMissionStatus>>;
}

/**
 * Ce qui fait passer à l'étape suivante.
 *
 * `event` est la règle : un geste métier réel, observé là où il a lieu.
 * `manual` est l'exception nécessaire — une étape qui n'a rien à faire faire,
 * seulement quelque chose à montrer. L'ancienne visite enchaînait sur la fin de
 * la voix, ce qui revenait à confier le rythme à l'enregistrement ; il n'y a
 * plus de troisième cas, et surtout plus d'avance sans intention.
 */
export type TutorialAdvance =
  | { kind: 'event'; accepts: (event: TutorialEvent, state: TutorialStateV3) => boolean }
  | { kind: 'manual' };

/**
 * Les gestes de la construction d'un bloc.
 *
 * Les trois étapes de l'assistant vivent toutes sur `/programs/new` et
 * l'identifiant du brouillon n'entre dans l'URL qu'à l'activation : ces
 * événements sont donc le seul moyen de savoir où en est la construction, et
 * lequel des brouillons elle concerne.
 */
export type TutorialProgramEvent =
  | { type: 'program-create-opened' }
  | { type: 'program-basics-named'; name: string }
  | { type: 'program-basics-dated'; startsAt: number }
  | { type: 'program-basics-duration-set'; weeks: number }
  | { type: 'program-draft-created'; programId: string }
  | { type: 'program-split-day-set'; index: number; dayOfWeek: number }
  | { type: 'program-split-routine-set'; index: number; routineId: string }
  | { type: 'program-split-saved'; programId: string; entries: number }
  | { type: 'program-recipe-applied'; recipe: string }
  | { type: 'program-week-opened'; weekIndex: number }
  | { type: 'program-activated'; programId: string }
  | { type: 'program-session-selected'; programId: string; entryId: string }
  | { type: 'program-actions-opened'; programId: string };

/** Les gestes de l'historique : retrouver, corriger, partager, importer. */
export type TutorialHistoryEvent =
  | { type: 'history-view-changed'; view: 'journal' | 'calendar' }
  | { type: 'history-day-selected'; timestamp: number }
  | { type: 'history-exercise-filter-changed'; exerciseId: string | null }
  | { type: 'history-workout-opened'; workoutId: string }
  | { type: 'history-actions-opened'; workoutId: string }
  | { type: 'history-edit-opened'; workoutId: string }
  | { type: 'history-edit-saved'; workoutId: string }
  | { type: 'history-share-opened'; workoutId: string }
  | { type: 'hevy-import-opened' }
  | { type: 'hevy-file-parsed'; workoutCount: number }
  | { type: 'hevy-review-opened'; workoutCount: number };

/**
 * Les gestes de la bibliothèque : trouver un exercice, en fabriquer un.
 *
 * Les trois premiers portent la valeur choisie, et pas seulement le fait
 * d'avoir touché la commande : le champ publie à chaque frappe et « Tous les
 * muscles » est une option comme une autre, donc effacer une recherche ou
 * retirer un filtre émet exactement ce qu'émet le geste inverse. C'est la
 * valeur qui les distingue, jamais le type.
 */
export type TutorialExerciseEvent =
  | { type: 'exercise-query-changed'; query: string }
  | { type: 'exercise-muscle-filter-changed'; muscle: MuscleGroup | null }
  | { type: 'exercise-equipment-filter-changed'; equipment: Equipment | null }
  | { type: 'exercise-create-opened' }
  | { type: 'exercise-named'; name: string }
  | { type: 'exercise-measurement-set'; measurementType: MeasurementType }
  | { type: 'exercise-unilateral-set'; isUnilateral: 0 | 1 }
  | { type: 'exercise-created'; exerciseId: string };

/**
 * Les gestes du corpus embarqué : chercher, lire, remonter aux sources.
 *
 * `results` n'est pas décoratif. Le corpus refuse plutôt que de combler : une
 * question sans correspondance lexicale ne rend aucune carte, et l'étape
 * suivante demande d'ouvrir la première. Sans le compte, elle aurait désigné
 * une commande que l'écran n'avait pas rendue.
 *
 * `article-sources-opened` ne porte rien : le bloc Sources est répété une fois
 * par affirmation dans un article, et ouvrir n'importe lequel est exactement ce
 * que l'étape demande. Il n'y a donc pas d'identité qui la protégerait de
 * quelque chose — seulement un détail qui ne servirait à rien.
 */
export type TutorialKnowledgeEvent =
  | { type: 'knowledge-search-ran'; query: string; results: number }
  | { type: 'knowledge-result-opened'; rank: number }
  | { type: 'learning-path-opened' }
  | { type: 'learning-step-opened'; articleId: string }
  | { type: 'article-sources-opened' };

/** L'analyse dont un événement de la Progression parle. */
export type TutorialAnalyticsView = 'records' | 'weekly' | 'volume' | 'muscles' | 'monthly';

/**
 * Les gestes de la Progression : choisir une analyse, la cadrer, la sortir.
 *
 * Les cinq lignes du hub ouvrent la même sorte d'écran et quatre d'entre eux
 * portent un filtre de période identique. Sans `view`, ouvrir « Volume » aurait
 * validé l'étape qui demande « Séances par semaine », et la mission aurait
 * ensuite attendu une période sur un écran où l'utilisateur n'était pas.
 *
 * `chart` est le slug du fichier produit — « seances », « volume »,
 * « progression ». C'est la seule identité que le bouton d'export connaisse, et
 * elle suffit : les trois écrans qui le montent en passent un différent.
 */
export type TutorialAnalyticsEvent =
  | { type: 'analytics-view-opened'; view: TutorialAnalyticsView }
  | { type: 'analytics-period-changed'; view: TutorialAnalyticsView; period: PeriodKey }
  | { type: 'chart-share-opened'; chart: string };

/**
 * Ce que l'application a réellement fait — jamais ce que le tutoriel espérait.
 *
 * Chaque événement porte l'identité de ce qu'il touche. Sans elle, la campagne
 * avançait sur n'importe quelle routine et n'importe quelle série : ajouter un
 * exercice à une *autre* routine, dans un autre onglet, validait l'étape en
 * cours. Une étape ne peut donc accepter que ce qui concerne **sa** routine,
 * **son** programme ou **sa** séance.
 */
export type TutorialEvent =
  | TutorialProgramEvent
  | TutorialHistoryEvent
  | TutorialExerciseEvent
  | TutorialAnalyticsEvent
  | TutorialKnowledgeEvent
  | { type: 'routine-create-opened' }
  | { type: 'routine-opened'; routineId: string }
  | { type: 'routine-created'; routineId: string }
  | { type: 'routine-renamed'; routineId: string; name: string }
  | { type: 'routine-picker-opened'; routineId: string }
  | { type: 'routine-exercise-query-changed'; routineId: string; query: string }
  | { type: 'routine-exercise-selected'; routineId: string; exerciseSlug: string }
  | { type: 'routine-exercise-added'; routineId: string; exerciseSlugs: readonly string[] }
  | { type: 'routine-set-added'; routineId: string; setId: string; count: number }
  | { type: 'routine-target-updated'; routineId: string; setId: string }
  | { type: 'routine-rest-updated'; routineId: string; seconds: number }
  | { type: 'workout-started'; workoutId: string; routineId?: string; programId?: string }
  | { type: 'workout-set-written'; workoutId: string; setId: string; recordable: boolean }
  | { type: 'workout-set-completed'; workoutId: string; setId: string }
  | { type: 'rest-finished'; setId: string }
  | { type: 'workout-finish-opened'; workoutId: string }
  | { type: 'workout-saved'; workoutId: string }
  | { type: 'backup-exported'; outcome: 'shared' | 'downloaded' }
  | { type: 'restore-confirmation-opened' }
  | {
      type: 'stale-workout-choice';
      workoutId: string;
      choice: 'resume' | 'finish' | 'discard';
    };
