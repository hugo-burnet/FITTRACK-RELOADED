import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Program, Workout } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { createCustomExercise } from './exercises';
import { recordCoachSignals } from './coachRecommendations';
import { addExercisesToRoutine, createRoutine } from './routines';
import {
  ProgramRepositoryError,
  activateProgram,
  completeProgram,
  createProgramDraft,
  createScheduleRevision,
  deleteProgram,
  getActiveProgramDetail,
  getProgramDetail,
  listPrograms,
  replaceProgramWeeks,
  shiftProgram,
  updateProgramDraft,
} from './programs';

const MONDAY = new Date(2026, 7, 10, 0, 0, 0, 0).getTime();

function week(weekIndex: number, prescriptionValue = 75) {
  return {
    weekIndex,
    prescriptionKind: 'percent_1rm' as const,
    prescriptionValue,
    isDeload: 0 as const,
  };
}

async function createReadyProgram(
  name: string,
  startsAt = MONDAY,
): Promise<{ program: Program; routineId: string; entryId: string }> {
  const routine = await createRoutine(`${name} routine`);
  const program = await createProgramDraft({ name, startsAt, durationWeeks: 4 });
  await replaceProgramWeeks(program.id, [week(0), week(1), week(2), week(3)]);
  const revision = await createScheduleRevision(program.id, 0, [
    { routineId: routine.id, dayOfWeek: 1, order: 0 },
    { routineId: routine.id, dayOfWeek: 4, order: 1 },
  ]);
  const entry = await db.programScheduleEntries.where('revisionId').equals(revision.id).first();
  if (entry === undefined) throw new Error('schedule fixture missing');
  return { program, routineId: routine.id, entryId: entry.id };
}

beforeEach(resetDb);

describe('program lifecycle repository', () => {
  it('creates a live draft and lists it through a summary projection', async () => {
    const program = await createProgramDraft({
      name: 'Force',
      startsAt: MONDAY,
      durationWeeks: 8,
    });

    expect(program).toMatchObject({
      name: 'Force',
      startsAt: MONDAY,
      durationWeeks: 8,
      status: 'draft',
      deletedAt: 0,
    });
    expect(program.id).not.toBe('');
    expect(await listPrograms()).toEqual([{ program }]);
  });

  it('returns null, not undefined, when program detail is absent', async () => {
    expect(await getProgramDetail('missing')).toBeNull();
  });

  it('updates persisted basics only while the program is a draft', async () => {
    const draft = await createProgramDraft({ name: 'Force', startsAt: MONDAY, durationWeeks: 8 });
    const nextMonday = new Date(2026, 7, 17).getTime();

    await updateProgramDraft(draft.id, {
      name: 'Force durable',
      startsAt: nextMonday,
      durationWeeks: 10,
    });

    expect((await getProgramDetail(draft.id))?.program).toMatchObject({
      name: 'Force durable',
      startsAt: nextMonday,
      durationWeeks: 10,
      status: 'draft',
    });

    const ready = await createReadyProgram('Active');
    await activateProgram(ready.program.id);
    await expect(
      updateProgramDraft(ready.program.id, {
        name: 'Rewritten',
        startsAt: nextMonday,
        durationWeeks: 6,
      }),
    ).rejects.toMatchObject({ code: 'program_invalid' });
  });

  it('rejects activation outside the four-to-twelve-week range', async () => {
    const routine = await createRoutine('Full body');
    const program = await createProgramDraft({
      name: 'Too short',
      startsAt: MONDAY,
      durationWeeks: 3,
    });
    await replaceProgramWeeks(program.id, [week(0), week(1), week(2)]);
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);

    await expect(activateProgram(program.id)).rejects.toMatchObject({
      code: 'program_invalid',
    } satisfies Partial<ProgramRepositoryError>);
  });

  it('allows only one live active program', async () => {
    const first = await createReadyProgram('First');
    const second = await createReadyProgram('Second');

    await activateProgram(first.program.id);

    await expect(activateProgram(second.program.id)).rejects.toMatchObject({
      code: 'another_program_active',
    } satisfies Partial<ProgramRepositoryError>);
    expect((await db.programs.get(second.program.id))?.status).toBe('draft');
  });

  it('reports a missing routine and leaves the program draft', async () => {
    const fixture = await createReadyProgram('Broken');
    const deleted = Date.now();
    await db.routines.update(fixture.routineId, { deletedAt: deleted, updatedAt: deleted });

    await expect(activateProgram(fixture.program.id)).rejects.toMatchObject({
      code: 'routine_missing',
    } satisfies Partial<ProgramRepositoryError>);
    expect((await db.programs.get(fixture.program.id))?.status).toBe('draft');
  });

  it('completes an active program without deleting its data', async () => {
    const { program } = await createReadyProgram('Block');
    await activateProgram(program.id);

    await completeProgram(program.id);

    expect((await getProgramDetail(program.id))?.program.status).toBe('completed');
    expect(await getActiveProgramDetail(MONDAY)).toBeNull();
  });

  it('rejects invalid lifecycle transitions', async () => {
    const { program } = await createReadyProgram('Lifecycle');

    await expect(completeProgram(program.id)).rejects.toMatchObject({
      code: 'program_invalid',
    } satisfies Partial<ProgramRepositoryError>);
    await activateProgram(program.id);
    await completeProgram(program.id);
    await expect(activateProgram(program.id)).rejects.toMatchObject({
      code: 'program_invalid',
    } satisfies Partial<ProgramRepositoryError>);
  });

  it('supersedes pending load proposals for every exercise in the initial split', async () => {
    const exercises = await Promise.all(
      ['Bench', 'Row'].map((name) =>
        createCustomExercise({
          name,
          primaryMuscle: 'chest',
          secondaryMuscles: [],
          equipment: 'barbell',
          measurementType: 'weight_reps',
          isUnilateral: 0,
        }),
      ),
    );
    const routine = await createRoutine('Coach authority routine');
    await addExercisesToRoutine(routine.id, exercises.map((exercise) => exercise.id));
    const program = await createProgramDraft({
      name: 'Coach authority',
      startsAt: MONDAY,
      durationWeeks: 4,
    });
    await replaceProgramWeeks(program.id, [week(0), week(1), week(2), week(3)]);
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await recordCoachSignals(
      exercises.map((exercise, index) => ({
        exerciseId: exercise.id,
        code: 'range_completed' as const,
        severity: 40,
        nextLoadKg: 100 + index * 10,
        evidence: [],
      })),
      { recommendedAt: 1_000 },
    );

    await activateProgram(program.id);

    const rows = await db.coachRecommendations.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === 'superseded')).toBe(true);
    expect(rows.every((row) => row.resolvedAt !== undefined)).toBe(true);
  });
});

describe('program weeks and schedules', () => {
  it('replaces the complete week set and returns it ordered', async () => {
    const program = await createProgramDraft({ name: 'Volume', startsAt: MONDAY, durationWeeks: 4 });
    await replaceProgramWeeks(program.id, [week(2, 80), week(0, 70), week(1, 75), week(3, 60)]);

    await replaceProgramWeeks(program.id, [
      week(3, 65),
      week(1, 77.5),
      week(0, 72.5),
      { ...week(2, 60), isDeload: 1 },
    ]);

    const detail = await getProgramDetail(program.id);
    expect(detail?.weeks.map((row) => [row.weekIndex, row.prescriptionValue, row.isDeload])).toEqual([
      [0, 72.5, 0],
      [1, 77.5, 0],
      [2, 60, 1],
      [3, 65, 0],
    ]);
    const stored = await db.programWeeks.where('programId').equals(program.id).toArray();
    expect(stored.filter((row) => row.deletedAt === 0)).toHaveLength(4);
    expect(stored.filter((row) => row.deletedAt !== 0)).toHaveLength(4);
  });

  it('rejects an incomplete or duplicate week replacement without touching the live set', async () => {
    const program = await createProgramDraft({ name: 'Safe', startsAt: MONDAY, durationWeeks: 4 });
    await replaceProgramWeeks(program.id, [week(0), week(1), week(2), week(3)]);

    await expect(
      replaceProgramWeeks(program.id, [week(0, 60), week(1, 65), week(1, 70), week(3, 75)]),
    ).rejects.toMatchObject({ code: 'program_invalid' } satisfies Partial<ProgramRepositoryError>);

    const detail = await getProgramDetail(program.id);
    expect(detail?.weeks.map((row) => [row.weekIndex, row.prescriptionValue])).toEqual([
      [0, 75],
      [1, 75],
      [2, 75],
      [3, 75],
    ]);
  });

  it('stores a full revision and atomically replaces the same effective week', async () => {
    const firstRoutine = await createRoutine('Push');
    const secondRoutine = await createRoutine('Pull');
    const program = await createProgramDraft({ name: 'Split', startsAt: MONDAY, durationWeeks: 4 });

    const firstRevision = await createScheduleRevision(program.id, 0, [
      { routineId: firstRoutine.id, dayOfWeek: 1, order: 0 },
      { routineId: secondRoutine.id, dayOfWeek: 3, order: 1 },
    ]);
    const replacement = await createScheduleRevision(program.id, 0, [
      { routineId: secondRoutine.id, dayOfWeek: 2, order: 0 },
    ]);

    const detail = await getProgramDetail(program.id);
    expect(detail?.revisions).toHaveLength(1);
    expect(detail?.revisions[0]?.revision.id).toBe(replacement.id);
    expect(detail?.revisions[0]?.entries.map((entry) => entry.routineId)).toEqual([
      secondRoutine.id,
    ]);

    const oldRevision = await db.programScheduleRevisions.get(firstRevision.id);
    const oldEntries = await db.programScheduleEntries
      .where('revisionId')
      .equals(firstRevision.id)
      .toArray();
    expect(oldRevision?.deletedAt).not.toBe(0);
    expect(oldEntries.every((entry) => entry.deletedAt !== 0)).toBe(true);
    const livingAtZero = (
      await db.programScheduleRevisions
        .where('[programId+effectiveFromWeekIndex]')
        .equals([program.id, 0])
        .toArray()
    ).filter((revision) => revision.deletedAt === 0);
    expect(livingAtZero).toHaveLength(1);
  });

  it('rejects a revision earlier than the latest effective revision', async () => {
    const routine = await createRoutine('Upper');
    const program = await createProgramDraft({ name: 'Wave', startsAt: MONDAY, durationWeeks: 8 });
    await createScheduleRevision(program.id, 3, [
      { routineId: routine.id, dayOfWeek: 2, order: 0 },
    ]);

    await expect(
      createScheduleRevision(program.id, 2, [
        { routineId: routine.id, dayOfWeek: 2, order: 0 },
      ]),
    ).rejects.toMatchObject({
      code: 'retroactive_revision',
    } satisfies Partial<ProgramRepositoryError>);
  });

  it('keeps completed program revisions immutable', async () => {
    const { program, routineId } = await createReadyProgram('Finished');
    await activateProgram(program.id);
    await completeProgram(program.id);
    const before = await getProgramDetail(program.id);

    await expect(
      createScheduleRevision(program.id, 0, [{ routineId, dayOfWeek: 5, order: 0 }]),
    ).rejects.toMatchObject({ code: 'retroactive_revision' } satisfies Partial<ProgramRepositoryError>);
    await expect(
      createScheduleRevision(program.id, 2, [{ routineId, dayOfWeek: 5, order: 0 }]),
    ).rejects.toMatchObject({ code: 'retroactive_revision' } satisfies Partial<ProgramRepositoryError>);
    await expect(
      replaceProgramWeeks(program.id, [week(0, 60), week(1, 65), week(2, 70), week(3, 75)]),
    ).rejects.toMatchObject({ code: 'program_invalid' } satisfies Partial<ProgramRepositoryError>);

    expect(await getProgramDetail(program.id)).toEqual(before);
  });

  it('serializes concurrent same-week writes into one live revision', async () => {
    const firstRoutine = await createRoutine('A');
    const secondRoutine = await createRoutine('B');
    const program = await createProgramDraft({ name: 'Concurrent', startsAt: MONDAY, durationWeeks: 4 });

    await Promise.all([
      createScheduleRevision(program.id, 0, [
        { routineId: firstRoutine.id, dayOfWeek: 1, order: 0 },
      ]),
      createScheduleRevision(program.id, 0, [
        { routineId: secondRoutine.id, dayOfWeek: 2, order: 0 },
      ]),
    ]);

    expect((await getProgramDetail(program.id))?.revisions).toHaveLength(1);
  });
});

describe('program projections and deletion', () => {
  it('matches completed sessions from their persisted program context', async () => {
    const { program, entryId } = await createReadyProgram('Strength');
    await activateProgram(program.id);
    const completed = newEntity<Workout>({
      routineId: 'renamed-or-deleted-routine',
      name: 'Historical snapshot',
      status: 'completed',
      startedAt: MONDAY + 3_600_000,
      endedAt: MONDAY + 7_200_000,
      durationSeconds: 3_600,
      programId: program.id,
      programWeekIndex: 0,
      programScheduleEntryId: entryId,
    });
    await db.workouts.add(completed);

    const active = await getActiveProgramDetail(MONDAY);

    expect(active?.position).toEqual({ phase: 'active', weekIndex: 0, dayOfWeek: 1 });
    expect(active?.resolvedEntries).toHaveLength(2);
    expect(active?.completedWorkouts).toEqual([completed]);
  });

  it('shifts only the program civil start date and never rewrites workouts', async () => {
    const { program, routineId, entryId } = await createReadyProgram('Shifted');
    const historical = newEntity<Workout>({
      routineId,
      name: 'Already done',
      status: 'completed',
      startedAt: MONDAY,
      endedAt: MONDAY + 1_000,
      durationSeconds: 1,
      programId: program.id,
      programWeekIndex: 0,
      programScheduleEntryId: entryId,
    });
    await db.workouts.add(historical);

    await shiftProgram(program.id, 7);

    expect((await db.programs.get(program.id))?.startsAt).toBe(
      new Date(2026, 7, 17, 0, 0, 0, 0).getTime(),
    );
    expect(await db.workouts.get(historical.id)).toEqual(historical);
  });

  it('soft-deletes only the program graph, preserving routines and workouts', async () => {
    const { program, routineId, entryId } = await createReadyProgram('Deleted');
    const workout = newEntity<Workout>({
      routineId,
      name: 'Kept history',
      status: 'completed',
      startedAt: MONDAY,
      endedAt: MONDAY + 1_000,
      durationSeconds: 1,
      programId: program.id,
      programWeekIndex: 0,
      programScheduleEntryId: entryId,
    });
    await db.workouts.add(workout);

    await deleteProgram(program.id);

    expect(await getProgramDetail(program.id)).toBeNull();
    expect(await listPrograms()).toEqual([]);
    expect((await db.programWeeks.where('programId').equals(program.id).toArray()).every(
      (row) => row.deletedAt !== 0,
    )).toBe(true);
    const revisions = await db.programScheduleRevisions.where('programId').equals(program.id).toArray();
    expect(revisions.every((row) => row.deletedAt !== 0)).toBe(true);
    const entries = await db.programScheduleEntries
      .where('revisionId')
      .anyOf(revisions.map((row) => row.id))
      .toArray();
    expect(entries.every((row) => row.deletedAt !== 0)).toBe(true);
    expect((await db.routines.get(routineId))?.deletedAt).toBe(0);
    expect((await db.workouts.get(workout.id))?.deletedAt).toBe(0);
  });
});
