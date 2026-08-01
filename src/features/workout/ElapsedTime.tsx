import { useEffect, useState } from 'react';
import { formatElapsed } from './elapsed';

/**
 * How long the session has been running, ticking every second.
 *
 * Derived from `workout.startedAt` rather than counted in a store: the elapsed
 * time is a subtraction from a number already in the database, and ADR-004 is
 * explicit that duplicating persisted data into a store is where lost sessions
 * come from. Killing the app and reopening it therefore shows the right figure
 * with nothing to restore.
 */
export function ElapsedTime({
  startedAt,
  className = '',
  label,
}: {
  startedAt: number;
  className?: string;
  /**
   * An accessible name, for the one caller where the figure stands alone.
   *
   * Optional rather than built in: on the finish screen and the resume bar the
   * reading already sits under a written label, and naming it here would have a
   * screen reader announce the same thing twice. Deliberately not a live region
   * either — a value that speaks every second is unusable.
   */
  label?: (time: string) => string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = formatElapsed((now - startedAt) / 1000);

  return (
    <span className={`metric tabular ${className}`} aria-label={label?.(time)}>
      {time}
    </span>
  );
}
