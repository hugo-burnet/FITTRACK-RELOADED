import { describe, expect, it } from 'vitest';
import { SECONDARY_SHARE, muscleInvolvement } from './involvement';

const set = (setType: 'normal' | 'warmup', isCompleted: 0 | 1) => ({ setType, isCompleted });
const done = () => set('normal', 1);

describe('muscleInvolvement', () => {
  it('credits one per working set to the muscle a set targets', () => {
    expect(
      muscleInvolvement([
        { primaryMuscle: 'chest', sets: [done(), done(), done()] },
        { primaryMuscle: 'triceps', sets: [done()] },
      ]),
    ).toEqual([
      { muscle: 'chest', value: 3 },
      { muscle: 'triceps', value: 1 },
    ]);
  });

  // The whole point of the snapshot change: a bench press that leaves the
  // triceps dark is false to what happened.
  it('credits a share to the muscles a set merely involves', () => {
    expect(
      muscleInvolvement([
        {
          primaryMuscle: 'chest',
          secondaryMuscles: ['triceps', 'shoulders'],
          sets: [done(), done()],
        },
      ]),
    ).toEqual([
      { muscle: 'chest', value: 2 },
      { muscle: 'triceps', value: 2 * SECONDARY_SHARE },
      { muscle: 'shoulders', value: 2 * SECONDARY_SHARE },
    ]);
  });

  it('adds the shares an exercise gets from several others', () => {
    const involvement = muscleInvolvement([
      { primaryMuscle: 'chest', secondaryMuscles: ['triceps'], sets: [done(), done()] },
      { primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], sets: [done(), done()] },
    ]);
    expect(involvement.find((entry) => entry.muscle === 'triceps')?.value).toBeCloseTo(
      4 * SECONDARY_SHARE,
    );
  });

  // Fully credited once is enough: adding the share on top would push a muscle
  // past every other one for no reason.
  it('never pays a muscle twice when it is listed as both', () => {
    expect(
      muscleInvolvement([
        { primaryMuscle: 'quads', secondaryMuscles: ['quads', 'glutes'], sets: [done()] },
      ]),
    ).toEqual([
      { muscle: 'quads', value: 1 },
      { muscle: 'glutes', value: SECONDARY_SHARE },
    ]);
  });

  // The recap is read while the last set is still on the grid: counting what is
  // not done yet would light a muscle for work that has not happened.
  it('ignores the sets that are not recorded', () => {
    expect(
      muscleInvolvement([
        { primaryMuscle: 'quads', sets: [done(), set('normal', 0), set('normal', 0)] },
      ]),
    ).toEqual([{ muscle: 'quads', value: 1 }]);
  });

  it('ignores warm-ups — RF-20', () => {
    expect(
      muscleInvolvement([{ primaryMuscle: 'lats', sets: [set('warmup', 1), done()] }]),
    ).toEqual([{ muscle: 'lats', value: 1 }]);
  });

  it('drops a line whose sets are all still to come, secondaries included', () => {
    expect(
      muscleInvolvement([
        { primaryMuscle: 'chest', sets: [done()] },
        { primaryMuscle: 'calves', secondaryMuscles: ['hamstrings'], sets: [set('normal', 0)] },
      ]),
    ).toEqual([{ muscle: 'chest', value: 1 }]);
  });

  // A deleted catalogue row with no snapshot resolves to no muscle at all. It is
  // kept so the work does not vanish, and the drawing ignores it.
  it('keeps an unresolved muscle rather than dropping the work', () => {
    expect(muscleInvolvement([{ primaryMuscle: undefined, sets: [done()] }])).toEqual([
      { muscle: undefined, value: 1 },
    ]);
  });
});
