import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyMeasurement,
  Exercise,
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
  routineFolders!: EntityTable<RoutineFolder, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  routineSets!: EntityTable<RoutineSet, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;
  personalRecords!: EntityTable<PersonalRecord, 'id'>;
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
  }
}

export const db = new FitTrackDB();
