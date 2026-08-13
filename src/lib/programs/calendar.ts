const MILLISECONDS_PER_DAY = 86_400_000;

const civilOrdinal = (timestamp: number): number => {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MILLISECONDS_PER_DAY;
};

export type ProgramPosition =
  | { phase: 'before' }
  | { phase: 'active'; weekIndex: number; dayOfWeek: number }
  | { phase: 'after' };

export function programPosition(
  startsAt: number,
  durationWeeks: number,
  at: number,
): ProgramPosition {
  const daysSinceStart = civilOrdinal(at) - civilOrdinal(startsAt);

  if (daysSinceStart < 0) return { phase: 'before' };

  const weekIndex = Math.floor(daysSinceStart / 7);
  if (weekIndex >= durationWeeks) return { phase: 'after' };

  return { phase: 'active', weekIndex, dayOfWeek: isoDayOfWeek(at) };
}

export function shiftLocalDate(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function isoDayOfWeek(timestamp: number): number {
  const day = new Date(timestamp).getDay();
  return day === 0 ? 7 : day;
}
