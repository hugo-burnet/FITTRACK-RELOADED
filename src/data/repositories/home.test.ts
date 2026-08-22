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
import { setRoutineFolderContext } from './settings';
import { createFolder, createRoutine, deleteFolder } from './routines';

const AT = Date.UTC(2026, 6, 20);
const MONDAY = new Date(2026, 7, 10, 0, 0, 0, 0).getTime();

const programWeeks = Array.from({ length: 4 }, (_, weekIndex) => ({
  weekIndex,
  loadIndex: 100,
  phase: 'construction' as const,
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

  it('keeps the global suggestion when no folder exists', async () => {
    const push = await createRoutine('Push');

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext).toEqual({ required: false, selected: null, options: [] });
    expect(dashboard.suggestedRoutine?.routineId).toBe(push.id);
  });

  it('offers folders and root, then scopes the suggestion to the chosen folder', async () => {
    const root = await createRoutine('Libre');
    const folder = await createFolder('Salle');
    const inside = await createRoutine('Push salle', folder.id);
    await setRoutineFolderContext({ kind: 'folder', folderId: folder.id });

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext.options.map(({ value }) => value)).toEqual([
      `folder:${folder.id}`,
      'root',
    ]);
    expect(dashboard.routineContext.options.at(-1)).toEqual({
      value: 'root',
      routineCount: 1,
    });
    expect(dashboard.routineContext.selected).toBe(`folder:${folder.id}`);
    expect(dashboard.suggestedRoutine?.routineId).toBe(inside.id);
    expect(dashboard.suggestedRoutine?.routineId).not.toBe(root.id);
  });

  it('requires a routine context when folders exist without a saved choice', async () => {
    const folder = await createFolder('Salle');
    await createRoutine('Push salle', folder.id);

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext).toMatchObject({ required: true, selected: null });
    expect(dashboard.suggestedRoutine).toBeNull();
  });

  it('does not fall back when the selected folder has no routines', async () => {
    await createRoutine('Libre');
    const emptyFolder = await createFolder('Vide');
    await setRoutineFolderContext({ kind: 'folder', folderId: emptyFolder.id });

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext).toMatchObject({
      required: false,
      selected: `folder:${emptyFolder.id}`,
    });
    expect(dashboard.suggestedRoutine).toBeNull();
  });

  it('invalidates a saved context for a deleted folder when another folder remains', async () => {
    const folder = await createFolder('Salle');
    const survivingFolder = await createFolder('Maison');
    await createRoutine('Push salle', folder.id);
    await setRoutineFolderContext({ kind: 'folder', folderId: folder.id });
    await deleteFolder(folder.id);

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext).toMatchObject({
      required: true,
      selected: null,
      options: expect.arrayContaining([
        expect.objectContaining({ value: `folder:${survivingFolder.id}` }),
      ]),
    });
    expect(dashboard.suggestedRoutine).toBeNull();
  });

  it('falls back to the global suggestion when a saved folder is the last one deleted', async () => {
    const folder = await createFolder('Salle');
    const routine = await createRoutine('Push salle', folder.id);
    await setRoutineFolderContext({ kind: 'folder', folderId: folder.id });
    await deleteFolder(folder.id);

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext).toEqual({ required: false, selected: null, options: [] });
    expect(dashboard.suggestedRoutine?.routineId).toBe(routine.id);
  });

  it('omits root from contexts when it has no routines', async () => {
    const folder = await createFolder('Salle');
    await createRoutine('Push salle', folder.id);

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext.options.map(({ value }) => value)).toEqual([
      `folder:${folder.id}`,
    ]);
  });

  it('keeps the active program projection while a folder context is required', async () => {
    await createFolder('Salle');
    const { program } = await seedProgram();

    const dashboard = await getHomeDashboard();

    expect(dashboard.routineContext.required).toBe(true);
    expect(dashboard.activeProgram?.programId).toBe(program.id);
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
        loadIndex: 100,
        phase: 'construction',
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
