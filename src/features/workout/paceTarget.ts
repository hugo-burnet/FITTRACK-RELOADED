import type { MeasurementType, WorkoutSet } from '@/data/types';
import { isTimedMeasurement } from '@/lib/measurement';

/**
 * Ce que bat l'horloge d'une ligne : des répétitions, ou une montre.
 *
 * C'est le type de mesure de l'exercice qui tranche, et lui seul — `cadenceFor`
 * est le seul endroit du dépôt qui a le droit de répondre à cette question,
 * exactement comme `lib/measurement` est le seul à dire de quoi une série est
 * faite.
 */
export type PaceCadence = { kind: 'reps'; repSeconds: number } | { kind: 'hold' };

/**
 * Quelle série l'horloge suit, et à quel rythme.
 *
 * **La série de travail suivante, jamais un échauffement.** Un échauffement est
 * là où on trouve sa journée ; être cliqué dessus est exactement la mauvaise
 * aide.
 *
 * **Répétitions saisies, jamais la prescription.** L'objectif pâle d'un champ
 * vide est un contexte, pas une consigne : le métronome ne prend une série que
 * lorsque le nombre qu'on s'apprête à faire est écrit.
 *
 * **Un maintien n'a pas d'équivalent, et c'est voulu.** Il n'y a rien à saisir
 * avant de tenir — la durée est le résultat, pas l'entrée.
 *
 * **Le tempo entre, il n'est pas calculé ici.** C'est le choix de l'exercice
 * (ou la préférence derrière lui) — cf. `lib/tempo`.
 */
export type PaceTarget =
  | { kind: 'reps'; setId: string; reps: number; repSeconds: number }
  | { kind: 'hold'; setId: string };

/** La montre pour ce qui se mesure en temps, le métronome pour ce qui se compte. */
export function cadenceFor(measurementType: MeasurementType, repSeconds: number): PaceCadence {
  return isTimedMeasurement(measurementType) ? { kind: 'hold' } : { kind: 'reps', repSeconds };
}

export type PacePreparation =
  | { kind: 'ready'; target: PaceTarget }
  | { kind: 'missing-reps'; setId: string }
  | { kind: 'done' };

export interface PaceExerciseLine {
  rowId: string;
  sets: readonly WorkoutSet[];
  /** La cadence de l'exercice, tempo déjà résolu contre la préférence. */
  cadence: PaceCadence;
}

export interface FollowingExercisePace {
  rowId: string;
  preparation: Exclude<PacePreparation, { kind: 'done' }>;
}

/**
 * Reads the next working row as a small state machine. Keeping "empty" apart
 * from "finished" lets the workout screen ask for the missing input without
 * pretending there is no next set.
 */
export function prepareNextPace(
  sets: readonly WorkoutSet[],
  cadence: PaceCadence,
  afterSetId?: string,
): PacePreparation {
  const working = sets.filter((set) => set.deletedAt === 0 && set.setType !== 'warmup');
  const finishedIndex =
    afterSetId === undefined ? -1 : sets.findIndex((set) => set.id === afterSetId);
  const target = working.find(
    (set) =>
      set.isCompleted === 0 &&
      (finishedIndex < 0 || sets.findIndex((candidate) => candidate.id === set.id) > finishedIndex),
  );
  if (target === undefined) return { kind: 'done' };

  // Un maintien est prêt dès qu'il a une série : la durée est ce qu'il produit,
  // pas ce qu'il attend.
  if (cadence.kind === 'hold') {
    return { kind: 'ready', target: { kind: 'hold', setId: target.id } };
  }

  if (target.reps === undefined || target.reps <= 0) {
    return { kind: 'missing-reps', setId: target.id };
  }

  return {
    kind: 'ready',
    target: { kind: 'reps', setId: target.id, reps: target.reps, repSeconds: cadence.repSeconds },
  };
}

/**
 * Hands a finished exercise to the first following exercise that still has a
 * working set. The list order is the workout order visible on screen.
 */
export function prepareFollowingExercisePace(
  lines: readonly PaceExerciseLine[],
  currentRowId: string,
): FollowingExercisePace | null {
  const currentIndex = lines.findIndex((line) => line.rowId === currentRowId);
  if (currentIndex < 0) return null;

  for (const line of lines.slice(currentIndex + 1)) {
    const preparation = prepareNextPace(line.sets, line.cadence);
    if (preparation.kind !== 'done') return { rowId: line.rowId, preparation };
  }
  return null;
}
