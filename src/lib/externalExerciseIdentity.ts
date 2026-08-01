import type { Equipment, Exercise, ExternalExerciseBinding, MeasurementType } from '@/data/types';
import type { NewExercise } from '@/data/repositories/exercises';

const COMBINING_MARKS = /\p{M}/gu;
const NON_LETTERS_OR_NUMBERS = /[^\p{L}\p{N}]+/gu;

export interface ExternalExerciseExample {
  workoutName: string;
  startedAt: number;
  sets: readonly {
    weight?: number;
    reps?: number;
    durationSeconds?: number;
    distanceMeters?: number;
  }[];
}

export interface ExternalExerciseObservation {
  source: 'hevy_csv';
  sourceTitle: string;
  measurementType: MeasurementType;
  equipmentHint?: Equipment;
  sessionCount: number;
  setCount: number;
  examples: readonly ExternalExerciseExample[];
}

export interface ExerciseSuggestion {
  exercise: Exercise;
}

export interface ConfirmedExternalExercise {
  status: 'confirmed';
  identityKey: string;
  observation: ExternalExerciseObservation;
  exercise: Exercise;
}

export interface UnconfirmedExternalExercise {
  status: 'needs_confirmation';
  identityKey: string;
  observation: ExternalExerciseObservation;
  suggestions: readonly ExerciseSuggestion[];
}

export interface ConflictingExternalExercise {
  status: 'conflict';
  identityKey: string;
  observation: ExternalExerciseObservation;
  reason:
    | 'multiple_active_targets'
    | 'target_missing'
    | 'target_deleted'
    | 'measurement_changed';
  suggestions: readonly ExerciseSuggestion[];
}

export type ExternalExerciseReviewEntry =
  ConfirmedExternalExercise | UnconfirmedExternalExercise | ConflictingExternalExercise;

export type ExternalExerciseDecision =
  | {
      identityKey: string;
      kind: 'existing';
      exerciseId: string;
    }
  | {
      identityKey: string;
      kind: 'custom';
      exercise: NewExercise;
    };

export interface ExternalExerciseResolution {
  exercisesByIdentityKey: ReadonlyMap<string, Exercise>;
  exercisesToCreate: Exercise[];
  bindingsToWrite: ExternalExerciseBinding[];
}

export interface ExternalExerciseIdentityRegistry {
  review(
    observations: readonly ExternalExerciseObservation[],
  ): readonly ExternalExerciseReviewEntry[];
  resolve(
    entries: readonly ExternalExerciseReviewEntry[],
    decisions: readonly ExternalExerciseDecision[],
    confirmedAt: number,
  ): ExternalExerciseResolution;
}

export function externalExerciseIdentityKey(title: string): string {
  return title
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_LETTERS_OR_NUMBERS, ' ')
    .trim();
}

function makeSuggestionList(
  suggestions: ReadonlyMap<string, readonly Exercise[]>,
  identityKey: string,
): ExerciseSuggestion[] {
  return (suggestions.get(identityKey) ?? []).map((exercise) => ({
    exercise,
  }));
}

function bindingConflictReason(
  binding: ExternalExerciseBinding,
  observation: ExternalExerciseObservation,
  target: Exercise | undefined,
): ConflictingExternalExercise['reason'] | undefined {
  if (target === undefined) return 'target_missing';
  if (target.deletedAt !== 0) return 'target_deleted';
  if (
    binding.measurementType !== observation.measurementType ||
    target.measurementType !== observation.measurementType
  ) {
    return 'measurement_changed';
  }
  return undefined;
}

function materializeCustomExercise(exercise: NewExercise, createdAt: number): Exercise {
  return {
    ...exercise,
    id: crypto.randomUUID(),
    createdAt,
    updatedAt: createdAt,
    deletedAt: 0,
    isCustom: 1,
  };
}

function materializeBinding(
  entry: ExternalExerciseReviewEntry,
  exercise: Exercise,
  confirmedAt: number,
): ExternalExerciseBinding {
  return {
    id: crypto.randomUUID(),
    createdAt: confirmedAt,
    updatedAt: confirmedAt,
    deletedAt: 0,
    source: entry.observation.source,
    identityKey: entry.identityKey,
    sourceTitle: entry.observation.sourceTitle,
    exerciseId: exercise.id,
    measurementType: entry.observation.measurementType,
    equipmentHint: entry.observation.equipmentHint,
    verification: 'user',
    confirmedAt,
  };
}

export function createExternalExerciseIdentityRegistry(
  exercises: readonly Exercise[],
  bindings: readonly ExternalExerciseBinding[],
  suggestions: ReadonlyMap<string, readonly Exercise[]>,
): ExternalExerciseIdentityRegistry {
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const bindingsByIdentityKey = new Map<
    string,
    ExternalExerciseBinding[]
  >();
  for (const binding of bindings) {
    if (
      binding.source === 'hevy_csv' &&
      binding.deletedAt === 0 &&
      binding.verification === 'user'
    ) {
      const group = bindingsByIdentityKey.get(binding.identityKey) ?? [];
      group.push(binding);
      bindingsByIdentityKey.set(binding.identityKey, group);
    }
  }

  const review = (
    observations: readonly ExternalExerciseObservation[],
  ): ExternalExerciseReviewEntry[] =>
    observations.map((observation) => {
      const identityKey = externalExerciseIdentityKey(observation.sourceTitle);
      const bindingGroup = bindingsByIdentityKey.get(identityKey);
      const entrySuggestions = makeSuggestionList(suggestions, identityKey);
      if (bindingGroup === undefined) {
        return {
          status: 'needs_confirmation',
          identityKey,
          observation,
          suggestions: entrySuggestions,
        };
      }

      if (
        new Set(bindingGroup.map((binding) => binding.exerciseId))
          .size > 1
      ) {
        return {
          status: 'conflict',
          identityKey,
          observation,
          reason: 'multiple_active_targets',
          suggestions: entrySuggestions,
        };
      }

      const binding = bindingGroup.reduce((preferred, candidate) => {
        if (candidate.confirmedAt !== preferred.confirmedAt) {
          return candidate.confirmedAt > preferred.confirmedAt
            ? candidate
            : preferred;
        }
        return candidate.id.localeCompare(preferred.id) < 0
          ? candidate
          : preferred;
      });

      const target = exercisesById.get(binding.exerciseId);
      const reason = bindingConflictReason(binding, observation, target);
      if (reason !== undefined) {
        return {
          status: 'conflict',
          identityKey,
          observation,
          reason,
          suggestions: entrySuggestions,
        };
      }
      return {
        status: 'confirmed',
        identityKey,
        observation,
        exercise: target!,
      };
    });

  const resolve = (
    entries: readonly ExternalExerciseReviewEntry[],
    decisions: readonly ExternalExerciseDecision[],
    confirmedAt: number,
  ): ExternalExerciseResolution => {
    const decisionsByIdentityKey = new Map<string, ExternalExerciseDecision>();
    for (const decision of decisions) {
      if (decisionsByIdentityKey.has(decision.identityKey)) {
        throw new Error('Duplicate external exercise decision');
      }
      decisionsByIdentityKey.set(decision.identityKey, decision);
    }

    const exercisesByIdentityKey = new Map<string, Exercise>();
    const exercisesToCreate: Exercise[] = [];
    const bindingsToWrite: ExternalExerciseBinding[] = [];

    for (const entry of entries) {
      const decision = decisionsByIdentityKey.get(entry.identityKey);
      if (entry.status === 'confirmed' && decision === undefined) {
        exercisesByIdentityKey.set(entry.identityKey, entry.exercise);
        continue;
      }
      if (decision === undefined) {
        throw new Error(`Missing external exercise decision: ${entry.identityKey}`);
      }

      let resolvedExercise: Exercise;
      if (decision.kind === 'custom') {
        resolvedExercise = materializeCustomExercise(decision.exercise, confirmedAt);
        exercisesToCreate.push(resolvedExercise);
      } else {
        const target = exercisesById.get(decision.exerciseId);
        if (target === undefined || target.deletedAt !== 0) {
          throw new Error(`External exercise target is unavailable: ${entry.identityKey}`);
        }
        resolvedExercise = target;
      }
      if (resolvedExercise.measurementType !== entry.observation.measurementType) {
        throw new Error(`External exercise measurement is incompatible: ${entry.identityKey}`);
      }

      exercisesByIdentityKey.set(entry.identityKey, resolvedExercise);
      if (entry.status !== 'confirmed' || entry.exercise.id !== resolvedExercise.id) {
        bindingsToWrite.push(materializeBinding(entry, resolvedExercise, confirmedAt));
      }
    }

    return {
      exercisesByIdentityKey,
      exercisesToCreate,
      bindingsToWrite,
    };
  };

  return { review, resolve };
}
