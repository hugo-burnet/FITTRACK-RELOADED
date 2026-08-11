import Dexie, { type EntityTable } from 'dexie';
import { snapshotOf } from '@/lib/exerciseSnapshot';
import { localOffsetMinutes } from '@/lib/timezone';
import type {
  BodyMeasurement,
  CoachRecommendation,
  Exercise,
  ExternalExerciseBinding,
  PersonalRecord,
  ProgressPhoto,
  Routine,
  RoutineExercise,
  RoutineFolder,
  RoutineSet,
  Setting,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types';

/** Photo binaries live apart so listing photos never loads megabytes into memory. */
export interface PhotoBlob {
  key: string;
  blob: Blob;
}

export class FitTrackDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  externalExerciseBindings!: EntityTable<ExternalExerciseBinding, 'id'>;
  routineFolders!: EntityTable<RoutineFolder, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  routineSets!: EntityTable<RoutineSet, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;
  personalRecords!: EntityTable<PersonalRecord, 'id'>;
  coachRecommendations!: EntityTable<CoachRecommendation, 'id'>;
  bodyMeasurements!: EntityTable<BodyMeasurement, 'id'>;
  progressPhotos!: EntityTable<ProgressPhoto, 'id'>;
  photoBlobs!: EntityTable<PhotoBlob, 'key'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('fittrack');

    // MIGRATION RULE FOR THE WHOLE PROJECT: never touch this version(1) block.
    // To change the schema, append `this.version(2).stores({…}).upgrade(…)`.
    // Editing a version that already shipped corrupts the databases of the
    // devices that already ran it.
    this.version(1).stores({
      exercises: 'id, name, primaryMuscle, equipment, isCustom, updatedAt, deletedAt',
      routineFolders: 'id, order, updatedAt, deletedAt',
      routines: 'id, folderId, order, updatedAt, deletedAt',
      routineExercises: 'id, routineId, [routineId+order], deletedAt',
      routineSets: 'id, routineExerciseId, [routineExerciseId+order], deletedAt',
      workouts: 'id, status, startedAt, routineId, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, [workoutId+order], exerciseId, deletedAt',
      workoutSets:
        'id, workoutExerciseId, [workoutExerciseId+order], workoutId, [exerciseId+performedAt], deletedAt',
      personalRecords: 'id, exerciseId, [exerciseId+type], achievedAt, deletedAt',
      bodyMeasurements: 'id, type, [type+measuredAt], deletedAt',
      progressPhotos: 'id, takenAt, deletedAt',
      photoBlobs: 'key',
      settings: 'key',
    });

    // Backfills the exercise snapshot and the session's original UTC offset.
    // No `.stores()`: none of the five fields is indexed, so the schema itself
    // is unchanged and version 1's declaration carries over.
    //
    // Both backfills are the best information available and the only one there
    // is. A row whose exercise was renamed before this ran records the new
    // name — undetectable, and no worse than the status quo it replaces. The
    // offsets are exact: the platform's zone database knows what the offset was
    // on the day of each session.
    this.version(2).upgrade(async (tx) => {
      const exercises = await tx.table<Exercise>('exercises').toArray();
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

      await tx
        .table<WorkoutExercise>('workoutExercises')
        .toCollection()
        .modify((row) => {
          Object.assign(row, snapshotOf(byId.get(row.exerciseId)));
        });

      await tx
        .table<Workout>('workouts')
        .toCollection()
        .modify((workout) => {
          workout.startedTimezoneOffsetMinutes = localOffsetMinutes(workout.startedAt);
        });
    });

    this.version(3).stores({
      exercises: 'id, name, primaryMuscle, equipment, isCustom, updatedAt, deletedAt',
      externalExerciseBindings: 'id, [source+identityKey], exerciseId, updatedAt, deletedAt',
      routineFolders: 'id, order, updatedAt, deletedAt',
      routines: 'id, folderId, order, updatedAt, deletedAt',
      routineExercises: 'id, routineId, [routineId+order], deletedAt',
      routineSets: 'id, routineExerciseId, [routineExerciseId+order], deletedAt',
      workouts: 'id, status, startedAt, routineId, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, [workoutId+order], exerciseId, deletedAt',
      workoutSets:
        'id, workoutExerciseId, [workoutExerciseId+order], workoutId, [exerciseId+performedAt], deletedAt',
      personalRecords: 'id, exerciseId, [exerciseId+type], achievedAt, deletedAt',
      bodyMeasurements: 'id, type, [type+measuredAt], deletedAt',
      progressPhotos: 'id, takenAt, deletedAt',
      photoBlobs: 'key',
      settings: 'key',
    });

    /**
     * Backfills the snapshot's secondary muscles.
     *
     * No `.stores()`, for the same reason as version 2: the field is not
     * indexed, so the schema itself is unchanged and version 3's declaration
     * carries over.
     *
     * **This does not reopen the rule that snapshots exist to enforce.** That
     * rule forbids *reading today's library at display time* to interpret a past
     * session — which is how the same session once had two names on one screen.
     * Writing today's library into the snapshot **once**, now, is the opposite
     * move: from here on the row answers for itself and stops depending on the
     * catalogue at all. It is the same trade version 2 already made and
     * documented — the best information available, and the only one there is. A
     * row whose exercise gained or lost a secondary muscle before this ran
     * records today's list; undetectable, and no worse than the nothing it
     * replaces.
     *
     * Only rows that were already snapshotted are touched. A row with no
     * snapshot at all keeps falling through to the library as a whole, which is
     * what `resolveExerciseIdentity` expects of it.
     */
    this.version(4).upgrade(async (tx) => {
      const exercises = await tx.table<Exercise>('exercises').toArray();
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

      await tx
        .table<WorkoutExercise>('workoutExercises')
        .toCollection()
        .modify((row) => {
          if (row.exercisePrimaryMuscle === undefined) return;
          const secondaries = byId.get(row.exerciseId)?.secondaryMuscles ?? [];
          if (secondaries.length > 0) row.exerciseSecondaryMuscles = [...secondaries];
        });
    });

    // Lot 18 — journal of coach recommendations (signals the user saw).
    // Incremental stores declaration: only the new table is listed.
    this.version(5).stores({
      coachRecommendations:
        'id, exerciseId, status, [exerciseId+status], recommendedAt, deletedAt',
    });
  }
}

export const db = new FitTrackDB();
