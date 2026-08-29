import type {
  Equipment,
  MeasurementType,
  MuscleGroup,
  SetType,
  Side,
} from '@/data/types';

export type HistoricalScope =
  | { kind: 'workout'; workoutId: string }
  | { kind: 'exercise'; exerciseId: string; from?: number; to?: number }
  | { kind: 'period'; from: number; to: number }
  | { kind: 'all-history' };

export interface HistoricalSet {
  setType: SetType;
  side: Side;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}

export interface HistoricalExercise {
  exerciseId: string;
  /**
   * L'identité de catalogue, absente sur un exercice personnel.
   *
   * Lue par les paliers, qui doivent reconnaître « le développé couché » et non
   * « une ligne qui s'appelle ainsi ». Un nom se retape, un slug ne s'invente
   * pas — c'est toute la garde du catalogue de paliers.
   */
  slug?: string;
  name?: string;
  measurementType?: MeasurementType;
  primaryMuscle?: MuscleGroup;
  /** Read by the body map only; every count in the app stays on the primary. */
  secondaryMuscles?: MuscleGroup[];
  equipment?: Equipment;
  /**
   * Le drapeau unilatéral, revenu dans la projection parce qu'il a désormais un
   * lecteur : le palier de la paire d'haltères, qui n'existe que si les deux
   * mains travaillent en même temps. Il était sorti d'ici pour la raison
   * inverse — cinq lots déclaré et lu par personne — et la règle n'a pas changé :
   * un champ transporté reste dans la projection tant qu'un écran s'en sert, et
   * en ressort le jour où plus personne ne le lit.
   */
  isUnilateral?: 0 | 1;
  bodyweightLoadFactor?: number;
  /**
   * The tempo this exercise was performed at, already resolved against the
   * preference (cf. `lib/tempo`). What the session's working time is counted
   * with, wherever a set is measured in repetitions rather than in seconds.
   */
  repSeconds?: number;
  notes?: string;
  sets: HistoricalSet[];
}

export interface HistoricalWorkout {
  workoutId: string;
  name: string;
  notes?: string;
  startedAt: number;
  timezoneOffsetMinutes?: number;
  durationSeconds: number;
  bodyWeightKg?: number;
  exercises: HistoricalExercise[];
}
