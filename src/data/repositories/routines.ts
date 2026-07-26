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
  RoutineDetail,
  RoutineExerciseDetail,
  RoutineSummary,
} from './routineLifecycle';

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
