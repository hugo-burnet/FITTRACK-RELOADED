import { describe, expect, it } from 'vitest';
import { exerciseHighlight } from './exerciseHighlight';

describe('exerciseHighlight', () => {
  it('lights the primary fully and the secondaries at the dimmer step', () => {
    expect(
      exerciseHighlight({ primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'] }),
    ).toEqual({ chest: 1, triceps: 0.4, shoulders: 0.4 });
  });

  it('never draws the same muscle twice, and keeps it primary', () => {
    expect(exerciseHighlight({ primaryMuscle: 'quads', secondaryMuscles: ['quads'] })).toEqual({
      quads: 1,
    });
  });

  it('handles an exercise with no secondaries at all', () => {
    expect(exerciseHighlight({ primaryMuscle: 'biceps' })).toEqual({ biceps: 1 });
  });

  // A stepper is filed under `cardio` and names the legs underneath. Dimming
  // them would call an afterthought the only thing the drawing has to show.
  it('promotes the secondaries when the primary cannot be drawn', () => {
    expect(
      exerciseHighlight({ primaryMuscle: 'cardio', secondaryMuscles: ['quads', 'glutes'] }),
    ).toEqual({ quads: 1, glutes: 1 });
  });

  it('lights nothing when nothing can be drawn', () => {
    expect(exerciseHighlight({ primaryMuscle: 'other', secondaryMuscles: ['full_body'] })).toEqual(
      {},
    );
  });

  // `cardio` is a filing box, not a region — it must never reach the drawing,
  // even though the card names it in the text right underneath.
  it('drops the groups that have no region', () => {
    expect(
      exerciseHighlight({ primaryMuscle: 'quads', secondaryMuscles: ['cardio', 'calves'] }),
    ).toEqual({ quads: 1, calves: 0.4 });
  });
});
