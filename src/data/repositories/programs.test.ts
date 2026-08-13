import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  replaceActiveProgram,
  replaceProgramWeeks,
  shiftProgram,
  updateProgramDraft,
} from './programs';

const MONDAY = new Date(2026, 7, 10, 0, 0, 0, 0).getTime();

function week(weekIndex: number, loadIndex = 100, phase: 'construction' | 'deload' = 'construction') {
  return {
    weekIndex,
    loadIndex,
    phase,
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

  it('atomically completes the current program and activates a confirmed draft replacement', async () => {
    const first = await createReadyProgram('First');
    const second = await createReadyProgram('Second');
    await activateProgram(first.program.id);

    await replaceActiveProgram(second.program.id);

    expect((await db.programs.get(first.program.id))?.status).toBe('completed');
    expect((await db.programs.get(second.program.id))?.status).toBe('active');
    expect(
      (await db.programs.where('status').equals('active').toArray()).filter(
        (program) => program.deletedAt === 0,
      ),
    ).toHaveLength(1);
  });

  it('rolls back active replacement when Coach supersession cannot be persisted', async () => {
    const first = await createReadyProgram('First');
    const replacementExercise = await createCustomExercise({
      name: 'Replacement bench',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const secondRoutine = await createRoutine('Second routine');
    await addExercisesToRoutine(secondRoutine.id, [replacementExercise.id]);
    const secondProgram = await createProgramDraft({
      name: 'Second',
      startsAt: MONDAY,
      durationWeeks: 4,
    });
    await replaceProgramWeeks(secondProgram.id, [week(0), week(1), week(2), week(3)]);
    await createScheduleRevision(secondProgram.id, 0, [
      { routineId: secondRoutine.id, dayOfWeek: 1, order: 0 },
    ]);
    await activateProgram(first.program.id);
    const [recommendation] = await recordCoachSignals(
      [
        {
          exerciseId: replacementExercise.id,
          code: 'range_completed' as const,
          severity: 40,
          nextLoadKg: 100,
          evidence: [],
        },
      ],
      { recommendedAt: 1_000 },
    );
    const writeRecommendations = vi
      .spyOn(db.coachRecommendations, 'bulkPut')
      .mockRejectedValueOnce(new Error('coach write failed'));

    try {
      await expect(replaceActiveProgram(secondProgram.id)).rejects.toThrow(
        'coach write failed',
      );
    } finally {
      writeRecommendations.mockRestore();
    }

    expect((await db.programs.get(first.program.id))?.status).toBe('active');
    expect((await db.programs.get(secondProgram.id))?.status).toBe('draft');
    expect((await db.coachRecommendations.get(recommendation!.id))?.status).toBe('pending');
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
      week(1, 105),
      week(0, 72),
      week(2, 60, 'deload'),
    ]);

    const detail = await getProgramDetail(program.id);
    expect(detail?.weeks.map((row) => [row.weekIndex, row.loadIndex, row.phase])).toEqual([
      [0, 72, 'construction'],
      [1, 105, 'construction'],
      [2, 60, 'deload'],
      [3, 65, 'construction'],
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
    expect(detail?.weeks.map((row) => [row.weekIndex, row.loadIndex])).toEqual([
      [0, 100],
      [1, 100],
      [2, 100],
      [3, 100],
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

  it('rejects a revision inserted into the persisted range of a program workout after a shift', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 7, 12, 12).getTime());
    try {
      const { program, routineId, entryId } = await createReadyProgram('Historical range');
      await activateProgram(program.id);
      await db.workouts.add(
        newEntity<Workout>({
          routineId,
          name: 'Persisted week two',
          status: 'completed',
          startedAt: MONDAY + 7 * 86_400_000,
          endedAt: MONDAY + 7 * 86_400_000 + 1_000,
          durationSeconds: 1,
          programId: program.id,
          programWeekIndex: 1,
          programScheduleEntryId: entryId,
        }),
      );
      await shiftProgram(program.id, 7);

      await expect(
        createScheduleRevision(program.id, 1, [
          { routineId, dayOfWeek: 2, order: 0 },
        ]),
      ).rejects.toMatchObject({
        code: 'retroactive_revision',
      } satisfies Partial<ProgramRepositoryError>);

      const detail = await getProgramDetail(program.id);
      expect(detail?.revisions).toHaveLength(1);
      expect(detail?.revisions[0]?.entries.some((entry) => entry.id === entryId)).toBe(true);
    } finally {
      now.mockRestore();
    }
  });

  it('preserves live revision and entry ids referenced by a program workout after a shift', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 7, 12, 12).getTime());
    try {
      const { program, routineId, entryId } = await createReadyProgram('Historical ids');
      const originalRevision = (await getProgramDetail(program.id))?.revisions[0]?.revision;
      if (originalRevision === undefined) throw new Error('schedule revision fixture missing');
      await activateProgram(program.id);
      await db.workouts.add(
        newEntity<Workout>({
          routineId,
          name: 'Persisted week one',
          status: 'completed',
          startedAt: MONDAY,
          endedAt: MONDAY + 1_000,
          durationSeconds: 1,
          programId: program.id,
          programWeekIndex: 0,
          programScheduleEntryId: entryId,
        }),
      );
      await shiftProgram(program.id, 7);

      await expect(
        createScheduleRevision(program.id, 0, [
          { routineId, dayOfWeek: 2, order: 0 },
        ]),
      ).rejects.toMatchObject({
        code: 'retroactive_revision',
      } satisfies Partial<ProgramRepositoryError>);

      expect((await db.programScheduleRevisions.get(originalRevision.id))?.deletedAt).toBe(0);
      expect((await db.programScheduleEntries.get(entryId))?.deletedAt).toBe(0);
    } finally {
      now.mockRestore();
    }
  });

  it('supersedes only load proposals for exercises introduced by a generic future split', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 7, 12, 12).getTime());
    try {
      const existingExercise = await createCustomExercise({
        name: 'Existing bench',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isUnilateral: 0,
      });
      const introducedExercise = await createCustomExercise({
        name: 'Introduced row',
        primaryMuscle: 'lats',
        secondaryMuscles: [],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isUnilateral: 0,
      });
      const unrelatedExercise = await createCustomExercise({
        name: 'Unrelated squat',
        primaryMuscle: 'quads',
        secondaryMuscles: [],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isUnilateral: 0,
      });
      const initialRoutine = await createRoutine('Initial split');
      await addExercisesToRoutine(initialRoutine.id, [existingExercise.id]);
      const futureRoutine = await createRoutine('Future split');
      await addExercisesToRoutine(futureRoutine.id, [
        existingExercise.id,
        introducedExercise.id,
      ]);
      const program = await createProgramDraft({
        name: 'Coach split authority',
        startsAt: MONDAY,
        durationWeeks: 4,
      });
      await replaceProgramWeeks(program.id, [week(0), week(1), week(2), week(3)]);
      await createScheduleRevision(program.id, 0, [
        { routineId: initialRoutine.id, dayOfWeek: 1, order: 0 },
      ]);
      await activateProgram(program.id);
      await recordCoachSignals(
        [existingExercise, introducedExercise, unrelatedExercise].map((exercise, index) => ({
          exerciseId: exercise.id,
          code: 'range_completed' as const,
          severity: 40,
          nextLoadKg: 100 + index * 10,
          evidence: [],
        })),
        { recommendedAt: 1_000 },
      );

      await createScheduleRevision(program.id, 1, [
        { routineId: futureRoutine.id, dayOfWeek: 2, order: 0 },
      ]);

      const statusByExercise = new Map(
        (await db.coachRecommendations.toArray()).map((row) => [row.exerciseId, row.status]),
      );
      expect(statusByExercise.get(existingExercise.id)).toBe('pending');
      expect(statusByExercise.get(introducedExercise.id)).toBe('superseded');
      expect(statusByExercise.get(unrelatedExercise.id)).toBe('pending');
    } finally {
      now.mockRestore();
    }
  });

  it('rolls back a generic future split when Coach supersession fails', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 7, 12, 12).getTime());
    try {
      const exercise = await createCustomExercise({
        name: 'Atomic row',
        primaryMuscle: 'lats',
        secondaryMuscles: [],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isUnilateral: 0,
      });
      const initialRoutine = await createRoutine('Atomic initial');
      const futureRoutine = await createRoutine('Atomic future');
      await addExercisesToRoutine(futureRoutine.id, [exercise.id]);
      const program = await createProgramDraft({
        name: 'Atomic split',
        startsAt: MONDAY,
        durationWeeks: 4,
      });
      await replaceProgramWeeks(program.id, [week(0), week(1), week(2), week(3)]);
      const initialRevision = await createScheduleRevision(program.id, 0, [
        { routineId: initialRoutine.id, dayOfWeek: 1, order: 0 },
      ]);
      await activateProgram(program.id);
      const [recommendation] = await recordCoachSignals(
        [
          {
            exerciseId: exercise.id,
            code: 'range_completed' as const,
            severity: 40,
            nextLoadKg: 100,
            evidence: [],
          },
        ],
        { recommendedAt: 1_000 },
      );
      const writeRecommendations = vi
        .spyOn(db.coachRecommendations, 'bulkPut')
        .mockRejectedValueOnce(new Error('coach write failed'));

      try {
        await expect(
          createScheduleRevision(program.id, 1, [
            { routineId: futureRoutine.id, dayOfWeek: 2, order: 0 },
          ]),
        ).rejects.toThrow('coach write failed');
      } finally {
        writeRecommendations.mockRestore();
      }

      const detail = await getProgramDetail(program.id);
      expect(detail?.revisions.map(({ revision }) => revision.id)).toEqual([
        initialRevision.id,
      ]);
      expect((await db.coachRecommendations.get(recommendation!.id))?.status).toBe('pending');
    } finally {
      now.mockRestore();
    }
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
    await activateProgram(program.id);
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

  it('allows shifts only for active programs and only when the resulting start stays Monday', async () => {
    const draft = await createReadyProgram('Draft shift');
    await expect(shiftProgram(draft.program.id, 7)).rejects.toMatchObject({
      code: 'program_invalid',
    } satisfies Partial<ProgramRepositoryError>);

    await activateProgram(draft.program.id);
    await expect(shiftProgram(draft.program.id, 1)).rejects.toMatchObject({
      code: 'program_invalid',
    } satisfies Partial<ProgramRepositoryError>);
    expect((await db.programs.get(draft.program.id))?.startsAt).toBe(MONDAY);

    await completeProgram(draft.program.id);
    await expect(shiftProgram(draft.program.id, 7)).rejects.toMatchObject({
      code: 'program_invalid',
    } satisfies Partial<ProgramRepositoryError>);
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
