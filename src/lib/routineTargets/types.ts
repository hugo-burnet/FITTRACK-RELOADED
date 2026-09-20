import type { Equipment, MeasurementType, SetType } from '@/data/types';

/**
 * Le vocabulaire de la revue des cibles — entrées et sorties du moteur pur.
 *
 * Structural, jamais entitaire : `compute.ts` ne connaît ni Dexie ni
 * `RoutineSet`. C'est la même frontière que `lib/coach/types.ts` tient depuis
 * le Lot 18, et c'est elle qui rend la règle « aucune baisse » testable sans
 * base de données.
 */

/** Une série planifiée, réduite à ce que la revue lit. */
export interface RoutineTargetSetInput {
  id: string;
  order: number;
  setType: SetType;
  targetReps?: number;
  targetRepsMax?: number;
  targetWeight?: number;
}

/** Une ligne de routine : un exercice et ses séries planifiées. */
export interface RoutineTargetLineInput {
  routineExerciseId: string;
  exerciseId: string;
  order: number;
  exerciseName: string;
  /**
   * Le drapeau qui suffixe « (unilatéral) » à l'affichage. Il voyage avec le
   * nom parce qu'il vient de la même source que lui — la bibliothèque pour une
   * ligne de routine, l'instantané pour un bloc d'historique — et qu'un écran
   * n'a pas à aller le rechercher ailleurs.
   */
  isUnilateral?: 0 | 1;
  measurementType: MeasurementType;
  equipment: Equipment;
  /** Le pas de charge propre à l'exercice, quand il en porte un (Lot 18). */
  loadIncrementKg?: number;
  sets: RoutineTargetSetInput[];
}

/** Une série réalisée et validée. */
export interface PerformedSetInput {
  setType: SetType;
  order: number;
  weight?: number;
  reps?: number;
  rpe?: number;
}

/**
 * Un bloc d'historique : **un exercice dans une séance**.
 *
 * La clé est `workoutExerciseId` et non `workoutId`, comme
 * `listSessionsForExercise` : un exercice fait deux fois dans la même séance
 * est deux blocs, et les fusionner ferait collisionner leurs `order`.
 */
export interface PerformedSessionInput {
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
  /** Date de la première série validée du bloc. */
  performedAt: number;
  /** Le nom tel qu'il a été fait — l'instantané, pas la bibliothèque d'aujourd'hui. */
  exerciseName?: string;
  isUnilateral?: 0 | 1;
  /**
   * La mesure de l'instantané. Un bloc qui ne partage pas celle de la ligne
   * n'est pas une référence : c'est la correction Codex de `getLastPerformance`,
   * où les kilos d'assistance d'une traction revenaient en charge ajoutée.
   */
  measurementType?: MeasurementType;
  /** La routine d'où la séance est partie, `''` pour une séance libre. */
  fromRoutineId?: string;
  sets: PerformedSetInput[];
}

export interface RoutineUpdateInput {
  routineId: string;
  lines: RoutineTargetLineInput[];
  /** Les blocs lus : l'historique des exercices de la routine, et celui de ses séances. */
  sessions: PerformedSessionInput[];
  /** Combien de séances récentes font la fenêtre de référence. Défaut 3. */
  referenceSessionCount?: number;
}

/**
 * `align_weight` : le réalisé dépasse déjà la cible, on propose de la rejoindre.
 * `increase_weight` : la cible est tenue en entier, on propose un pas de plus.
 * Il n'existe pas de troisième valeur — une baisse n'est jamais une proposition.
 */
export type RoutineUpdateKind = 'align_weight' | 'increase_weight';

/** La séance sur laquelle la proposition s'appuie. */
export interface RoutineUpdateReference {
  workoutId: string;
  workoutExerciseId: string;
  performedAt: number;
  workingSetCount: number;
  /** Absent quand aucune série de la référence ne porte de RPE. */
  maxRpe?: number;
}

export interface RoutineTargetProposal {
  routineExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  isUnilateral?: 0 | 1;
  measurementType: MeasurementType;
  kind: RoutineUpdateKind;
  /** La cible actuelle : la plus dure des séries de travail. Absente si aucune n'en porte. */
  currentWeight?: number;
  /** Le réalisé de la séance de référence, à sa charge de travail la plus dure. */
  performedWeight: number;
  /** Les répétitions tenues à cette charge — pour écrire « 70 kg × 10 ». */
  performedReps?: number;
  proposedWeight: number;
  /**
   * Ce qu'accepter ajoute à **chaque** série de travail qui porte déjà une
   * charge. Une routine en pyramide (60/70/80) garde donc sa forme au lieu
   * d'être aplatie sur un seul chiffre. Absent quand la ligne ne portait
   * aucune charge : les séries reçoivent alors `proposedWeight` tel quel.
   */
  deltaKg?: number;
  /** Renseigné sur `increase_weight` : le pas retenu pour cet exercice. */
  incrementKg?: number;
  /** Exactement les séries qu'accepter réécrirait. */
  targetSetIds: string[];
  reference: RoutineUpdateReference;
}

/**
 * Un exercice réalisé dans les séances de cette routine mais absent d'elle
 * (règle 6). Signalé, jamais appliqué d'office.
 */
export interface RoutineMissingExercise {
  exerciseId: string;
  exerciseName: string;
  isUnilateral?: 0 | 1;
  measurementType?: MeasurementType;
  lastPerformedAt: number;
  /** Dans combien des séances lues il apparaît. */
  sessionCount: number;
  workingSetCount: number;
  /** La charge de travail la plus dure vue sur la fenêtre, s'il y en a une. */
  bestWeight?: number;
}

/**
 * Pourquoi une ligne reste telle quelle.
 *
 * Ce n'est pas du décor : un écran qui ne propose rien et ne dit pas pourquoi
 * se lit comme une panne. C'est aussi ce sur quoi les tests « aucune hausse si
 * RPE > 8 » et « jamais de baisse » assertent, au lieu d'asserter un tableau
 * vide qui serait vert pour n'importe quelle raison.
 */
export type RoutineUnchangedReason =
  | 'no_working_sets'
  | 'no_weight_target'
  | 'no_rep_target'
  | 'no_history'
  | 'below_target'
  | 'range_not_completed'
  | 'effort_too_high'
  | 'increment_unavailable';

export interface RoutineUnchangedLine {
  routineExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  isUnilateral?: 0 | 1;
  reason: RoutineUnchangedReason;
}

export interface RoutineUpdateReview {
  routineId: string;
  proposals: RoutineTargetProposal[];
  missingExercises: RoutineMissingExercise[];
  unchanged: RoutineUnchangedLine[];
}
