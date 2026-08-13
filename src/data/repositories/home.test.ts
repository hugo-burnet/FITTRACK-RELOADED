import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type { Program, Workout } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { getHomeDashboard } from './home';
import {
  activateProgram,
  completeProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceProgramWeeks,
} from './programs';
import { createRoutine } from './routines';

const AT = Date.UTC(2026, 6, 20);
const MONDAY = new Date(2026, 7, 10, 0, 0, 0, 0).getTime();

const programWeeks = Array.from({ length: 4 }, (_, weekIndex) => ({
  weekIndex,
  prescriptionKind: 'percent_1rm' as const,
  prescriptionValue: 72.5,
  isDeload: 0 as const,
}));

async function seedProgram(startsAt = MONDAY): Promise<{
  program: Program;
  routineId: string;
  entryId: string;
}> {
  const routine = await createRoutine('Force A');
  const program = await createProgramDraft({ name: 'Bloc force', startsAt, durationWeeks: 4 });
  await replaceProgramWeeks(program.id, programWeeks);
  const revision = await createScheduleRevision(program.id, 0, [
    { routineId: routine.id, dayOfWeek: 1, order: 0 },
  ]);
  const entry = await db.programScheduleEntries.where('revisionId').equals(revision.id).first();
  if (entry === undefined) throw new Error('program entry fixture missing');
  await activateProgram(program.id);
  return { program, routineId: routine.id, entryId: entry.id };
}

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
    vi.spyOn(Date, 'now').mockReturnValue(MONDAY + 8 * 60 * 60 * 1_000);
  });

  afterEach(() => vi.restoreAllMocks());

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

  it('précalcule la séance exacte du bloc actif dans ses dates', async () => {
    const { program, routineId, entryId } = await seedProgram();

    const dashboard = await getHomeDashboard();

    expect(dashboard.activeProgram).toMatchObject({
      programId: program.id,
      programName: 'Bloc force',
      durationWeeks: 4,
      week: {
        weekIndex: 0,
        prescriptionKind: 'percent_1rm',
        prescriptionValue: 72.5,
      },
      pick: {
        kind: 'session',
        rule: 'today',
        programScheduleEntryId: entryId,
        routineId,
        routineName: 'Force A',
      },
    });
  });

  it('annonce la date d’un bloc actif à venir sans proposer de séance', async () => {
    const futureMonday = MONDAY + 14 * 86_400_000;
    const { program } = await seedProgram(futureMonday);

    const dashboard = await getHomeDashboard();

    expect(dashboard.activeProgram).toMatchObject({
      programId: program.id,
      week: { weekIndex: 0 },
      pick: {
        kind: 'announcement',
        rule: 'starts',
        startsAt: futureMonday,
        weekIndex: 0,
      },
    });
  });

  it('exclut un bloc terminé de la projection prioritaire', async () => {
    const { program } = await seedProgram();
    await completeProgram(program.id);

    expect((await getHomeDashboard()).activeProgram).toBeNull();
  });

  it('isole une routine de programme manquante sans perdre l’historique ni la régularité', async () => {
    const { routineId, entryId } = await seedProgram();
    await seedImportedWorkout('Séance conservée', AT);
    await db.routines.update(routineId, { deletedAt: MONDAY, updatedAt: MONDAY });

    const dashboard = await getHomeDashboard();

    expect(dashboard.completedWorkoutTimestamps).toEqual([AT]);
    expect(dashboard.recentWorkouts).toHaveLength(1);
    expect(dashboard.activeProgram?.pick).toMatchObject({
      kind: 'session',
      programScheduleEntryId: entryId,
      routineName: null,
    });
  });
});
