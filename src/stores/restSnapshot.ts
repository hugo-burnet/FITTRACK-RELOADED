import type { RestTimer } from './restTimer';

/** Invalid or elapsed snapshots must never restart a timer after launch. */
export function readRestSnapshot(raw: string | null, now = Date.now()): RestTimer | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const timer = value as Record<string, unknown>;
    if (typeof timer.setId !== 'string' || timer.setId === '') return null;
    const { startedAt, endsAt, seconds } = timer;
    if (
      typeof startedAt !== 'number' ||
      typeof endsAt !== 'number' ||
      typeof seconds !== 'number' ||
      !Number.isFinite(startedAt) ||
      !Number.isFinite(endsAt) ||
      !Number.isFinite(seconds) ||
      startedAt > now ||
      startedAt < 0 ||
      endsAt <= now ||
      seconds <= 0
    )
      return null;
    return { setId: timer.setId, startedAt, endsAt, seconds };
  } catch {
    return null;
  }
}
