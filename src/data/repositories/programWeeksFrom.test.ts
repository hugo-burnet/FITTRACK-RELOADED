import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { ProgramPhase, Workout } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import { createRoutine } from './routines';
import {
  ProgramRepositoryError,
  activateProgram,
  completeProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceProgramWeeks,
  replaceProgramWeeksFrom,
} from './programs';

const MONDAY = new Date(2026, 7, 10, 0, 0, 0, 0).getTime();

const week = (weekIndex: number, phase: ProgramPhase = 'construction', loadIndex = 100) => ({
  weekIndex,
  phase,
  loadIndex,
});

async function readyProgram(durationWeeks = 4) {
  const routine = await createRoutine('Split');
  const program = await createProgramDraft({ name: 'Bloc', startsAt: MONDAY, durationWeeks });
  await replaceProgramWeeks(
    program.id,
    Array.from({ length: durationWeeks }, (_, index) => week(index)),
  );
  const revision = await createScheduleRevision(program.id, 0, [
    { routineId: routine.id, dayOfWeek: 1, order: 0 },
  ]);
  const entry = await db.programScheduleEntries.where('revisionId').equals(revision.id).first();
  if (entry === undefined) throw new Error('schedule fixture missing');
  return { program, entryId: entry.id };
}

async function readWeeks(programId: string) {
  return (await db.programWeeks.where('programId').equals(programId).toArray())
    .filter((row) => row.deletedAt === 0)
    .sort((left, right) => left.weekIndex - right.weekIndex);
}

beforeEach(resetDb);

describe('replaceProgramWeeksFrom', () => {
  it('rewrites an active block from the effective week and seals what is before', async () => {
    const { program } = await readyProgram();
    await activateProgram(program.id);

    await replaceProgramWeeksFrom(program.id, 2, [
      week(0),
      week(1),
      week(2, 'deload', 60),
      week(3, 'return'),
    ]);

    const weeks = await readWeeks(program.id);
    expect(weeks.map((row) => `${row.phase} ${row.loadIndex}`)).toEqual([
      'construction 100',
      'construction 100',
      'deload 60',
      'return 100',
    ]);
  });

  /**
   * The sealed rows are the same rows, not equal copies: a past week keeps its
   * identity so nothing downstream can mistake a rewrite for a new week.
   */
  it('does not touch the rows before the effective week', async () => {
    const { program } = await readyProgram();
    await activateProgram(program.id);
    const before = await readWeeks(program.id);

    await replaceProgramWeeksFrom(program.id, 2, [
      week(0, 'test', 110),
      week(1, 'test', 110),
      week(2, 'deload', 60),
      week(3),
    ]);

    const after = await readWeeks(program.id);
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[1]!.id).toBe(before[1]!.id);
    expect(after[0]!.updatedAt).toBe(before[0]!.updatedAt);
    // Payload sent for a sealed week is ignored, not applied.
    expect(after[0]!.phase).toBe('construction');
    expect(after[1]!.phase).toBe('construction');
    expect(after[2]!.id).not.toBe(before[2]!.id);
  });

  it('accepts a draft and rewrites the whole block from 0', async () => {
    const { program } = await readyProgram();

    await replaceProgramWeeksFrom(program.id, 0, [
      week(0, 'return'),
      week(1),
      week(2, 'progression', 105),
      week(3, 'deload', 60),
    ]);

    expect((await readWeeks(program.id)).map((row) => row.phase)).toEqual([
      'return',
      'construction',
      'progression',
      'deload',
    ]);
  });

  it('refuses a completed block', async () => {
    const { program } = await readyProgram();
    await activateProgram(program.id);
    await completeProgram(program.id);

    await expect(
      replaceProgramWeeksFrom(program.id, 2, [week(0), week(1), week(2, 'deload', 60), week(3)]),
    ).rejects.toThrow(ProgramRepositoryError);
  });

  it('refuses a partial list — every week of the block must be passed', async () => {
    const { program } = await readyProgram();
    await activateProgram(program.id);

    await expect(
      replaceProgramWeeksFrom(program.id, 2, [week(2, 'deload', 60), week(3)]),
    ).rejects.toThrow(ProgramRepositoryError);
  });

  it('refuses an effective index outside the block', async () => {
    const { program } = await readyProgram();
    await activateProgram(program.id);
    const weeks = [week(0), week(1), week(2), week(3)];

    await expect(replaceProgramWeeksFrom(program.id, -1, weeks)).rejects.toThrow(
      ProgramRepositoryError,
    );
    await expect(replaceProgramWeeksFrom(program.id, 4, weeks)).rejects.toThrow(
      ProgramRepositoryError,
    );
  });

  /** The seal is data, not screen deep: a week that already trained is closed. */
  it('refuses to rewrite a week that already carries a workout', async () => {
    const { program, entryId } = await readyProgram();
    await activateProgram(program.id);
    await db.workouts.add(
      newEntity<Workout>({
        routineId: '',
        name: 'Séance faite',
        status: 'completed',
        startedAt: MONDAY + 2 * 7 * 24 * 60 * 60 * 1000,
        endedAt: MONDAY + 2 * 7 * 24 * 60 * 60 * 1000 + 3_600_000,
        durationSeconds: 3_600,
        programId: program.id,
        programWeekIndex: 2,
        programScheduleEntryId: entryId,
        programPhase: 'construction',
        programLoadIndex: 100,
        programIsDeload: 0,
      }),
    );

    await expect(
      replaceProgramWeeksFrom(program.id, 2, [week(0), week(1), week(2, 'deload', 60), week(3)]),
    ).rejects.toThrow(ProgramRepositoryError);

    // One week later is still open.
    await expect(
      replaceProgramWeeksFrom(program.id, 3, [week(0), week(1), week(2), week(3, 'deload', 60)]),
    ).resolves.toBeUndefined();
  });

  it('leaves the workouts of the block alone', async () => {
    const { program, entryId } = await readyProgram();
    await activateProgram(program.id);
    const workout = newEntity<Workout>({
      routineId: '',
      name: 'Séance faite',
      status: 'completed',
      startedAt: MONDAY,
      endedAt: MONDAY + 3_600_000,
      durationSeconds: 3_600,
      programId: program.id,
      programWeekIndex: 0,
      programScheduleEntryId: entryId,
      programPhase: 'construction',
      programLoadIndex: 100,
      programIsDeload: 0,
    });
    await db.workouts.add(workout);

    await replaceProgramWeeksFrom(program.id, 1, [
      week(0),
      week(1, 'deload', 60),
      week(2),
      week(3),
    ]);

    expect(await db.workouts.get(workout.id)).toMatchObject({
      programWeekIndex: 0,
      programPhase: 'construction',
      programLoadIndex: 100,
      deletedAt: 0,
    });
  });
});
