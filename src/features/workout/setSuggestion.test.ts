import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/data/types';
import { suggestedNumber, suggestionAbove } from './setSuggestion';

const base: WorkoutSet = {
  id: 's',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  workoutExerciseId: 'row',
  exerciseId: 'exercise',
  workoutId: 'workout',
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 0,
  performedAt: 0,
};

const make = (patch: Partial<WorkoutSet>): WorkoutSet => ({ ...base, ...patch });
const done = (weight: number, reps: number, patch: Partial<WorkoutSet> = {}): WorkoutSet =>
  make({ weight, reps, isCompleted: 1, performedAt: 10, ...patch });

describe('suggestionAbove — la série validée juste au-dessus', () => {
  it('rend la série de travail validée juste au-dessus', () => {
    const first = done(60, 8, { id: 'a' });
    expect(suggestionAbove([first, make({ id: 'b', order: 1 })], 1)).toBe(first);
  });

  it('ne rend rien pour la première série', () => {
    expect(suggestionAbove([make({ id: 'a' })], 0)).toBeUndefined();
  });

  it('ne rend rien quand la série du dessus n’est pas validée : on ne suggère que ce qui a été fait', () => {
    const sets = [
      done(60, 8, { id: 'a' }),
      make({ id: 'b', order: 1, weight: 62.5 }),
      make({ id: 'c', order: 2 }),
    ];
    expect(suggestionAbove(sets, 2)).toBeUndefined();
  });

  it('saute un échauffement pour remonter à la série de travail', () => {
    const work = done(100, 5, { id: 'a' });
    const warmup = done(40, 5, { id: 'w', order: 1, setType: 'warmup' });
    expect(suggestionAbove([work, warmup, make({ id: 'c', order: 2 })], 2)).toBe(work);
  });

  it('ne fait jamais d’un échauffement la suggestion d’une série de travail', () => {
    const sets = [done(40, 5, { id: 'w', setType: 'warmup' }), make({ id: 'b', order: 1 })];
    expect(suggestionAbove(sets, 1)).toBeUndefined();
  });

  it('ne suggère rien à un échauffement : il garde la séance précédente', () => {
    const sets = [
      done(40, 5, { id: 'w1', setType: 'warmup' }),
      make({ id: 'w2', setType: 'warmup' }),
    ];
    expect(suggestionAbove(sets, 1)).toBeUndefined();
  });
});

describe('suggestedNumber — l’ordre de priorité du grisé', () => {
  const lastTime = done(55, 10, { id: 'last' });
  const above = done(60, 8, { id: 'above' });

  it('préfère la série du dessus à la séance précédente', () => {
    const set = make({ id: 'b' });
    expect(suggestedNumber(set, 'weight', { above, previous: lastTime })).toBe(60);
    expect(suggestedNumber(set, 'reps', { above, previous: lastTime })).toBe(8);
  });

  it('retombe sur la séance précédente sans série du dessus', () => {
    const set = make({ id: 'b' });
    expect(suggestedNumber(set, 'weight', { previous: lastTime })).toBe(55);
  });

  it('ne suggère rien sans l’une ni l’autre', () => {
    expect(suggestedNumber(make({}), 'weight', {})).toBeUndefined();
  });

  it('ne mélange pas deux sources : une série du dessus au poids du corps ne reprend pas la charge d’avant', () => {
    const bodyweight = done(0, 12, { weight: undefined });
    expect(
      suggestedNumber(make({}), 'weight', { above: bodyweight, previous: lastTime }),
    ).toBeUndefined();
    expect(suggestedNumber(make({}), 'reps', { above: bodyweight, previous: lastTime })).toBe(12);
  });

  it('laisse la prescription du jour passer devant', () => {
    const set = make({ targetWeight: 70, targetReps: 6 });
    expect(suggestedNumber(set, 'weight', { above, previous: lastTime })).toBe(70);
    expect(suggestedNumber(set, 'reps', { above, previous: lastTime })).toBe(6);
  });

  it('une fourchette n’est pas un chiffre : les répétitions viennent de la série du dessus', () => {
    const set = make({ targetReps: 5, targetRepsMax: 8 });
    expect(suggestedNumber(set, 'reps', { above, previous: lastTime })).toBe(8);
  });

  it('à l’échec, les répétitions ne sont jamais suggérées', () => {
    expect(
      suggestedNumber(make({}), 'reps', { above, previous: lastTime, amrap: true }),
    ).toBeUndefined();
    expect(suggestedNumber(make({}), 'weight', { above, previous: lastTime, amrap: true })).toBe(
      60,
    );
  });
});
