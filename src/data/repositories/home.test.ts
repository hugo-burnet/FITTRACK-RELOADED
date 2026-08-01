import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Workout } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { getHomeDashboard } from './home';
import { createRoutine } from './routines';

const AT = Date.UTC(2026, 6, 20);

/**
 * Une séance terminée écrite comme l'import Hevy l'écrit : `routineId` vide,
 * seul le titre relie la séance à la routine que l'import a fabriquée à partir
 * d'elle (`hevyWorkoutEntities` / `hevyRoutineImport`).
 */
async function seedImportedWorkout(name: string, startedAt: number): Promise<void> {
  await db.workouts.add(
    newEntity<Workout>({
      routineId: '',
      name,
      status: 'completed',
      startedAt,
      endedAt: startedAt + 3_600_000,
      durationSeconds: 3600,
      importSource: 'hevy_csv',
      importKey: `hevy_csv:${startedAt}:${name}`,
    }),
  );
}

describe('getHomeDashboard', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /**
   * Reporté du téléphone : « LOWER A — jamais réalisée » sur l'accueil, alors
   * que l'historique en était plein. Le rattachement par le nom est testé
   * unitairement dans `lib/home.test.ts` ; ce test-ci garde le câblage, c'est-à-
   * dire que le dépôt transmet bien le nom des deux côtés.
   */
  it('rattache à sa routine une séance importée qui en porte le nom', async () => {
    const routine = await createRoutine('LOWER A');
    await seedImportedWorkout('LOWER A', AT);

    const dashboard = await getHomeDashboard();

    expect(dashboard.suggestedRoutine).toMatchObject({
      routineId: routine.id,
      name: 'LOWER A',
      lastPerformedAt: AT,
    });
  });

  it('laisse « jamais réalisée » une routine dont aucune séance ne porte le nom', async () => {
    await createRoutine('LOWER A');
    await seedImportedWorkout('UPPER B', AT);

    const dashboard = await getHomeDashboard();

    expect(dashboard.suggestedRoutine).toMatchObject({ lastPerformedAt: null });
  });
});
