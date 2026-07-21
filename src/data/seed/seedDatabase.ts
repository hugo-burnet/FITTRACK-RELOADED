import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Syncable } from '@/data/types';
import catalogue from './exercises.json';

/**
 * A catalogue row: an Exercise without its Syncable fields (stamped on insert)
 * and without `isCustom` (always 0 here), with a mandatory `slug`.
 */
export type CatalogueExercise = Omit<Exercise, keyof Syncable | 'isCustom'> & { slug: string };

// JSON modules widen every string to `string`, so the union types are lost on
// import. The cast is checked instead by the catalogue tests, which validate
// every row against MUSCLE_GROUPS / EQUIPMENT / MEASUREMENT_TYPES.
const CATALOGUE = catalogue as CatalogueExercise[];

/** How many exercises ship with the app. Shown on the debug screen. */
export const CATALOGUE_SIZE = CATALOGUE.length;

/**
 * Inserts the missing catalogue exercises. Runs on every startup, so it must be
 * strictly additive:
 *
 * - it never writes to an existing row, which would silently wipe the user's
 *   notes and per-exercise rest times on every launch;
 * - it keys on `slug`, so an exercise added to a later version of the catalogue
 *   lands on the next start without duplicating the rest;
 * - a soft-deleted catalogue exercise keeps its slug, so it is *not* re-inserted:
 *   removing an exercise you never do is a decision, not an accident to undo.
 */
export async function seedDatabase(): Promise<void> {
  const known = new Set<string>();
  await db.exercises.each((exercise) => {
    if (exercise.slug !== undefined) known.add(exercise.slug);
  });

  const missing = CATALOGUE.filter((entry) => !known.has(entry.slug));
  if (missing.length === 0) return;

  await db.exercises.bulkAdd(
    missing.map((entry) => newEntity<Exercise>({ ...entry, isCustom: 0 })),
  );
}
