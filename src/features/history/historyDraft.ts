import type {
  ArchivedExerciseDraft,
  ArchivedSetDraft,
  ArchivedWorkoutDraft,
} from '@/data/repositories/history';
import type { WorkoutDetail } from '@/data/repositories/workouts';
import type { Exercise, MeasurementType } from '@/data/types';
import { t } from '@/i18n/fr';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import { resolveRestSeconds } from '@/lib/rest';
import { normalizeSupersets } from '@/lib/routineOrder';

export interface HistorySetDraft extends ArchivedSetDraft {
  draftId: string;
}

export interface HistoryExerciseDraft
  extends Omit<ArchivedExerciseDraft, 'sets'> {
  draftId: string;
  exerciseName: string;
  measurementType?: MeasurementType;
  sets: HistorySetDraft[];
}

export interface HistoryWorkoutDraft
  extends Omit<ArchivedWorkoutDraft, 'exercises'> {
  exercises: HistoryExerciseDraft[];
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');

export function localDateValue(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    twoDigits(date.getMonth() + 1),
    twoDigits(date.getDate()),
  ].join('-');
}

export function localTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

export function timestampFromLocalInputs(dateValue: string, timeValue: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (dateMatch === null || timeMatch === null) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const local = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day ||
    local.getHours() !== hours ||
    local.getMinutes() !== minutes
  ) {
    return null;
  }

  return local.getTime();
}

export function timestampFromHistoryInputs(
  originalTimestamp: number,
  dateValue: string,
  timeValue: string,
): number | null {
  if (
    localDateValue(originalTimestamp) === dateValue &&
    localTimeValue(originalTimestamp) === timeValue
  ) {
    return originalTimestamp;
  }
  return timestampFromLocalInputs(dateValue, timeValue);
}

export function newHistorySetDraft(): HistorySetDraft {
  return {
    draftId: crypto.randomUUID(),
    setType: 'normal',
    side: 'both',
  };
}

export function normalizeHistoryRpe(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const halfPoint = Math.round(value * 2) / 2;
  return Math.min(10, Math.max(6, halfPoint));
}

export function newHistoryExerciseDraft(exercise: Exercise): HistoryExerciseDraft {
  return {
    draftId: crypto.randomUUID(),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    measurementType: exercise.measurementType,
    supersetGroup: 0,
    restSeconds: resolveRestSeconds(undefined, exercise.defaultRestSeconds),
    sets: [],
  };
}

export function removeHistoryExerciseDraft(
  exercises: readonly HistoryExerciseDraft[],
  draftId: string,
): HistoryExerciseDraft[] {
  return normalizeSupersets(
    exercises.filter((exercise) => exercise.draftId !== draftId),
  );
}

export function draftFromArchivedDetail(detail: WorkoutDetail): HistoryWorkoutDraft {
  return {
    workoutId: detail.workout.id,
    name: detail.workout.name,
    ...(detail.workout.notes === undefined ? {} : { notes: detail.workout.notes }),
    startedAt: detail.workout.startedAt,
    durationSeconds: detail.workout.durationSeconds,
    exercises: detail.exercises.map(({ row, exercise, sets }) => {
      // The editor shows and edits what the session recorded, not what the
      // library says today: `measurementType` decides which fields a set even
      // offers, so reading it from the library would re-type figures already
      // typed. Neither field is persisted back — `saveArchivedWorkout` re-derives
      // the snapshot, and only when the row's `exerciseId` actually changes.
      const identity = resolveExerciseIdentity(row, exercise);

      return {
        id: row.id,
        draftId: row.id,
        exerciseId: row.exerciseId,
        exerciseName: identity.name ?? t('history.deletedExercise'),
        ...(identity.measurementType === undefined
          ? {}
          : { measurementType: identity.measurementType }),
        supersetGroup: row.supersetGroup,
        restSeconds: row.restSeconds,
        ...(row.notes === undefined ? {} : { notes: row.notes }),
        sets: sets
          .filter((set) => set.isCompleted === 1)
          .map((set) => ({
            id: set.id,
            draftId: set.id,
            setType: set.setType,
            side: set.side,
            ...(set.weight === undefined ? {} : { weight: set.weight }),
            ...(set.reps === undefined ? {} : { reps: set.reps }),
            ...(set.durationSeconds === undefined
              ? {}
              : { durationSeconds: set.durationSeconds }),
            ...(set.distanceMeters === undefined
              ? {}
              : { distanceMeters: set.distanceMeters }),
            ...(set.rpe === undefined ? {} : { rpe: set.rpe }),
          })),
      };
    }),
  };
}

export function archivedDraftFromHistory(
  draft: HistoryWorkoutDraft,
): ArchivedWorkoutDraft {
  return {
    workoutId: draft.workoutId,
    name: draft.name,
    ...(draft.notes === undefined ? {} : { notes: draft.notes }),
    startedAt: draft.startedAt,
    durationSeconds: draft.durationSeconds,
    exercises: draft.exercises.map((exercise) => ({
      ...(exercise.id === undefined ? {} : { id: exercise.id }),
      exerciseId: exercise.exerciseId,
      supersetGroup: exercise.supersetGroup,
      restSeconds: exercise.restSeconds,
      ...(exercise.notes === undefined ? {} : { notes: exercise.notes }),
      sets: exercise.sets.map((set) => ({
        ...(set.id === undefined ? {} : { id: set.id }),
        setType: set.setType,
        side: set.side,
        ...(set.weight === undefined ? {} : { weight: set.weight }),
        ...(set.reps === undefined ? {} : { reps: set.reps }),
        ...(set.durationSeconds === undefined
          ? {}
          : { durationSeconds: set.durationSeconds }),
        ...(set.distanceMeters === undefined
          ? {}
          : { distanceMeters: set.distanceMeters }),
        ...(set.rpe === undefined ? {} : { rpe: set.rpe }),
      })),
    })),
  };
}
