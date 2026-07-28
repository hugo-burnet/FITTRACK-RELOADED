import { MUSCLE_GROUPS, type MuscleGroup, type WorkoutSet } from '@/data/types';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import type { ExportSource } from '@/lib/export/types';
import { isWorkingSet } from '@/lib/records';

/**
 * Working sets per muscle group — RF-42, the distribution.
 *
 * Pure by construction (architecture §7). Nothing here reads Dexie and nothing
 * here writes French.
 *
 * **Primary muscle only, and that is a decision rather than a shortcut.** The
 * snapshot milestone 08A freezes onto a session row carries `primaryMuscle` and
 * deliberately not `secondaryMuscles`, which exist only in *today's* library. A
 * distribution reading them would redistribute six months of past sets the
 * moment an exercise is edited — the very bug 08B spent a session repairing,
 * transposed from the name to the muscle.
 *
 * And a weighted attribution (1 to the primary, 0.4 to the secondaries) could
 * not be a unit of counting anyway: "48" would stop being a number of sets and
 * become a score whose total no longer matches what was performed, and which no
 * manual count in the history could ever confirm. **A count is checkable, a
 * score is taken on trust** — and being checkable is this screen's only claim.
 */

/** What a group is, for the purposes of a distribution. */
export type MuscleScope =
  /** A region of the body. A zero on it is a gap worth naming. */
  | 'region'
  /** cardio, full_body, other: no region, and no shortfall to report. */
  | 'unscoped';

/**
 * Every group, classified — a `Record` and not a list, so adding a value to
 * `MUSCLE_GROUPS` without classifying it **fails the typecheck** instead of
 * leaving it silently off the chart. Same mechanism as `muscle.*` in `fr.ts`,
 * and the same trap the roadmap names for Lot 5bis: it exists, but nothing
 * shows it.
 *
 * The criterion is not anatomy for its own sake, it is whether a zero means
 * anything: "0 sets of Full body" and "0 sets of Other" tell nobody anything —
 * those are filing boxes, not muscles. `neck` stays a region and gets no special
 * case: deciding which muscles deserve a row would be the app deciding what its
 * user is allowed to neglect.
 */
export const MUSCLE_SCOPE: Record<MuscleGroup, MuscleScope> = {
  chest: 'region',
  lats: 'region',
  upper_back: 'region',
  traps: 'region',
  shoulders: 'region',
  biceps: 'region',
  triceps: 'region',
  forearms: 'region',
  quads: 'region',
  hamstrings: 'region',
  glutes: 'region',
  calves: 'region',
  abs: 'region',
  lower_back: 'region',
  neck: 'region',
  full_body: 'unscoped',
  cardio: 'unscoped',
  other: 'unscoped',
};

/** One session row, reduced to what a count per muscle needs. */
export interface MuscleRow {
  /** Resolved by `resolveExerciseIdentity`: the snapshot, then the library. */
  primaryMuscle?: MuscleGroup;
  sets: WorkoutSet[];
}

export interface MuscleCount {
  /** `undefined` when the row's muscle could not be resolved at all. */
  muscle: MuscleGroup | undefined;
  sets: number;
}

export interface MuscleBalance {
  /** The fifteen regions, **all of them**, most-served first. */
  ranked: MuscleCount[];
  /** cardio / full_body / other / unknown — only when they carry something. */
  unscoped: MuscleCount[];
  /** Every working set counted, both lists together. */
  total: number;
}

/** Where a group sits in `MUSCLE_GROUPS`; unknown muscles come last. */
const canonicalIndex = (muscle: MuscleGroup | undefined): number =>
  muscle === undefined ? MUSCLE_GROUPS.length : MUSCLE_GROUPS.indexOf(muscle);

/**
 * The distribution — **the regions come from the anatomy, not from the data.**
 *
 * That is milestone G2's rule transposed, and what departs the two cases is not
 * "empty" but *what the app knows*. G2 could say nothing about a week before its
 * first recorded session; over a given period it knows completely what was done.
 * So "zero sets of calves in twelve weeks" is not a missing reading, it is an
 * observed fact — and it is the fact this screen exists to report. A neglected
 * muscle that drops off the list is a muscle nobody notices, which would be the
 * only real failure available to this screen.
 *
 * The three unscoped groups are the exception and they get the opposite rule:
 * shown only when they carry something. Hiding forty sets of cardio would be the
 * other fault — real work vanishing from a screen titled "sets per muscle".
 */
export function muscleBalance(rows: readonly MuscleRow[]): MuscleBalance {
  const counts = new Map<MuscleGroup | undefined, number>();
  // Every region starts at zero: the list is the anatomy, and a group only ever
  // adds to what is already there.
  for (const muscle of MUSCLE_GROUPS) {
    if (MUSCLE_SCOPE[muscle] === 'region') counts.set(muscle, 0);
  }

  for (const row of rows) {
    // RF-20 — warm-ups pollute neither volume nor records, and the rule is
    // `isWorkingSet`'s, restated nowhere.
    const sets = row.sets.filter(isWorkingSet).length;
    if (sets === 0) continue;
    // Added rather than assigned: an exercise picked up twice in the same
    // session is two rows, and here the unit is the set, not the session.
    counts.set(row.primaryMuscle, (counts.get(row.primaryMuscle) ?? 0) + sets);
  }

  const ranked: MuscleCount[] = [];
  const unscoped: MuscleCount[] = [];
  let total = 0;

  for (const [muscle, sets] of counts) {
    total += sets;
    // `undefined` is a hole in the app, `other` is a choice its user made.
    // Folding one into the other would erase the hole.
    const region = muscle !== undefined && MUSCLE_SCOPE[muscle] === 'region';
    if (region) ranked.push({ muscle, sets });
    else if (sets > 0) unscoped.push({ muscle, sets });
  }

  // Ties fall back on the canonical order — already anatomical, top to bottom,
  // and stable, so the rows do not dance between two renders.
  ranked.sort((a, b) => b.sets - a.sets || canonicalIndex(a.muscle) - canonicalIndex(b.muscle));
  unscoped.sort((a, b) => b.sets - a.sets || canonicalIndex(a.muscle) - canonicalIndex(b.muscle));

  return { ranked, unscoped, total };
}

/**
 * The repository's rows, under the identity **each session was recorded with**.
 *
 * The only real decision here is not this module's to make: `resolveExerciseIdentity`
 * (milestone 08B) owns it — the row's snapshot, then today's library, then
 * nothing, field by field. Reading the library first is what made a rename, and
 * would make a reclassification, rewrite the past.
 */
export function toMuscleRows(sources: readonly ExportSource[]): MuscleRow[] {
  return sources.flatMap((source) =>
    source.exercises.map((entry) => {
      const { primaryMuscle } = resolveExerciseIdentity(entry.row, entry.exercise);
      return {
        ...(primaryMuscle === undefined ? {} : { primaryMuscle }),
        sets: entry.sets,
      };
    }),
  );
}
