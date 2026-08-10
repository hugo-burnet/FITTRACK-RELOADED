import Dexie from 'dexie';
import { db } from '@/data/db';
import { newEntity, touch } from '@/data/repositories/base';
import type { BodyMeasurement } from '@/data/types';

const BODY_WEIGHT_TYPE = 'body_weight';

export interface BodyWeightReading {
  valueKg: number;
  measuredAt: number;
}

function localDayBounds(timestamp: number): readonly [number, number] {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return [start.getTime(), end.getTime()];
}

async function liveBodyWeightRows(): Promise<BodyMeasurement[]> {
  const rows = await db.bodyMeasurements
    .where('[type+measuredAt]')
    .between([BODY_WEIGHT_TYPE, Dexie.minKey], [BODY_WEIGHT_TYPE, Dexie.maxKey])
    .toArray();

  return rows.filter((row) => row.deletedAt === 0);
}

function asReading(row: BodyMeasurement): BodyWeightReading {
  return { valueKg: row.value, measuredAt: row.measuredAt };
}

function assertValidBodyWeight(valueKg: number): void {
  if (!Number.isFinite(valueKg) || valueKg <= 0) {
    throw new RangeError('Body weight must be a finite positive number');
  }
}

export async function getLatestBodyWeight(): Promise<BodyWeightReading | undefined> {
  const rows = await liveBodyWeightRows();
  let latest: BodyMeasurement | undefined;

  for (const row of rows) {
    if (latest === undefined || row.measuredAt > latest.measuredAt) latest = row;
  }

  return latest === undefined ? undefined : asReading(latest);
}

export async function saveBodyWeight(
  valueKg: number,
  measuredAt = Date.now(),
): Promise<BodyWeightReading> {
  assertValidBodyWeight(valueKg);
  const [dayStart, nextDayStart] = localDayBounds(measuredAt);

  return db.transaction('rw', db.bodyMeasurements, async () => {
    const sameDay = await db.bodyMeasurements
      .where('[type+measuredAt]')
      .between([BODY_WEIGHT_TYPE, dayStart], [BODY_WEIGHT_TYPE, nextDayStart], true, false)
      .toArray();
    const existing = sameDay.find((row) => row.deletedAt === 0);

    if (existing !== undefined) {
      // A correction changes the day's value, not the instant from which that value applies.
      // Moving an 08:00 reading to the 20:00 correction time would retroactively make a 09:00
      // workout fall back to yesterday's weight.
      const replacement = touch(existing, { value: valueKg, unit: 'kg' });
      await db.bodyMeasurements.put(replacement);
      return asReading(replacement);
    }

    const created = newEntity<BodyMeasurement>({
      type: BODY_WEIGHT_TYPE,
      value: valueKg,
      unit: 'kg',
      measuredAt,
    });
    await db.bodyMeasurements.add(created);
    return asReading(created);
  });
}

export async function resolveBodyWeightsAt(
  timestamps: readonly number[],
): Promise<Map<number, number>> {
  const rows = await liveBodyWeightRows();
  if (rows.length === 0) return new Map();

  rows.sort((left, right) => left.measuredAt - right.measuredAt);
  const resolved = new Map<number, number>();

  for (const timestamp of timestamps) {
    let low = 0;
    let high = rows.length - 1;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (rows[middle]!.measuredAt <= timestamp) low = middle;
      else high = middle - 1;
    }

    const index = rows[low]!.measuredAt > timestamp ? 0 : low;
    resolved.set(timestamp, rows[index]!.value);
  }

  return resolved;
}
