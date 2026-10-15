import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { BodyMeasurement, Exercise } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { seedWorkout } from '@/test/factories';
import {
  deleteMeasurement,
  listMeasurements,
  listMeasurementTypes,
  saveMeasurement,
} from './measurements';
import { rebuildAllRecords } from './personalRecords';

const at = (month: number, day: number, hour = 12): number =>
  new Date(2026, month - 1, day, hour).getTime();

const row = (
  type: string,
  value: number,
  measuredAt: number,
  unit = 'cm',
  deletedAt = 0,
): BodyMeasurement => ({
  ...newEntity<BodyMeasurement>({ type, value, unit, measuredAt }),
  deletedAt,
});

describe('listMeasurements', () => {
  beforeEach(resetDb);

  it('rend les mesures d’un seul type, la plus ancienne d’abord', async () => {
    await db.bodyMeasurements.bulkAdd([
      row('waist', 82, at(10, 14)),
      row('waist', 84, at(9, 14)),
      row('chest', 100, at(10, 1)),
      row('waist', 83, at(10, 1)),
    ]);

    const readings = await listMeasurements('waist');

    expect(readings.map((reading) => reading.value)).toEqual([84, 83, 82]);
    expect(readings.every((reading) => reading.type === 'waist')).toBe(true);
  });

  it('ignore les mesures supprimées', async () => {
    await db.bodyMeasurements.bulkAdd([
      row('waist', 90, at(9, 1), 'cm', at(9, 2)),
      row('waist', 82, at(10, 14)),
    ]);

    expect((await listMeasurements('waist')).map((reading) => reading.value)).toEqual([82]);
  });

  it('porte l’id, l’unité et l’instant de chaque ligne', async () => {
    const stored = row('left_biceps', 38.5, at(10, 3, 8));
    await db.bodyMeasurements.add(stored);

    expect(await listMeasurements('left_biceps')).toEqual([
      { id: stored.id, type: 'left_biceps', value: 38.5, unit: 'cm', measuredAt: at(10, 3, 8) },
    ]);
  });

  it('ne rend rien pour un type qu’on n’a jamais mesuré', async () => {
    expect(await listMeasurements('waist')).toEqual([]);
  });
});

describe('listMeasurementTypes', () => {
  beforeEach(resetDb);

  it('ne rend rien tant que rien n’est mesuré', async () => {
    expect(await listMeasurementTypes()).toEqual([]);
  });

  it('range le catalogue dans son ordre, puis les champs libres par ordre alphabétique', async () => {
    await db.bodyMeasurements.bulkAdd([
      row('custom:Poignet', 17, at(10, 1)),
      row('waist', 82, at(10, 1)),
      row('custom:Cheville', 22, at(10, 1)),
      row('body_weight', 80, at(10, 1), 'kg'),
      row('left_thigh', 58, at(10, 1)),
    ]);

    expect((await listMeasurementTypes()).map((entry) => entry.type)).toEqual([
      'body_weight',
      'waist',
      'left_thigh',
      'custom:Cheville',
      'custom:Poignet',
    ]);
  });

  it('résume chaque type : la dernière mesure, celle d’avant, le nombre', async () => {
    const first = row('waist', 84, at(9, 14));
    const middle = row('waist', 83, at(10, 1));
    const last = row('waist', 82.5, at(10, 14));
    await db.bodyMeasurements.bulkAdd([middle, last, first]);

    const [entry] = await listMeasurementTypes();

    expect(entry).toMatchObject({ type: 'waist', unit: 'cm', count: 3 });
    expect(entry?.latest.id).toBe(last.id);
    expect(entry?.previous?.id).toBe(middle.id);
  });

  it('n’a pas de mesure précédente quand il n’y en a qu’une', async () => {
    await db.bodyMeasurements.add(row('waist', 82, at(10, 14)));

    const [entry] = await listMeasurementTypes();

    expect(entry?.count).toBe(1);
    expect(entry?.previous).toBeUndefined();
  });

  it('ignore les lignes supprimées, et n’annonce pas un type qui n’en a plus aucune vivante', async () => {
    await db.bodyMeasurements.bulkAdd([
      row('waist', 90, at(9, 1), 'cm', at(9, 2)),
      row('chest', 100, at(10, 1)),
      row('chest', 101, at(10, 8), 'cm', at(10, 9)),
    ]);

    const entries = await listMeasurementTypes();

    expect(entries.map((entry) => entry.type)).toEqual(['chest']);
    expect(entries[0]).toMatchObject({ count: 1 });
    expect(entries[0]?.latest.value).toBe(100);
  });

  it('lit l’unité de la ligne, pas celle du catalogue', async () => {
    await db.bodyMeasurements.add(row('waist', 32, at(10, 1), 'in'));

    expect((await listMeasurementTypes())[0]?.unit).toBe('in');
  });
});

describe('saveMeasurement', () => {
  beforeEach(resetDb);

  it('enregistre une première mesure vivante, datée', async () => {
    await saveMeasurement({ type: 'waist', value: 84, unit: 'cm', measuredAt: at(10, 3) });

    expect(await db.bodyMeasurements.toArray()).toMatchObject([
      { type: 'waist', value: 84, unit: 'cm', measuredAt: at(10, 3), deletedAt: 0 },
    ]);
  });

  it('prend l’instant présent sans date', async () => {
    const before = Date.now();
    await saveMeasurement({ type: 'waist', value: 84, unit: 'cm' });

    const [stored] = await db.bodyMeasurements.toArray();
    expect(stored!.measuredAt).toBeGreaterThanOrEqual(before);
    expect(stored!.measuredAt).toBeLessThanOrEqual(Date.now());
  });

  it('remplace la valeur du même jour sans ajouter de ligne, et garde son instant', async () => {
    await saveMeasurement({ type: 'waist', value: 84, unit: 'cm', measuredAt: at(10, 3, 8) });
    const [original] = await db.bodyMeasurements.toArray();

    await saveMeasurement({ type: 'waist', value: 83.5, unit: 'cm', measuredAt: at(10, 3, 20) });

    const rows = await db.bodyMeasurements.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: original!.id, value: 83.5, measuredAt: at(10, 3, 8) });
  });

  it('ajoute une ligne pour un autre jour, passé ou non', async () => {
    await saveMeasurement({ type: 'waist', value: 84, unit: 'cm', measuredAt: at(10, 3) });
    await saveMeasurement({ type: 'waist', value: 83, unit: 'cm', measuredAt: at(9, 3) });
    await saveMeasurement({ type: 'waist', value: 82, unit: 'cm', measuredAt: at(10, 4) });

    expect((await listMeasurements('waist')).map((reading) => reading.value)).toEqual([83, 84, 82]);
  });

  it('ne mélange pas deux types mesurés le même jour', async () => {
    await saveMeasurement({ type: 'waist', value: 84, unit: 'cm', measuredAt: at(10, 3) });
    await saveMeasurement({ type: 'chest', value: 101, unit: 'cm', measuredAt: at(10, 3) });

    expect(await db.bodyMeasurements.count()).toBe(2);
  });

  it('ne remplace pas une mesure supprimée : elle reste dans la corbeille', async () => {
    const gone = row('waist', 90, at(10, 3, 8), 'cm', at(10, 3, 9));
    await db.bodyMeasurements.add(gone);

    await saveMeasurement({ type: 'waist', value: 84, unit: 'cm', measuredAt: at(10, 3, 20) });

    expect(await db.bodyMeasurements.count()).toBe(2);
    expect((await db.bodyMeasurements.get(gone.id))?.deletedAt).toBe(at(10, 3, 9));
    expect((await listMeasurements('waist')).map((reading) => reading.value)).toEqual([84]);
  });

  it('arrondit à deux décimales : ce qui est enregistré est ce qui s’affiche', async () => {
    await saveMeasurement({ type: 'waist', value: 82.456, unit: 'cm', measuredAt: at(10, 3) });

    expect((await db.bodyMeasurements.toArray())[0]?.value).toBe(82.46);
  });

  it('impose l’unité du catalogue à une mesure du catalogue', async () => {
    await saveMeasurement({ type: 'waist', value: 84, unit: 'kg', measuredAt: at(10, 3) });

    expect((await db.bodyMeasurements.toArray())[0]?.unit).toBe('cm');
  });

  it('garde l’unité choisie d’un champ libre', async () => {
    await saveMeasurement({
      type: 'custom:Poignet',
      value: 17.5,
      unit: 'cm',
      measuredAt: at(10, 3),
    });
    await saveMeasurement({ type: 'custom:Lest', value: 12, unit: 'kg', measuredAt: at(10, 3) });

    const units = Object.fromEntries(
      (await db.bodyMeasurements.toArray()).map((stored) => [stored.type, stored.unit]),
    );
    expect(units).toEqual({ 'custom:Poignet': 'cm', 'custom:Lest': 'kg' });
  });

  it.each([
    ['une taille de 825 cm', { type: 'waist', value: 825, unit: 'cm' }],
    ['une masse grasse de 100 %', { type: 'body_fat', value: 100, unit: '%' }],
    ['une valeur nulle', { type: 'waist', value: 0, unit: 'cm' }],
    ['une valeur négative', { type: 'waist', value: -3, unit: 'cm' }],
    ['une valeur qui n’est pas un nombre', { type: 'waist', value: Number.NaN, unit: 'cm' }],
    ['une valeur infinie', { type: 'waist', value: Number.POSITIVE_INFINITY, unit: 'cm' }],
    ['un type vide', { type: '', value: 80, unit: 'cm' }],
    ['une unité vide pour un champ libre', { type: 'custom:Poignet', value: 17, unit: '' }],
  ])('refuse %s, sans rien écrire', async (_name, input) => {
    await expect(saveMeasurement({ ...input, measuredAt: at(10, 3) })).rejects.toThrow(RangeError);

    expect(await db.bodyMeasurements.count()).toBe(0);
  });

  it('range le poids de corps comme le fait l’accueil : en kilogrammes, un jour une valeur', async () => {
    await saveMeasurement({ type: 'body_weight', value: 82.4, unit: 'kg', measuredAt: at(10, 3, 8) });
    await saveMeasurement({ type: 'body_weight', value: 81.9, unit: 'kg', measuredAt: at(10, 3, 20) });

    expect(await db.bodyMeasurements.toArray()).toMatchObject([
      { type: 'body_weight', value: 81.9, unit: 'kg', measuredAt: at(10, 3, 8) },
    ]);
  });

  it('un poids rétrodaté refait le tonnage de la séance de ce jour-là : il passe par le dépôt du poids', async () => {
    const pullUp = {
      ...newEntity<Exercise>({
        name: 'Traction',
        primaryMuscle: 'lats',
        secondaryMuscles: [],
        equipment: 'bodyweight',
        measurementType: 'reps_only',
        isCustom: 1,
        isUnilateral: 0,
        bodyweightLoadFactor: 1,
      }),
      id: 'pull-up',
    };
    await db.exercises.add(pullUp);
    const workout = await seedWorkout({
      exerciseId: pullUp.id,
      performedAt: at(10, 5, 18),
      sets: [[0, 5]],
    });
    await rebuildAllRecords();
    const volumeRecords = async () =>
      (await db.personalRecords.toArray()).filter(
        (record) =>
          record.deletedAt === 0 &&
          record.workoutId === workout.id &&
          record.type === 'max_volume_session',
      );
    expect(await volumeRecords()).toHaveLength(0);

    await saveMeasurement({ type: 'body_weight', value: 80, unit: 'kg', measuredAt: at(10, 5, 8) });

    // 5 répétitions à 80 kg de poids de corps : sans la réconciliation, la séance resterait à zéro.
    expect((await volumeRecords()).map((record) => record.value)).toEqual([400]);
  });
});

describe('deleteMeasurement', () => {
  beforeEach(resetDb);

  it('supprime doucement : la ligne reste, la lecture ne la voit plus', async () => {
    await saveMeasurement({ type: 'waist', value: 84, unit: 'cm', measuredAt: at(10, 3) });
    await saveMeasurement({ type: 'waist', value: 83, unit: 'cm', measuredAt: at(10, 4) });
    const [first] = await listMeasurements('waist');

    await deleteMeasurement(first!.id);

    expect(await db.bodyMeasurements.count()).toBe(2);
    expect((await db.bodyMeasurements.get(first!.id))?.deletedAt).toBeGreaterThan(0);
    expect((await listMeasurements('waist')).map((reading) => reading.value)).toEqual([83]);
  });

  it('ne fait rien pour une ligne inconnue ou déjà supprimée', async () => {
    const gone = row('waist', 90, at(9, 1), 'cm', at(9, 2));
    await db.bodyMeasurements.add(gone);
    const before = await db.bodyMeasurements.toArray();

    await deleteMeasurement('inconnue');
    await deleteMeasurement(gone.id);

    expect(await db.bodyMeasurements.toArray()).toEqual(before);
  });

  it('refait le tonnage quand c’est un poids de corps qu’on supprime', async () => {
    const pullUp = {
      ...newEntity<Exercise>({
        name: 'Traction',
        primaryMuscle: 'lats',
        secondaryMuscles: [],
        equipment: 'bodyweight',
        measurementType: 'reps_only',
        isCustom: 1,
        isUnilateral: 0,
        bodyweightLoadFactor: 1,
      }),
      id: 'pull-up',
    };
    await db.exercises.add(pullUp);
    const workout = await seedWorkout({
      exerciseId: pullUp.id,
      performedAt: at(10, 5, 18),
      sets: [[0, 5]],
    });
    await saveMeasurement({ type: 'body_weight', value: 80, unit: 'kg', measuredAt: at(10, 5, 8) });
    const sessionRecord = async () =>
      (await db.personalRecords.toArray()).filter(
        (record) =>
          record.deletedAt === 0 &&
          record.workoutId === workout.id &&
          record.type === 'max_volume_session',
      );
    expect((await sessionRecord()).map((record) => record.value)).toEqual([400]);
    const [weight] = await listMeasurements('body_weight');

    await deleteMeasurement(weight!.id);

    expect(await sessionRecord()).toHaveLength(0);
  });
});
