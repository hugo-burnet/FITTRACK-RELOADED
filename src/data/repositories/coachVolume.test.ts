import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { MuscleGroup } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { seedWorkout } from '@/test/factories';
import {
  getVolumeOverview,
  listVolumeLow,
  loadVolumeEntries,
  volumeEntriesOfWorkout,
} from './coachVolume';
import { createCustomExercise } from './exercises';
import { setCoachVolumeBounds } from './settings';
import { getWorkoutDetail } from './workouts';

/** Un jeudi à midi, en jour local : la semaine en cours commence le lundi 12 octobre. */
const NOW = new Date(2026, 9, 15, 12).getTime();
const MONDAY = new Date(2026, 9, 12).getTime();

/** Le mercredi de la semaine complète numéro `weeksAgo` avant la semaine en cours, à midi. */
function inWeek(weeksAgo: number): number {
  const date = new Date(MONDAY);
  date.setDate(date.getDate() - weeksAgo * 7 + 2);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
}

async function exerciseFor(muscle: MuscleGroup, name = `Exercice ${muscle}`): Promise<string> {
  const exercise = await createCustomExercise({
    name,
    primaryMuscle: muscle,
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  return exercise.id;
}

/** Une séance terminée de `sets` séries de travail à `at`. */
async function session(exerciseId: string, at: number, sets: number): Promise<string> {
  const workout = await seedWorkout({
    exerciseId,
    performedAt: at,
    sets: Array.from({ length: sets }, () => [60, 10] as [number, number]),
  });
  return workout.id;
}

describe('loadVolumeEntries', () => {
  beforeEach(resetDb);

  it('rend, par séance et par exercice, les séries de travail du muscle principal', async () => {
    const chest = await exerciseFor('chest');
    const lats = await exerciseFor('lats');
    await session(chest, inWeek(2), 3);
    await session(lats, inWeek(1), 5);

    const entries = await loadVolumeEntries(NOW);

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        { at: inWeek(2), muscle: 'chest', sets: 3 },
        { at: inWeek(1), muscle: 'lats', sets: 5 },
      ]),
    );
  });

  it('ne compte pas l’échauffement', async () => {
    const chest = await exerciseFor('chest');
    const workoutId = await session(chest, inWeek(1), 4);
    const [first] = await db.workoutSets.where('workoutId').equals(workoutId).sortBy('order');
    await db.workoutSets.update(first!.id, { setType: 'warmup' });

    expect((await loadVolumeEntries(NOW))[0]).toMatchObject({ muscle: 'chest', sets: 3 });
  });

  it('ne lit que la fenêtre des six semaines complètes et de la semaine en cours', async () => {
    const chest = await exerciseFor('chest');
    await session(chest, inWeek(7), 9);
    await session(chest, inWeek(6), 4);
    await session(chest, NOW - 86_400_000, 2);
    await session(chest, NOW + 3_600_000, 8);

    const entries = await loadVolumeEntries(NOW);

    expect(entries.map((entry) => entry.sets).sort()).toEqual([2, 4]);
  });

  it('écarte la séance qu’on lui dit d’écarter : celle qu’on évalue est comptée à part', async () => {
    const chest = await exerciseFor('chest');
    const kept = await session(chest, inWeek(2), 3);
    const excluded = await session(chest, inWeek(1), 5);

    const entries = await loadVolumeEntries(NOW, { excludeWorkoutId: excluded });

    expect(entries).toEqual([{ at: inWeek(2), muscle: 'chest', sets: 3 }]);
    expect(kept).not.toBe(excluded);
  });

  it('ne lit pas une séance jetée ni supprimée', async () => {
    const chest = await exerciseFor('chest');
    const discarded = await session(chest, inWeek(2), 3);
    const deleted = await session(chest, inWeek(1), 3);
    await db.workouts.update(discarded, { status: 'discarded' });
    await db.workouts.update(deleted, { deletedAt: Date.now() });

    expect(await loadVolumeEntries(NOW)).toEqual([]);
  });
});

describe('volumeEntriesOfWorkout', () => {
  beforeEach(resetDb);

  it('compte les séries validées de la séance en cours : celle que l’historique ne contient pas encore', async () => {
    const chest = await exerciseFor('chest');
    const workoutId = await session(chest, NOW - 3_600_000, 4);
    const [pending] = await db.workoutSets.where('workoutId').equals(workoutId).sortBy('order');
    // Une série pas encore validée n'a pas eu lieu.
    await db.workoutSets.update(pending!.id, { isCompleted: 0, performedAt: 0 });
    const detail = (await getWorkoutDetail(workoutId))!;

    expect(volumeEntriesOfWorkout(detail)).toEqual([
      { at: NOW - 3_600_000, muscle: 'chest', sets: 3 },
    ]);
  });
});

describe('getVolumeOverview', () => {
  beforeEach(resetDb);

  it('rend les seize régions du corps dans leur ordre, toutes — un muscle jamais travaillé aussi', async () => {
    const rows = await getVolumeOverview(NOW);

    expect(rows).toHaveLength(16);
    expect(rows[0]!.muscle).toBe('chest');
    expect(rows.map((row) => row.muscle)).not.toContain('cardio');
    expect(rows.every((row) => row.overview.weeksWorked === 0)).toBe(true);
  });

  it('lit l’historique de chaque muscle, et son plafond tiré de ce qui a été tenu', async () => {
    const chest = await exerciseFor('chest');
    for (const [weeksAgo, sets] of [[4, 8], [3, 10], [2, 9]] as const) {
      await session(chest, inWeek(weeksAgo), sets);
    }
    await session(chest, NOW - 86_400_000, 6);

    const row = (await getVolumeOverview(NOW)).find((candidate) => candidate.muscle === 'chest')!;

    expect(row.overview).toMatchObject({ weeksWorked: 3, max: 10, median: 9, rollingSets: 6 });
    expect(row.ceiling).toBe(10);
    expect(row.ceilingUserSet).toBe(false);
    expect(row.bounds).toEqual({});
  });

  it('rend les bornes posées, et le plafond posé prime sur celui de l’historique', async () => {
    const chest = await exerciseFor('chest');
    for (const weeksAgo of [4, 3, 2]) await session(chest, inWeek(weeksAgo), 10);
    await setCoachVolumeBounds('chest', { floor: 6, ceiling: 14 });

    const row = (await getVolumeOverview(NOW)).find((candidate) => candidate.muscle === 'chest')!;

    expect(row.bounds).toEqual({ floor: 6, ceiling: 14 });
    expect(row.ceiling).toBe(14);
    expect(row.ceilingUserSet).toBe(true);
  });

  it('ne rend aucun plafond sous trois semaines travaillées', async () => {
    const chest = await exerciseFor('chest');
    await session(chest, inWeek(2), 10);
    await session(chest, inWeek(1), 10);

    const row = (await getVolumeOverview(NOW)).find((candidate) => candidate.muscle === 'chest')!;

    expect(row.overview.weeksWorked).toBe(2);
    expect(row.ceiling).toBeUndefined();
  });
});

describe('listVolumeLow', () => {
  beforeEach(resetDb);

  it('ne dit rien tant que la personne n’a posé aucun plancher, même à deux séries par semaine', async () => {
    const hamstrings = await exerciseFor('hamstrings');
    await session(hamstrings, inWeek(2), 2);
    await session(hamstrings, inWeek(1), 2);

    expect(await listVolumeLow(NOW)).toEqual([]);
  });

  it('nomme un muscle sous son plancher deux semaines complètes de suite', async () => {
    const hamstrings = await exerciseFor('hamstrings');
    await session(hamstrings, inWeek(2), 6);
    await session(hamstrings, inWeek(1), 6);
    await setCoachVolumeBounds('hamstrings', { floor: 8 });

    expect(await listVolumeLow(NOW)).toEqual([
      { muscle: 'hamstrings', floor: 8, weeks: [6, 6] },
    ]);
  });

  it('se tait quand la personne n’a pas fait une séance de la semaine : ce sont des vacances', async () => {
    const hamstrings = await exerciseFor('hamstrings');
    await session(hamstrings, inWeek(2), 6);
    await setCoachVolumeBounds('hamstrings', { floor: 8 });

    expect(await listVolumeLow(NOW)).toEqual([]);
  });
});
