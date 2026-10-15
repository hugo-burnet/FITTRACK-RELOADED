import type { MeasurementType, WorkoutExercise, WorkoutSet } from '@/data/types';
import { measurementShape } from '@/lib/measurement';

/**
 * Ce qui reste d'une ligne de séance et de ses séries quand l'exercice change (« la machine est
 * prise »). Purs : une ligne ou une série en entrée, une copie en sortie.
 *
 * Le principe est celui d'une **place** : la ligne garde son rang, son superset, ses notes et le
 * nombre de séries qu'il reste à faire ; elle perd tout ce qui parlait de l'ancien exercice.
 */

/**
 * Ce qui a été saisi pour l'ancien exercice. Une série qu'on remplace n'est par définition pas
 * validée : ses chiffres étaient un brouillon pour une autre machine.
 */
const ENTERED_KEYS = [
  'weight',
  'reps',
  'durationSeconds',
  'distanceMeters',
  'rpe',
  'unilateralSecondSideStartsAt',
] as const;

/**
 * La série à refaire pour le nouvel exercice.
 *
 * - Rien de ce qui a été saisi ne reste.
 * - **La charge visée ne passe jamais** : « 100 kg » est un chiffre de développé couché, pas de
 *   la place.
 * - La fourchette de répétitions, la durée et la distance visées passent **si le nouvel exercice
 *   les mesure** : 8–12 répétitions valent pour un autre exercice qui se compte, pas pour un
 *   gainage qui se chronomètre.
 * - Le rang, le type (échauffement, dégressive…), le côté et l'effort visé restent.
 */
export function setForReplacement(set: WorkoutSet, to: MeasurementType): WorkoutSet {
  const { fields } = measurementShape(to);
  const next: WorkoutSet = { ...set, isCompleted: 0, performedAt: 0 };

  for (const key of ENTERED_KEYS) delete next[key];
  delete next.targetWeight;
  if (!fields.includes('reps')) {
    delete next.targetReps;
    delete next.targetRepsMax;
  }
  if (!fields.includes('duration')) delete next.targetDurationSeconds;
  if (!fields.includes('distance')) delete next.targetDistanceMeters;
  return next;
}

/** Ce que la ligne dit de son exercice : l'instantané, et la cadence qui était la sienne. */
const IDENTITY_KEYS = [
  'exerciseName',
  'exerciseMeasurementType',
  'exercisePrimaryMuscle',
  'exerciseSecondaryMuscles',
  'exerciseEquipment',
  'exerciseBodyweightLoadFactor',
  'exerciseIsUnilateral',
  // Un tempo se choisit pour un exercice : l'autre prend le réglage de l'app.
  'repSeconds',
] as const;

/**
 * La ligne sans l'identité de l'ancien exercice, prête à recevoir celle du nouveau.
 *
 * Les clés sont retirées et non écrasées : l'instantané d'un exercice sans muscle secondaire ne
 * porte pas la clé (cf. `snapshotOf`), et laisser celle de l'ancien ferait lire à la fiche les
 * muscles d'un exercice qui n'est plus là. Les notes, le rang, le superset et le repos restent :
 * c'est la place, pas l'exercice — sauf le repos, que l'appelant recalcule.
 */
export function rowWithoutExerciseIdentity(row: WorkoutExercise): WorkoutExercise {
  const next: WorkoutExercise = { ...row };
  for (const key of IDENTITY_KEYS) delete next[key];
  return next;
}
