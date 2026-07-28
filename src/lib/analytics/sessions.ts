import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import type { ExportSource } from '@/lib/export/types';
import type { AnalyticsSession } from './metrics';

/**
 * The rows the repository hands over, as sessions a metric can score.
 *
 * Pure by construction (architecture §7). It reads `ExportSource` — the same
 * DTO the exports read — because the charts and the exports ask history the
 * exact same question and must not answer it through two different doors. Cf.
 * the spec, §1: `listExportSources` already applies every rule §9.1 of the
 * finishing document lists.
 *
 * The only real decision here is which identity a past session is read under,
 * and it is not this module's to make: `resolveExerciseIdentity` (milestone 08B)
 * owns it — the row's snapshot, then today's library, then nothing, field by
 * field. Reading the library first is what made a rename rewrite the past.
 */
export function toAnalyticsSessions(sources: readonly ExportSource[]): AnalyticsSession[] {
  return sources.map((source) => {
    // One session is one point. An exercise performed twice in the same session —
    // a superset, or a movement picked up again at the end — is still one
    // session: two points at the same instant would fold the curve over itself.
    const sets = source.exercises.flatMap((entry) => entry.sets);

    // The first row's identity, because under an exercise scope every row here
    // *is* that exercise. Its snapshot is the one the session was recorded with.
    const first = source.exercises[0];
    const identity = first === undefined ? {} : resolveExerciseIdentity(first.row, first.exercise);

    return {
      workoutId: source.workout.id,
      // `startedAt`, never a set's `performedAt`: the Hevy import interpolates
      // set times, so the first set is not the start of anything.
      startedAt: source.workout.startedAt,
      ...(identity.measurementType === undefined
        ? {}
        : { measurementType: identity.measurementType }),
      sets,
    };
  });
}
