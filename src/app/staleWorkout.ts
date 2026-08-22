export const STALE_WORKOUT_MS = 12 * 60 * 60 * 1_000;

export function isWorkoutStale(startedAt: number, now = Date.now()): boolean {
  return now - startedAt >= STALE_WORKOUT_MS;
}
