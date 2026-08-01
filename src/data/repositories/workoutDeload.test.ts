import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { DEFAULT_EXPORT_OPTIONS } from '@/lib/export/types';
import { projectCoachExport } from '@/lib/export/projectCoachExport';
import { serializeMarkdown } from '@/lib/export/serializeMarkdown';
import { listHistoricalWorkouts } from './historicalWorkouts';
import { resetDb } from '@/test/resetDb';
import { seedWorkout } from '@/test/factories';
import { createCustomExercise } from './exercises';
import {
  addSet,
  addWorkoutExercise,
  applyWorkoutDeload,
  completeSet,
  finishWorkout,
  getWorkoutDetail,
  startWorkout,
} from './workouts';

const NOTE = 'Deload — charges réduites à 80 %.';

async function liveSet(workoutId: string, exerciseId = 'bench') {
  const row = await addWorkoutExercise(workoutId, exerciseId);
  const detail = await getWorkoutDetail(workoutId);
  const set = detail?.exercises.find((line) => line.row.id === row.id)?.sets[0];
  if (set === undefined) throw new Error('missing live set');
  return { row, set };
}

describe('applyWorkoutDeload', () => {
  beforeEach(resetDb);

  it('uses typed, target, then previous loads and leaves completed sets intact', async () => {
    await seedWorkout({
      exerciseId: 'bench',
      performedAt: Date.now() - 86_400_000,
      sets: [[50, 5], [60, 5], [70, 5], [80, 5]],
    });
    const workout = await startWorkout('', 'Poussée');
    const { row, set: first } = await liveSet(workout.id);
    await db.workoutSets.update(first.id, { weight: 110, targetWeight: 120 });
    await completeSet(first.id, { weight: 110, reps: 5 });
    const typed = await addSet(row.id, { weight: 90, targetWeight: 100 });
    const targeted = await addSet(row.id, { targetWeight: 82.5 });
    const previousOnly = await addSet(row.id);

    await expect(applyWorkoutDeload(workout.id, NOTE)).resolves.toMatchObject({
      deloadPercent: 80,
      notes: NOTE,
    });

    expect((await db.workoutSets.get(first.id))?.weight).toBe(110);
    expect((await db.workoutSets.get(typed.id))?.weight).toBe(72.5);
    expect((await db.workoutSets.get(targeted.id))?.targetWeight).toBe(65);
    expect((await db.workoutSets.get(previousOnly.id))?.targetWeight).toBe(65);
    expect(await db.workouts.get(workout.id)).toMatchObject({
      deloadPercent: 80,
      notes: NOTE,
    });
  });

  it('appends the note once and cannot reduce the workout twice', async () => {
    const workout = await startWorkout('', 'Poussée');
    const existingNotes = '  Épaule sensible.\n  ';
    await db.workouts.update(workout.id, { notes: existingNotes });
    const { set } = await liveSet(workout.id);
    await db.workoutSets.update(set.id, { targetWeight: 100 });

    expect(await applyWorkoutDeload(workout.id, NOTE)).not.toBeNull();
    expect(await applyWorkoutDeload(workout.id, NOTE)).toBeNull();

    expect(await db.workouts.get(workout.id)).toMatchObject({
      deloadPercent: 80,
      notes: `${existingNotes}\n\n${NOTE}`,
    });
    expect((await db.workoutSets.get(set.id))?.targetWeight).toBe(80);
  });

  it('uses the missing-exercise fallback after an assisted exercise is soft-deleted', async () => {
    const assisted = await createCustomExercise({
      name: 'Tractions assistées retirées',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'assisted_weight_reps',
      isUnilateral: 0,
    });
    const workout = await startWorkout('', 'Technique');
    const { set } = await liveSet(workout.id, assisted.id);
    await db.workoutSets.update(set.id, { targetWeight: 40 });
    await db.exercises.update(assisted.id, { deletedAt: Date.now() });

    await expect(applyWorkoutDeload(workout.id, NOTE)).resolves.toMatchObject({
      deloadPercent: 80,
    });
    expect((await db.workoutSets.get(set.id))?.targetWeight).toBe(32.5);
  });

  it('does not touch hidden or assisted weights', async () => {
    const timed = await createCustomExercise({
      name: 'Planche',
      primaryMuscle: 'abs',
      secondaryMuscles: [],
      equipment: 'bodyweight',
      measurementType: 'time_only',
      isUnilateral: 0,
    });
    const assisted = await createCustomExercise({
      name: 'Tractions assistées',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'assisted_weight_reps',
      isUnilateral: 0,
    });
    const workout = await startWorkout('', 'Technique');
    const timedSet = (await liveSet(workout.id, timed.id)).set;
    const assistedSet = (await liveSet(workout.id, assisted.id)).set;
    await db.workoutSets.update(timedSet.id, { targetWeight: 100 });
    await db.workoutSets.update(assistedSet.id, { targetWeight: 40 });

    expect(await applyWorkoutDeload(workout.id, NOTE)).toBeNull();
    expect((await db.workouts.get(workout.id))?.deloadPercent).toBeUndefined();
    expect((await db.workoutSets.get(timedSet.id))?.targetWeight).toBe(100);
    expect((await db.workoutSets.get(assistedSet.id))?.targetWeight).toBe(40);
  });

  it('rolls every write back when the workout update fails', async () => {
    const workout = await startWorkout('', 'Poussée');
    const { set } = await liveSet(workout.id);
    await db.workoutSets.update(set.id, { targetWeight: 100 });
    vi.spyOn(db.workouts, 'put').mockRejectedValueOnce(new Error('write failed'));

    await expect(applyWorkoutDeload(workout.id, NOTE)).rejects.toThrow('write failed');
    expect((await db.workoutSets.get(set.id))?.targetWeight).toBe(100);
    expect((await db.workouts.get(workout.id))?.deloadPercent).toBeUndefined();
  });

  it('carries the automatic note through the real Markdown export pipeline', async () => {
    const workout = await startWorkout('', 'Poussée');
    const { set } = await liveSet(workout.id);
    await db.workoutSets.update(set.id, { targetWeight: 100, targetReps: 5 });
    await applyWorkoutDeload(workout.id, NOTE);
    await completeSet(set.id, { weight: 80, reps: 5 });
    await finishWorkout(workout.id);

    const scope = { kind: 'workout', workoutId: workout.id } as const;
    const source = await listHistoricalWorkouts(scope);
    const markdown = serializeMarkdown(
      projectCoachExport(scope, source, DEFAULT_EXPORT_OPTIONS, Date.now()),
    );

    expect(markdown).toContain(NOTE);
  });
});
