import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Exercise } from '@/data/types';
import {
  FIRST_DOMS_HOURS,
  FIRST_DOMS_MILESTONE_ID,
  FIRST_SESSION_MILESTONE_ID,
} from '@/lib/milestones/catalogue';
import { day, seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import { newEntity } from './base';
import {
  acknowledgeMilestones,
  bootMilestones,
  ensureMilestoneProjection,
  getDomsFollowUp,
  listMilestones,
  listSeenRetrospectives,
  listUnacknowledgedMilestones,
  markRetrospectiveSeen,
  syncMilestones,
} from './milestones';

const START = day(0);
const HOUR = 3_600_000;

async function seedExercise(overrides: Partial<Exercise> = {}): Promise<Exercise> {
  const exercise = newEntity<Exercise>({
    name: 'Développé couché (barre)',
    slug: 'barbell-bench-press',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...overrides,
  });
  await db.exercises.add(exercise);
  return exercise;
}

beforeEach(resetDb);

describe('le schéma', () => {
  it('ouvre la table des paliers en version 12', async () => {
    expect(db.verno).toBe(12);
    expect(db.tables.map((table) => table.name)).toContain('milestones');
  });
});

describe('la projection des paliers', () => {
  it('ne rend rien sur une base vide', async () => {
    expect(await syncMilestones({ celebrate: true })).toEqual([]);
    expect(await listMilestones()).toEqual([]);
  });

  it('écrit un palier franchi et le rend à célébrer', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });

    const created = await syncMilestones({ celebrate: true });

    expect(created.map((row) => row.definitionId)).toEqual(
      expect.arrayContaining(['bench-60', 'bench-80', 'bench-100']),
    );
    expect(created.every((row) => row.acknowledgedAt === 0)).toBe(true);
  });

  it('ne célèbre le même palier qu’une fois, même rejouée', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });

    await syncMilestones({ celebrate: true });
    // Rejouer sans nouvelle séance ne doit rien produire : c'est ce qui rend
    // l'opération sûre à appeler sans savoir si elle a déjà tourné.
    expect(await syncMilestones({ celebrate: true })).toEqual([]);
  });

  it('n’ajoute pas de doublon quand elle est rejouée', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });

    await syncMilestones({ celebrate: true });
    await syncMilestones({ celebrate: true });

    const ids = (await listMilestones()).map((row) => row.definitionId);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('date le palier de la séance qui l’a franchi', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });
    await seedWorkout({ performedAt: day(30), exerciseId: bench.id, sets: [[120, 1]] });

    await syncMilestones({ celebrate: true });
    const rows = await listMilestones();

    expect(rows.find((row) => row.definitionId === 'bench-100')?.achievedAt).toBe(START);
    expect(rows.find((row) => row.definitionId === 'bench-120')?.achievedAt).toBe(day(30));
  });

  it('n’accorde rien à un exercice personnel', async () => {
    const custom = await seedExercise({ isCustom: 1, slug: undefined, name: 'Mon développé' });
    await seedWorkout({ performedAt: START, exerciseId: custom.id, sets: [[150, 1]] });

    await syncMilestones({ celebrate: true });
    expect((await listMilestones()).map((row) => row.definitionId)).not.toContain('bench-100');
  });

  it('retire un palier dont la séance a été supprimée', async () => {
    const bench = await seedExercise();
    const workout = await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });

    await syncMilestones({ celebrate: true });
    expect((await listMilestones()).map((row) => row.definitionId)).toContain('bench-100');

    await db.workouts.update(workout.id, { deletedAt: Date.now() });
    await syncMilestones({ celebrate: true });

    expect((await listMilestones()).map((row) => row.definitionId)).not.toContain('bench-100');
  });

  it('garde l’acquittement quand une séance corrigée redate un palier', async () => {
    const bench = await seedExercise();
    const workout = await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });

    const [first] = await syncMilestones({ celebrate: true });
    await acknowledgeMilestones([first!.id]);

    await db.workouts.update(workout.id, { startedAt: day(-10) });
    await syncMilestones({ celebrate: true });

    const row = (await listMilestones()).find((item) => item.id === first!.id);
    expect(row?.achievedAt).toBe(day(-10));
    // Redaté n'est pas nouveau : le palier ne doit pas se re-célébrer.
    expect(row?.acknowledgedAt).not.toBe(0);
  });
});

describe('le rattrapage silencieux', () => {
  it('entre l’historique déjà acquitté — dix ans d’un coup ne se fêtent pas', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[140, 1]] });

    await ensureMilestoneProjection();

    expect((await listMilestones()).length).toBeGreaterThan(0);
    expect(await listUnacknowledgedMilestones()).toEqual([]);
  });

  it('ne recalcule pas au démarrage suivant', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });

    await ensureMilestoneProjection();
    const before = await listMilestones();

    // Une séance ajoutée hors séance : le rattrapage a déjà eu lieu, il ne doit
    // pas repasser — c'est la fin de séance qui appelle la synchronisation.
    await seedWorkout({ performedAt: day(1), exerciseId: bench.id, sets: [[140, 1]] });
    await ensureMilestoneProjection();

    expect(await listMilestones()).toHaveLength(before.length);
  });
});

describe('l’acquittement', () => {
  it('vide la liste de ce qui reste à montrer', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[100, 1]] });

    const created = await syncMilestones({ celebrate: true });
    expect(await listUnacknowledgedMilestones()).toHaveLength(created.length);

    await acknowledgeMilestones(created.map((row) => row.id));
    expect(await listUnacknowledgedMilestones()).toEqual([]);
  });

  it('supporte une liste vide', async () => {
    await expect(acknowledgeMilestones([])).resolves.toBeUndefined();
  });
});

describe('les anniversaires déjà vus', () => {
  it('part d’un ensemble vide', async () => {
    expect(await listSeenRetrospectives()).toEqual(new Set());
  });

  it('retient une clé, et ne la double pas', async () => {
    await markRetrospectiveSeen('bench-100:1');
    await markRetrospectiveSeen('bench-100:1');
    await markRetrospectiveSeen('pullup-1:2');

    expect(await listSeenRetrospectives()).toEqual(new Set(['bench-100:1', 'pullup-1:2']));
  });
});

describe('le drapeau de suivi des DOMS', () => {
  it('pose le drapeau seulement si la première séance est fêtée en direct', async () => {
    const bench = await seedExercise();
    const workout = await seedWorkout({
      performedAt: START,
      exerciseId: bench.id,
      sets: [[20, 5]],
    });

    await syncMilestones({ celebrate: true, now: START + 60_000 });

    const followUp = await getDomsFollowUp();
    expect(followUp?.dueAt).toBe(START + FIRST_DOMS_HOURS * HOUR);
    expect((await listMilestones()).map((row) => row.definitionId)).toContain(
      FIRST_SESSION_MILESTONE_ID,
    );
    expect((await listMilestones()).map((row) => row.definitionId)).not.toContain(
      FIRST_DOMS_MILESTONE_ID,
    );
    expect(workout.id).toBeTruthy();
  });

  it('n’arme pas le drapeau sur un rattrapage silencieux', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[20, 5]] });

    await syncMilestones({ celebrate: false, now: START + FIRST_DOMS_HOURS * HOUR });

    expect(await getDomsFollowUp()).toBeNull();
    const rows = await listMilestones();
    expect(rows.map((row) => row.definitionId)).toEqual(
      expect.arrayContaining([FIRST_SESSION_MILESTONE_ID, FIRST_DOMS_MILESTONE_ID]),
    );
    expect(rows.every((row) => row.acknowledgedAt !== 0)).toBe(true);
  });

  it('célèbre les DOMS au boot seulement si le drapeau est là', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[20, 5]] });
    await syncMilestones({ celebrate: true, now: START + 60_000 });
    await acknowledgeMilestones((await listUnacknowledgedMilestones()).map((row) => row.id));

    await bootMilestones(START + FIRST_DOMS_HOURS * HOUR);

    const doms = (await listUnacknowledgedMilestones()).find(
      (row) => row.definitionId === FIRST_DOMS_MILESTONE_ID,
    );
    expect(doms?.acknowledgedAt).toBe(0);
    expect(doms?.achievedAt).toBe(START + FIRST_DOMS_HOURS * HOUR);
    expect(await getDomsFollowUp()).toBeNull();
  });

  it('écrit les DOMS acquittées au boot si le drapeau est absent', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[20, 5]] });
    await syncMilestones({ celebrate: false, now: START + 60_000 });
    expect(await getDomsFollowUp()).toBeNull();

    await bootMilestones(START + FIRST_DOMS_HOURS * HOUR);

    const doms = (await listMilestones()).find(
      (row) => row.definitionId === FIRST_DOMS_MILESTONE_ID,
    );
    expect(doms?.acknowledgedAt).not.toBe(0);
    expect(await listUnacknowledgedMilestones()).toEqual([]);
  });

  it('efface le drapeau si la première séance disparaît', async () => {
    const bench = await seedExercise();
    const workout = await seedWorkout({
      performedAt: START,
      exerciseId: bench.id,
      sets: [[20, 5]],
    });
    await syncMilestones({ celebrate: true, now: START + 60_000 });
    expect(await getDomsFollowUp()).not.toBeNull();

    await db.workouts.update(workout.id, { deletedAt: Date.now() });
    await syncMilestones({ celebrate: true, now: START + 60_000 });

    expect(await getDomsFollowUp()).toBeNull();
    expect((await listMilestones()).map((row) => row.definitionId)).not.toContain(
      FIRST_SESSION_MILESTONE_ID,
    );
  });
});
