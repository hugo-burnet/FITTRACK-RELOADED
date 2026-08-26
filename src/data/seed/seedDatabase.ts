import { db } from '@/data/db';
import { newEntity, touch } from '@/data/repositories/base';
import type { Exercise, MovementPattern, Syncable } from '@/data/types';
import catalogue from './exercises.json';

/**
 * A catalogue row: an Exercise without its Syncable fields (stamped on insert)
 * and without `isCustom` (always 0 here), with a mandatory `slug`.
 */
export type CatalogueExercise = Omit<Exercise, keyof Syncable | 'isCustom'> & { slug: string };

/**
 * La source JSON porte `movementPattern: null` là où aucune des quatorze
 * familles ne décrit honnêtement le mouvement — cardio, étirements, mobilité.
 * `null` est une **décision auditée**, pas une case vide : le test du catalogue
 * exige que chaque ligne porte la propriété.
 *
 * Le modèle persisté, lui, ne connaît pas `null` : il connaît l'absence du
 * champ. Traduire ici évite de stocker une troisième valeur qui voudrait dire la
 * même chose que l'absence.
 */
type CatalogueSourceExercise = Omit<CatalogueExercise, 'movementPattern'> & {
  movementPattern: MovementPattern | null;
};

// JSON modules widen every string to `string`, so the union types are lost on
// import. The cast is checked instead by the catalogue tests, which validate
// every row against MUSCLE_GROUPS / EQUIPMENT / MEASUREMENT_TYPES /
// MOVEMENT_PATTERNS.
const SOURCE_CATALOGUE = catalogue as CatalogueSourceExercise[];

const CATALOGUE: CatalogueExercise[] = SOURCE_CATALOGUE.map(({ movementPattern, ...entry }) =>
  movementPattern === null ? entry : { ...entry, movementPattern },
);

/** How many exercises ship with the app. Shown on the debug screen. */
export const CATALOGUE_SIZE = CATALOGUE.length;

/**
 * Inserts the missing catalogue exercises, then realigns the owned metadata of
 * the ones already there. Runs on every startup, so what it may write is kept
 * deliberately narrow:
 *
 * - it keys on `slug`, so an exercise added to a later version of the catalogue
 *   lands on the next start without duplicating the rest;
 * - a soft-deleted catalogue exercise keeps its slug, so it is *not* re-inserted:
 *   removing an exercise you never do is a decision, not an accident to undo;
 * - it only overwrites the muscle classification and the approved bodyweight
 *   coefficient on an existing row. Notes and
 *   per-exercise rest times are never touched — wiping those on every launch is
 *   exactly what this function used to be strictly additive to avoid.
 */
export async function seedDatabase(): Promise<void> {
  const rows = await db.exercises.toArray();
  const known = new Set(
    rows.flatMap((exercise) => (exercise.slug === undefined ? [] : [exercise.slug])),
  );

  const missing = CATALOGUE.filter((entry) => !known.has(entry.slug));
  if (missing.length > 0) {
    await db.exercises.bulkAdd(
      missing.map((entry) => newEntity<Exercise>({ ...entry, isCustom: 0 })),
    );
  }

  await reconcileShippedMetadata(rows);
}

/**
 * Realigns the muscle classification and approved bodyweight coefficient of the
 * shipped exercises, and nothing else.
 *
 * Added after a real failure. Being strictly additive, the seed above could
 * insert a new exercise but never *correct* one — so when hip adduction turned
 * out to be filed under `glutes`, and seven horizontal rows under `lats`, the
 * fix reached a fresh install and no one else. Worse, «réparer l'historique»
 * replays the library onto past sessions, so it dutifully copied the same wrong
 * muscle back over them: the repair could not outrun a stale catalogue.
 *
 * **Only `primaryMuscle`, `secondaryMuscles`, and `bodyweightLoadFactor`.** Which muscle a movement
 * trains is anatomy the app is answerable for, and every chart depends on it.
 * The name, the notes, the default rest are the user's — "siège position 4" is
 * the very example Lot 3 was checkpointed on — and they are never touched, on
 * any row, for any reason.
 *
 * The accepted cost, stated rather than hidden: someone who deliberately
 * reclassified a shipped exercise will see it realigned. Their own exercises
 * (`isCustom: 1`, no slug) are untouchable, and that is where a disagreement
 * belongs — with one exception since the coefficient became editable on the
 * sheet: a row flagged `bodyweightLoadFactorIsCustom` keeps its coefficient,
 * because a figure the lifter typed there is an answer, not drift. Soft-deleted rows are realigned too: a deleted exercise is still the
 * one that was performed, and its history still reads its muscle.
 */
async function reconcileShippedMetadata(rows: readonly Exercise[]): Promise<void> {
  const shipped = new Map(CATALOGUE.map((entry) => [entry.slug, entry]));

  const drifted = rows.flatMap((row) => {
    // No slug means the user made it. `isCustom` is checked too rather than
    // trusted alone: two independent reasons to leave a row alone is right for
    // a write that runs on every single startup.
    if (row.slug === undefined || row.isCustom === 1) return [];
    const entry = shipped.get(row.slug);
    if (entry === undefined) return [];

    /**
     * A coefficient the lifter set themselves is theirs, and the catalogue steps
     * back from it — permanently.
     *
     * Without this the sheet's new "part du poids du corps" field would have
     * been a trap: type 100 % on a shipped back extension, close the app, and
     * the very next launch would silently put it back to nothing, because this
     * function runs on every start. The muscles stay realigned either way —
     * anatomy is still the app's answer — but the one figure the user typed is
     * not the app's to correct.
     */
    const factorIsTheirs = row.bodyweightLoadFactorIsCustom === 1;

    const same =
      row.primaryMuscle === entry.primaryMuscle &&
      row.secondaryMuscles.length === entry.secondaryMuscles.length &&
      row.secondaryMuscles.every((muscle, index) => muscle === entry.secondaryMuscles[index]) &&
      row.movementPattern === entry.movementPattern &&
      (factorIsTheirs || row.bodyweightLoadFactor === entry.bodyweightLoadFactor);

    // Nothing written when nothing differs: this runs at every launch, and a
    // no-op that still bumps `updatedAt` would make every row look dirty to the
    // future sync (ADR-002).
    if (same) return [];

    /**
     * La famille de mouvement suit la même règle que les muscles : c'est une
     * classification dont l'application répond, et le wiki s'en sert pour
     * décider quel article rattacher. Une décision `null` du catalogue retire
     * le champ au lieu d'y écrire une valeur — l'absence *est* la réponse.
     */
    const base = {
      primaryMuscle: entry.primaryMuscle,
      secondaryMuscles: [...entry.secondaryMuscles],
    };
    const patternless = { ...row };
    delete patternless.movementPattern;
    const target = entry.movementPattern === undefined ? patternless : row;
    const changes =
      entry.movementPattern === undefined
        ? base
        : { ...base, movementPattern: entry.movementPattern };

    if (factorIsTheirs) return [touch(target, changes)];

    if (entry.bodyweightLoadFactor === undefined) {
      const withoutFactor = { ...target };
      delete withoutFactor.bodyweightLoadFactor;
      return [touch(withoutFactor, changes)];
    }

    return [touch(target, { ...changes, bodyweightLoadFactor: entry.bodyweightLoadFactor })];
  });

  if (drifted.length > 0) await db.exercises.bulkPut(drifted);
}
