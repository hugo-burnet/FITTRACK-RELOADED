export type WorkoutFoldCommand = {
  version: number;
  expanded: boolean;
};

export const INITIAL_WORKOUT_FOLD_COMMAND: WorkoutFoldCommand = {
  version: 0,
  expanded: true,
};

export function nextWorkoutFoldCommand(
  current: WorkoutFoldCommand,
): WorkoutFoldCommand {
  return {
    version: current.version + 1,
    expanded: !current.expanded,
  };
}
