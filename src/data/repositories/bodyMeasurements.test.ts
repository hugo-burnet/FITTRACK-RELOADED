import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { BodyMeasurement } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import {
  getLatestBodyWeight,
  resolveBodyWeightsAt,
  saveBodyWeight,
} from './bodyMeasurements';

const at = (day: number, hour = 12): number => new Date(2026, 7, day, hour).getTime();

const bodyWeight = (value: number, measuredAt: number, deletedAt = 0): BodyMeasurement => ({
  ...newEntity<BodyMeasurement>({
    type: 'body_weight',
    value,
    unit: 'kg',
    measuredAt,
  }),
  deletedAt,
});

describe('body weight measurements', () => {
  beforeEach(resetDb);

  it('saves the first reading as a live kilogram body measurement', async () => {
    const reading = await saveBodyWeight(82.4, at(3));

    expect(reading).toEqual({ valueKg: 82.4, measuredAt: at(3) });
    expect(await db.bodyMeasurements.toArray()).toMatchObject([
      { type: 'body_weight', value: 82.4, unit: 'kg', measuredAt: at(3), deletedAt: 0 },
    ]);
  });

  it('replaces the measurement from the same local day without adding a row', async () => {
    await saveBodyWeight(82.4, at(3, 8));
    const replacement = await saveBodyWeight(81.9, at(3, 20));

    const rows = await db.bodyMeasurements.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 81.9, measuredAt: at(3, 8) });
    expect(replacement).toEqual({ valueKg: 81.9, measuredAt: at(3, 8) });
  });

  it('keeps a corrected daily weight effective from its original measurement time', async () => {
    await saveBodyWeight(83, at(2, 20));
    await saveBodyWeight(80, at(3, 8));
    await saveBodyWeight(81, at(3, 20));

    expect(await resolveBodyWeightsAt([at(3, 9)])).toEqual(new Map([[at(3, 9), 81]]));
  });

  it('inserts an independent measurement for another local day', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.9, at(4));

    expect(await db.bodyMeasurements.count()).toBe(2);
  });

  it('reads the latest live body-weight measurement', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.9, at(5));

    expect(await getLatestBodyWeight()).toEqual({ valueKg: 81.9, measuredAt: at(5) });
  });

  it('resolves each timestamp from the latest prior weight or the earliest fallback', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.8, at(7));

    expect(await resolveBodyWeightsAt([at(1), at(5), at(9)])).toEqual(
      new Map([
        [at(1), 82.4],
        [at(5), 82.4],
        [at(9), 81.8],
      ]),
    );
  });

  it('resolves an unordered batch independently for every timestamp', async () => {
    await saveBodyWeight(82.4, at(3));
    await saveBodyWeight(81.8, at(7));

    expect(await resolveBodyWeightsAt([at(9), at(1), at(5)])).toEqual(
      new Map([
        [at(9), 81.8],
        [at(1), 82.4],
        [at(5), 82.4],
      ]),
    );
  });

  it('ignores deleted rows on reads and resolution', async () => {
    await db.bodyMeasurements.bulkAdd([
      bodyWeight(90, at(1), at(2)),
      bodyWeight(82.4, at(3)),
    ]);

    expect(await getLatestBodyWeight()).toEqual({ valueKg: 82.4, measuredAt: at(3) });
    expect(await resolveBodyWeightsAt([at(1)])).toEqual(new Map([[at(1), 82.4]]));
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid body weight %s',
    async (valueKg) => {
      await expect(saveBodyWeight(valueKg, at(3))).rejects.toThrow(RangeError);
      expect(await db.bodyMeasurements.count()).toBe(0);
    },
  );
});
