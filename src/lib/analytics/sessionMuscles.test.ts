import { describe, expect, it } from 'vitest';
import { sessionMuscleCounts } from './sessionMuscles';

const set = (setType: 'normal' | 'warmup', isCompleted: 0 | 1) => ({ setType, isCompleted });
const done = () => set('normal', 1);

describe('sessionMuscleCounts', () => {
  it('counts the recorded working sets of each muscle', () => {
    expect(
      sessionMuscleCounts([
        { primaryMuscle: 'chest', sets: [done(), done(), done()] },
        { primaryMuscle: 'triceps', sets: [done()] },
      ]),
    ).toEqual([
      { muscle: 'chest', sets: 3 },
      { muscle: 'triceps', sets: 1 },
    ]);
  });

  // The recap is read while the last set is still on the grid: counting what is
  // not done yet would light a muscle for work that has not happened.
  it('ignores the sets that are not recorded', () => {
    expect(
      sessionMuscleCounts([
        { primaryMuscle: 'quads', sets: [done(), set('normal', 0), set('normal', 0)] },
      ]),
    ).toEqual([{ muscle: 'quads', sets: 1 }]);
  });

  it('ignores warm-ups — RF-20', () => {
    expect(
      sessionMuscleCounts([{ primaryMuscle: 'lats', sets: [set('warmup', 1), done()] }]),
    ).toEqual([{ muscle: 'lats', sets: 1 }]);
  });

  it('adds up an exercise picked up twice in the same session', () => {
    expect(
      sessionMuscleCounts([
        { primaryMuscle: 'chest', sets: [done(), done()] },
        { primaryMuscle: 'chest', sets: [done()] },
      ]),
    ).toEqual([{ muscle: 'chest', sets: 3 }]);
  });

  it('drops a line whose sets are all still to come', () => {
    expect(
      sessionMuscleCounts([
        { primaryMuscle: 'chest', sets: [done()] },
        { primaryMuscle: 'calves', sets: [set('normal', 0)] },
      ]),
    ).toEqual([{ muscle: 'chest', sets: 1 }]);
  });

  // A deleted catalogue row with no snapshot resolves to no muscle at all. It is
  // counted, so the total stays honest, and the drawing ignores it.
  it('keeps an unresolved muscle rather than dropping the work', () => {
    expect(sessionMuscleCounts([{ primaryMuscle: undefined, sets: [done()] }])).toEqual([
      { muscle: undefined, sets: 1 },
    ]);
  });
});
