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
}: {
  startedAt: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className={`metric tabular ${className}`}>{formatElapsed((now - startedAt) / 1000)}</span>;
}
