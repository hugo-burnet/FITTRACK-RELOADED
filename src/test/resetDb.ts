import { db } from '@/data/db';

/**
 * Call from a `beforeEach` in every test that touches the database.
 *
 * Not optional: tests that share a database pass alone and fail in a suite, and
 * the cause takes hours to find because the failing test is not the guilty one.
 */
export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}
