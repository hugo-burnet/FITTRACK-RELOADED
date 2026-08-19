export {
  countRoutinesInFolder,
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
} from './routineFolders';

export {
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  getRoutineDetail,
  listRoutineSummaries,
  reorderRoutines,
  updateRoutine,
} from './routineLifecycle';
export type {
  RoutineChanges,
  RoutineDetail,
  RoutineExerciseDetail,
  RoutineSummary,
} from './routineLifecycle';

/**
 * A plain façade again.
 *
 * Every write below used to be wrapped in `withEditableRoutine`, which reopened
 * a transaction on `programScheduleEntries` just to ask a block for permission
 * to type. A block points at a routine and the routine knows nothing of it, so
 * there is no permission left to ask — the delegated modules own their own
 * transactions, as they always did.
 */
export {
  addExercisesToRoutine,
  groupWithPrevious,
  removeRoutineExercise,
  reorderRoutineExercises,
  ungroupSuperset,
  updateRoutineExercise,
} from './routineExercises';

export {
  addRoutineSet,
  applyToAllSets,
  deleteRoutineSet,
  updateRoutineSet,
} from './routineSets';
export type { RoutineSetTargets } from './routineSets';
