import { describe, expect, it } from 'vitest';
import { formatReplay, replayCoach } from './replay';
import type { CoachExerciseLine } from './types';

const day = 86_400_000;
const t0 = Date.UTC(2026, 8, 1, 18);

function session(
  exerciseId: string,
  workoutId: string,
  dayIndex: number,
  reps: number[],
  weight = 100,
): CoachExerciseLine {
  const startedAt = t0 + dayIndex * day;
  return {
    exerciseId,
    workoutId,
    workoutStartedAt: startedAt,
    measurementType: 'weight_reps',
    equipment: 'barbell',
    sets: reps.map((value, order) => ({
      setType: 'normal',
      isCompleted: 1,
      reps: value,
      weight,
      targetReps: 8,
      targetRepsMax: 12,
      performedAt: startedAt + order * 120_000,
      order,
    })),
  };
}

describe('replayCoach', () => {
  it('juge chaque séance avec les seules séances qui la précèdent', () => {
    // Dans l'ordre du temps : un plafond (→ hausse), puis deux séances sous le
    // plancher. Si la séance du jour 0 voyait celles d'après, elle serait jugée
    // comme la dernière — ce que fait le dépôt à la fin de chaque séance, et
    // qu'un rejeu ne doit justement pas faire.
    const steps = replayCoach([
      session('bench', 'w3', 14, [6, 6, 6]),
      session('bench', 'w1', 0, [12, 12, 12]),
      session('bench', 'w2', 7, [6, 6, 6]),
    ]);
    expect(steps.map((step) => step.workoutId)).toEqual(['w1', 'w2', 'w3']);
    expect(steps[0]!.shown?.code).toBe('range_ceiling_reached');
    expect(steps[1]!.signals.map((s) => s.code)).not.toContain('range_missed');
    expect(steps[2]!.shown?.code).toBe('range_missed');
  });

  it('garde les exercices indépendants', () => {
    const steps = replayCoach([
      session('bench', 'w1', 0, [12, 12, 12]),
      session('row', 'w1', 0, [10, 10, 10]),
    ]);
    const byExercise = new Map(steps.map((step) => [step.exerciseId, step.shown?.code]));
    expect(byExercise.get('bench')).toBe('range_ceiling_reached');
    expect(byExercise.get('row')).toBe('range_satisfied');
  });
});

describe('formatReplay', () => {
  it('écrit une ligne par séance sous le nom de l’exercice, avec la charge proposée', () => {
    const text = formatReplay(replayCoach([session('bench', 'w1', 0, [12, 12, 12])]), new Map([
      ['bench', 'Développé couché'],
    ]));
    expect(text).toContain('## Développé couché');
    expect(text).toContain('2026-09-01');
    expect(text).toContain('range_ceiling_reached→102.5');
    expect(text).toContain('increase_load');
  });
});
