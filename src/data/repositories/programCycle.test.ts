import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import type { Program, Routine } from '@/data/types';
import { resolveSchedule } from '@/lib/programs';
import { resetDb } from '@/test/resetDb';
import { recordCoachSignals } from './coachRecommendations';
import { getHomeDashboard } from './home';
import { createCustomExercise } from './exercises';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  getActiveProgramDetail,
  getProgramDetail,
  replaceMissingProgramRoutine,
  replaceProgramWeeks,
} from './programs';
import { startWorkoutFromProgram } from './programWorkout';
import { addExercisesToRoutine, createRoutine, deleteRoutine } from './routines';

/**
 * Un split sur plusieurs semaines, côté dépôt.
 *
 * Le cas qui l'a fait écrire : quatre séances « haut / bas » une semaine, six
 * « push / pull / jambes » la suivante — dix séances sur un cycle de deux
 * semaines, que la semaine unique répétée d'un split ne sait pas dire.
 */

const MONDAY = new Date(2026, 7, 10, 12).getTime();
const NEXT_MONDAY = new Date(2026, 7, 17, 12).getTime();
const MONDAY_AFTER = new Date(2026, 7, 24, 12).getTime();

const weeks = Array.from({ length: 4 }, (_, weekIndex) => ({
  weekIndex,
  loadIndex: 100,
  phase: 'construction' as const,
}));

async function routineWithExercise(name: string): Promise<Routine> {
  const exercise = await createCustomExercise({
    name: `${name} — mouvement`,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  const routine = await createRoutine(name);
  await addExercisesToRoutine(routine.id, [exercise.id]);
  return routine;
}

interface TwoWeekFixture {
  program: Program;
  routines: Record<'upperA' | 'lowerA' | 'push' | 'pull' | 'legs', Routine>;
}

/** Semaine 1 du cycle : haut / bas. Semaine 2 : push / pull / jambes. */
async function draftTwoWeekProgram(): Promise<TwoWeekFixture> {
  const routines = {
    upperA: await routineWithExercise('UPPER A'),
    lowerA: await routineWithExercise('LOWER A'),
    push: await routineWithExercise('PUSH A'),
    pull: await routineWithExercise('PULL A'),
    legs: await routineWithExercise('LEGS A'),
  };
  const program = await createProgramDraft({
    name: 'Haut / bas puis PPL',
    startsAt: MONDAY,
    durationWeeks: 4,
  });
  await replaceProgramWeeks(program.id, weeks);
  await createScheduleRevision(
    program.id,
    0,
    [
      { routineId: routines.upperA.id, dayOfWeek: 1, order: 0, cycleWeek: 0 },
      { routineId: routines.lowerA.id, dayOfWeek: 2, order: 0, cycleWeek: 0 },
      { routineId: routines.push.id, dayOfWeek: 1, order: 0, cycleWeek: 1 },
      { routineId: routines.pull.id, dayOfWeek: 2, order: 0, cycleWeek: 1 },
      { routineId: routines.legs.id, dayOfWeek: 3, order: 0, cycleWeek: 1 },
    ],
    2,
  );
  return { program, routines };
}

const routineIdsAt = async (at: number) =>
  (await getActiveProgramDetail(at))?.resolvedEntries.map((entry) => entry.routineId);

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

describe('a program whose split spans two weeks', () => {
  it('stores the length of the cycle on the revision and the week on each session', async () => {
    const { program, routines } = await draftTwoWeekProgram();

    const detail = await getProgramDetail(program.id);

    expect(detail?.revisions).toHaveLength(1);
    expect(detail?.revisions[0]?.revision.cycleWeeks).toBe(2);
    expect(
      detail?.revisions[0]?.entries.map(({ routineId, cycleWeek }) => [routineId, cycleWeek]),
    ).toEqual([
      [routines.upperA.id, 0],
      [routines.lowerA.id, 0],
      [routines.push.id, 1],
      [routines.pull.id, 1],
      [routines.legs.id, 1],
    ]);
  });

  it('keeps writing a one-week split when no cycle length is given', async () => {
    const routine = await routineWithExercise('Full body');
    const program = await createProgramDraft({ name: 'Hebdo', startsAt: MONDAY, durationWeeks: 4 });

    const revision = await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);

    expect(revision.cycleWeeks).toBe(1);
    const [entry] = await db.programScheduleEntries.where('revisionId').equals(revision.id).toArray();
    expect(entry?.cycleWeek).toBe(0);
  });

  it('plays the sessions of the right week, week after week', async () => {
    const { program, routines } = await draftTwoWeekProgram();
    await activateProgram(program.id);

    expect(await routineIdsAt(MONDAY)).toEqual([routines.upperA.id, routines.lowerA.id]);
    expect(await routineIdsAt(NEXT_MONDAY)).toEqual([
      routines.push.id,
      routines.pull.id,
      routines.legs.id,
    ]);
    expect(await routineIdsAt(MONDAY_AFTER)).toEqual([routines.upperA.id, routines.lowerA.id]);
  });

  it('starts a session of the current week, and refuses one of the other week', async () => {
    const { program, routines } = await draftTwoWeekProgram();
    await activateProgram(program.id);
    const entries = await db.programScheduleEntries.toArray();
    const entryFor = (routineId: string) => entries.find((entry) => entry.routineId === routineId)!;

    await expect(
      startWorkoutFromProgram({
        programId: program.id,
        programScheduleEntryId: entryFor(routines.push.id).id,
        at: MONDAY,
      }),
    ).rejects.toMatchObject({ code: 'program_invalid' });
    expect(await db.workouts.count()).toBe(0);

    const { workout } = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entryFor(routines.push.id).id,
      at: NEXT_MONDAY,
    });
    expect(workout).toMatchObject({
      programId: program.id,
      programWeekIndex: 1,
      programScheduleEntryId: entryFor(routines.push.id).id,
    });
  });

  it('proposes on the home screen the session of the current week of the cycle', async () => {
    const { program, routines } = await draftTwoWeekProgram();
    await activateProgram(program.id);

    vi.spyOn(Date, 'now').mockReturnValue(MONDAY);
    expect((await getHomeDashboard()).activeProgram?.pick).toMatchObject({
      kind: 'session',
      rule: 'today',
      routineId: routines.upperA.id,
    });

    // La semaine suivante, lundi n'est plus le même lundi.
    vi.spyOn(Date, 'now').mockReturnValue(NEXT_MONDAY);
    expect((await getHomeDashboard()).activeProgram?.pick).toMatchObject({
      kind: 'session',
      rule: 'today',
      routineId: routines.push.id,
    });
  });

  it('refuses to activate when a routine of the second week is gone', async () => {
    const { program, routines } = await draftTwoWeekProgram();
    await deleteRoutine(routines.legs.id);

    await expect(activateProgram(program.id)).rejects.toMatchObject({ code: 'routine_missing' });
    expect((await db.programs.get(program.id))?.status).toBe('draft');
  });

  it('supersedes pending load proposals for exercises of every week of the cycle', async () => {
    const { program, routines } = await draftTwoWeekProgram();
    const secondWeekExercises = await db.routineExercises
      .where('routineId')
      .anyOf([routines.push.id, routines.pull.id, routines.legs.id])
      .toArray();
    await recordCoachSignals(
      secondWeekExercises.map((row) => ({
        exerciseId: row.exerciseId,
        code: 'range_completed' as const,
        severity: 40,
        nextLoadKg: 100,
        evidence: [],
      })),
      { recommendedAt: 1_000 },
    );

    await activateProgram(program.id);

    const rows = await db.coachRecommendations.toArray();
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === 'superseded')).toBe(true);
  });

  it('does not treat the other week of the cycle as introduced by a rewritten split', async () => {
    // Un bloc actif n'accepte une révision que pour une semaine à venir : l'horloge
    // est posée dans sa deuxième semaine, la révision part de la troisième.
    vi.spyOn(Date, 'now').mockReturnValue(NEXT_MONDAY);
    const { program, routines } = await draftTwoWeekProgram();
    await activateProgram(program.id);
    const pushExercise = (
      await db.routineExercises.where('routineId').equals(routines.push.id).toArray()
    )[0]!;
    await recordCoachSignals(
      [
        {
          exerciseId: pushExercise.exerciseId,
          code: 'range_completed' as const,
          severity: 40,
          nextLoadKg: 100,
          evidence: [],
        },
      ],
      { recommendedAt: 2_000 },
    );

    // Même cycle, réécrit à partir de la semaine 3 : rien de nouveau n'entre.
    await createScheduleRevision(
      program.id,
      2,
      [
        { routineId: routines.upperA.id, dayOfWeek: 1, order: 0, cycleWeek: 0 },
        { routineId: routines.push.id, dayOfWeek: 1, order: 0, cycleWeek: 1 },
      ],
      2,
    );

    expect((await db.coachRecommendations.toArray())[0]?.status).toBe('pending');
  });

  it('writes a revision whose weeks may reuse the same day and order', async () => {
    const routine = await routineWithExercise('Full body');
    const program = await createProgramDraft({ name: 'Cycle', startsAt: MONDAY, durationWeeks: 4 });

    await expect(
      createScheduleRevision(
        program.id,
        0,
        [
          { routineId: routine.id, dayOfWeek: 1, order: 0, cycleWeek: 0 },
          { routineId: routine.id, dayOfWeek: 1, order: 0, cycleWeek: 1 },
        ],
        2,
      ),
    ).resolves.toMatchObject({ cycleWeeks: 2 });
  });

  it('rejects a cycle that is out of range or whose sessions do not fit in it', async () => {
    const routine = await routineWithExercise('Full body');
    const program = await createProgramDraft({ name: 'Cycle', startsAt: MONDAY, durationWeeks: 4 });
    const session = (cycleWeek: number, order = 0) => ({
      routineId: routine.id,
      dayOfWeek: 1,
      order,
      cycleWeek,
    });

    for (const cycleWeeks of [0, -1, 5, 1.5, Number.NaN]) {
      await expect(
        createScheduleRevision(program.id, 0, [session(0)], cycleWeeks),
      ).rejects.toMatchObject({ code: 'program_invalid' });
    }
    // Une séance rangée sous une semaine que le cycle n'a pas.
    await expect(createScheduleRevision(program.id, 0, [session(2)], 2)).rejects.toMatchObject({
      code: 'program_invalid',
    });
    await expect(createScheduleRevision(program.id, 0, [session(-1)], 2)).rejects.toMatchObject({
      code: 'program_invalid',
    });
    // Deux séances au même jour et au même rang d'une même semaine du cycle.
    await expect(
      createScheduleRevision(program.id, 0, [session(1), session(1)], 2),
    ).rejects.toMatchObject({ code: 'program_invalid' });
    expect((await getProgramDetail(program.id))?.revisions).toHaveLength(0);
  });

  it('repairs a missing routine without dropping the other week or shifting the cycle', async () => {
    const { program, routines } = await draftTwoWeekProgram();
    const target = (await db.programScheduleEntries.toArray()).find(
      (entry) => entry.routineId === routines.push.id,
    )!;
    const replacement = await routineWithExercise('PUSH B');
    await deleteRoutine(routines.push.id);

    // Réparée depuis la semaine 2 du bloc : celle qui jouait « push ».
    await replaceMissingProgramRoutine(program.id, 1, target.id, replacement.id);

    const detail = await getProgramDetail(program.id);
    const written = detail?.revisions.find(({ revision }) => revision.effectiveFromWeekIndex === 1);
    expect(written?.revision.cycleWeeks).toBe(2);
    expect(written?.entries).toHaveLength(5);

    const rewritten = detail!.revisions.map(({ revision }) => revision);
    const rewrittenEntries = detail!.revisions.flatMap(({ entries }) => entries);
    const routineIdsOfWeek = (weekIndex: number) =>
      resolveSchedule(rewritten, rewrittenEntries, weekIndex).map((entry) => entry.routineId);

    // La semaine 1 du bloc est antérieure à la réparation : elle ne bouge pas.
    expect(routineIdsOfWeek(0)).toEqual([routines.upperA.id, routines.lowerA.id]);
    // À partir de la semaine 2, le cycle continue là où il en était.
    expect(routineIdsOfWeek(1)).toEqual([replacement.id, routines.pull.id, routines.legs.id]);
    expect(routineIdsOfWeek(2)).toEqual([routines.upperA.id, routines.lowerA.id]);
    expect(routineIdsOfWeek(3)).toEqual([replacement.id, routines.pull.id, routines.legs.id]);
  });
});
