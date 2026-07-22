const two = (value: number): string => String(value).padStart(2, '0');

/**
 * How long the session has been running, as a clock reads it: m:ss under an
 * hour, h:mm:ss past it.
 *
 * A separate module from the component that shows it, so the rendering stays a
 * component and this stays testable — the browser panel never composes a frame
 * (Lot 4), which makes anything ticking there impossible to observe.
 */
export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe / 60) % 60;
  const rest = safe % 60;

  return hours > 0 ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`;
}
