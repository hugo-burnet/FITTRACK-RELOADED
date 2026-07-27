import { describe, expect, it } from 'vitest';
import {
  INITIAL_WORKOUT_FOLD_COMMAND,
  nextWorkoutFoldCommand,
} from './workoutFold';

describe('nextWorkoutFoldCommand', () => {
  it('replie puis déplie toutes les cartes', () => {
    const collapsed = nextWorkoutFoldCommand(
      INITIAL_WORKOUT_FOLD_COMMAND,
    );
    const expanded = nextWorkoutFoldCommand(collapsed);

    expect(collapsed).toEqual({ version: 1, expanded: false });
    expect(expanded).toEqual({ version: 2, expanded: true });
  });
});
