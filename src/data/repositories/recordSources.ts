import Dexie from 'dexie';
import { db } from '@/data/db';
import type { BodyMeasurement, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resolveWorkoutExerciseIdentity } from '@/lib/exerciseSnapshot';
import { measurementShape } from '@/lib/measurement';
import type { RecordSource } from '@/lib/records';
import { isWorkingSet } from '@/lib/records';
import { sessionTotals, type VolumeEntry } from '@/lib/volume';

const BODY_WEIGHT_TYPE = 'body_weight';

interface SourceScope {
  exerciseIds: readonly string[];
  workoutId?: string;
}

interface QualifiedSet {
  set: WorkoutSet;
  row: WorkoutExercise;
  workout: Workout;
  measurementType: RecordSource['measurementType'];
  bodyweightLoadFactor?: number;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const bySetTimeline = (left: QualifiedSet, right: QualifiedSet): number =>
  left.set.performedAt - right.set.performedAt ||
  left.row.order - right.row.order ||
  left.set.order - right.set.order ||
  left.set.id.localeCompare(right.set.id);

const bySourceTimeline = (left: RecordSource, right: RecordSource): number =>
  left.achievedAt - right.achievedAt ||
  left.exerciseOrder - right.exerciseOrder ||
  left.setOrder - right.setOrder ||
  left.workoutId.localeCompare(right.workoutId) ||
  left.exerciseId.localeCompare(right.exerciseId) ||
  (left.workoutSetId ?? '').localeCompare(right.workoutSetId ?? '');

const isIncludedWorkout = (workout: Workout | undefined): workout is Workout =>
  workout !== undefined &&
  workout.deletedAt === 0 &&
  (workout.status === 'active' || workout.status === 'completed');

async function loadBodyWeights(): Promise<BodyMeasurement[]> {
  const rows = await db.bodyMeasurements
    .where('[type+measuredAt]')
    .between([BODY_WEIGHT_TYPE, Dexie.minKey], [BODY_WEIGHT_TYPE, Dexie.maxKey])
    .toArray();

  return rows
    .filter((row) => row.deletedAt === 0)
    .sort((left, right) => left.measuredAt - right.measuredAt);
}

function resolveBodyWeightAt(
  rows: readonly BodyMeasurement[],
  timestamp: number,
): number | undefined {
  if (rows.length === 0) return undefined;

  let low = 0;
  let high = rows.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (rows[middle]!.measuredAt <= timestamp) low = middle;
    else high = middle - 1;
  }

  return rows[low]!.measuredAt > timestamp ? rows[0]!.value : rows[low]!.value;
}

async function loadCandidateSets(scope: SourceScope): Promise<WorkoutSet[]> {
  if (scope.workoutId !== undefined) {
    return db.workoutSets.where('workoutId').equals(scope.workoutId).toArray();
  }

  const lists = await Promise.all(
    scope.exerciseIds.map((exerciseId) =>
      db.workoutSets.where('exerciseId').equals(exerciseId).toArray(),
    ),
  );
  return lists.flat();
}

function sourceForSet(qualified: QualifiedSet): RecordSource {
  const { set, row, measurementType } = qualified;
  return {
    workoutId: set.workoutId,
    workoutSetId: set.id,
    exerciseId: set.exerciseId,
    measurementType,
    achievedAt: set.performedAt,
    exerciseOrder: row.order,
    setOrder: set.order,
    set,
  };
}

function sourceForSession(
  sets: readonly QualifiedSet[],
  bodyWeightKg: number | undefined,
): RecordSource {
  const last = [...sets].sort(bySetTimeline).at(-1)!;
  const entries: VolumeEntry[] = sets.map(({ set, measurementType, bodyweightLoadFactor }) => ({
    set,
    weightRole: measurementShape(measurementType).weightRole,
    ...(bodyweightLoadFactor === undefined ? {} : { bodyweightLoadFactor }),
  }));

  return {
    workoutId: last.set.workoutId,
    exerciseId: last.set.exerciseId,
    measurementType: last.measurementType,
    achievedAt: last.set.performedAt,
    exerciseOrder: last.row.order,
    setOrder: last.set.order,
    sessionTonnage: sessionTotals(entries, bodyWeightKg).tonnage,
  };
}

async function assembleRecordSources(scope: SourceScope): Promise<RecordSource[]> {
  const exerciseIds = unique(scope.exerciseIds);
  if (exerciseIds.length === 0) return [];

  return db.transaction(
    'r',
    db.workoutSets,
    db.workoutExercises,
    db.workouts,
    db.exercises,
    db.bodyMeasurements,
    async () => {
      const candidates = await loadCandidateSets({ ...scope, exerciseIds });
      const rows = await db.workoutExercises.bulkGet(unique(candidates.map((set) => set.workoutExerciseId)));
      const workouts = await db.workouts.bulkGet(unique(candidates.map((set) => set.workoutId)));
      const exercises = await db.exercises.bulkGet(unique(candidates.map((set) => set.exerciseId)));
      const rowById = new Map(rows.flatMap((row) => (row === undefined ? [] : [[row.id, row] as const])));
      const workoutById = new Map(
        workouts.flatMap((workout) => (workout === undefined ? [] : [[workout.id, workout] as const])),
      );
      const exerciseById = new Map(
        exercises.flatMap((exercise) => (exercise === undefined ? [] : [[exercise.id, exercise] as const])),
      );
      const targetExerciseIds = new Set(exerciseIds);
      const qualified: QualifiedSet[] = [];

      for (const set of candidates) {
        const row = rowById.get(set.workoutExerciseId);
        const workout = workoutById.get(set.workoutId);
        if (
          set.deletedAt !== 0 ||
          set.isCompleted !== 1 ||
          !isWorkingSet(set) ||
          row === undefined ||
          row.deletedAt !== 0 ||
          !isIncludedWorkout(workout) ||
          !targetExerciseIds.has(set.exerciseId) ||
          row.workoutId !== set.workoutId ||
          row.exerciseId !== set.exerciseId
        ) {
          continue;
        }

        const identity = resolveWorkoutExerciseIdentity(row, exerciseById.get(row.exerciseId));
        qualified.push({
          set,
          row,
          workout,
          measurementType: identity.measurementType,
          ...(identity.bodyweightLoadFactor === undefined
            ? {}
            : { bodyweightLoadFactor: identity.bodyweightLoadFactor }),
        });
      }

      const bodyWeights = await loadBodyWeights();
      const sources = qualified.map(sourceForSet);
      const bySessionExercise = new Map<string, QualifiedSet[]>();
      for (const item of qualified) {
        const key = `${item.set.workoutId}\u0000${item.set.exerciseId}`;
        const group = bySessionExercise.get(key);
        if (group === undefined) bySessionExercise.set(key, [item]);
        else group.push(item);
      }

      for (const group of bySessionExercise.values()) {
        sources.push(sourceForSession(group, resolveBodyWeightAt(bodyWeights, group[0]!.workout.startedAt)));
      }

      return sources.sort(bySourceTimeline);
    },
  );
}

export async function listRecordSourcesForExercises(
  exerciseIds: readonly string[],
): Promise<RecordSource[]> {
  return assembleRecordSources({ exerciseIds });
}

export async function getCompletedSetRecordSources(
  workoutSetId: string,
): Promise<RecordSource[]> {
  const set = await db.workoutSets.get(workoutSetId);
  if (set === undefined) return [];

  const sources = await assembleRecordSources({
    workoutId: set.workoutId,
    exerciseIds: [set.exerciseId],
  });
  if (!sources.some((source) => source.workoutSetId === workoutSetId)) return [];

  return sources.filter(
    (source) =>
      source.workoutSetId === workoutSetId ||
      (source.workoutId === set.workoutId &&
        source.exerciseId === set.exerciseId &&
        source.sessionTonnage !== undefined),
  );
}
