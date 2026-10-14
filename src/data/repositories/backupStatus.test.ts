import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Workout } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { countWorkoutsSince } from './backupStatus';

const DAY = 86_400_000;
const base = Date.UTC(2026, 9, 1);

function workout(overrides: Partial<Workout> & { endedAt: number }): Workout {
  return {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Séance',
      status: 'completed',
      startedAt: overrides.endedAt - 3_600_000,
      endedAt: overrides.endedAt,
      durationSeconds: 3600,
    }),
    createdAt: overrides.endedAt - 3_600_000,
    ...overrides,
  };
}

describe('countWorkoutsSince', () => {
  beforeEach(resetDb);

  it('vaut zéro sans séance', async () => {
    expect(await countWorkoutsSince(0)).toBe(0);
  });

  it('compte tout l’historique quand rien n’a jamais été sauvegardé', async () => {
    await db.workouts.bulkAdd([
      workout({ endedAt: base }),
      workout({ endedAt: base + DAY }),
      workout({ endedAt: base + 2 * DAY }),
    ]);
    expect(await countWorkoutsSince(0)).toBe(3);
  });

  it('ne compte que les séances finies après la sauvegarde', async () => {
    await db.workouts.bulkAdd([
      workout({ endedAt: base }),
      workout({ endedAt: base + DAY }),
      workout({ endedAt: base + 3 * DAY }),
      workout({ endedAt: base + 4 * DAY }),
    ]);
    expect(await countWorkoutsSince(base + 2 * DAY)).toBe(2);
  });

  it('compte une séance importée aujourd’hui même si sa date est ancienne', async () => {
    // Un import Hevy : la séance date d'il y a un an, la ligne vient d'être créée.
    await db.workouts.add(workout({ endedAt: base - 365 * DAY, createdAt: base + 3 * DAY }));
    expect(await countWorkoutsSince(base + 2 * DAY)).toBe(1);
  });

  it('ne compte pas une séance seulement réécrite après la sauvegarde', async () => {
    // Le recalcul des records touche `updatedAt` de lignes qui n'ont pas changé.
    await db.workouts.add(workout({ endedAt: base, updatedAt: base + 5 * DAY }));
    expect(await countWorkoutsSince(base + 2 * DAY)).toBe(0);
  });

  it('ignore les séances en cours, abandonnées et supprimées', async () => {
    await db.workouts.bulkAdd([
      workout({ endedAt: base + 3 * DAY, status: 'active' }),
      workout({ endedAt: base + 3 * DAY, status: 'discarded' }),
      workout({ endedAt: base + 3 * DAY, deletedAt: base + 4 * DAY }),
      workout({ endedAt: base + 3 * DAY }),
    ]);
    expect(await countWorkoutsSince(base + 2 * DAY)).toBe(1);
  });
});
