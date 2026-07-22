import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/fr';
import { formatRest, restProgress } from '@/lib/rest';
import { buzzRestOver, playChime } from './restChime';

/** How long the full bar stays before the row goes back to normal. */
const GRACE_MS = 4000;

type Props = {
  startedAt: number;
  endsAt: number;
  /** Fired once the grace is over. The slot is free after this. */
  onDone: () => void;
};

/**
 * The rest timer, entire: a bar in a lane along the bottom of the set you just
 * ticked. No row, no control, no tap target — the session screen gains nothing
 * it did not already have.
 *
 * It sits **in a track** rather than on the row's own edge. Without one it ran
 * wall to wall when full and read as a border between two rows, which is the
 * defect this shape was reported with: "quand il se remplit, il se fond avec
 * d'autres trucs, ça fait pas fini". A lane gives the bar an end to reach.
 *
 * Ticking once a second like `ElapsedTime`, and derived from an instant rather
 * than counted: a backgrounded tab is throttled to about one tick a minute, so
 * anything that counted would drift, and coming back would show a lie.
 */
export function RestRail({ startedAt, endsAt, onDone }: Props) {
  const [now, setNow] = useState(() => Date.now());

  // Pinned rather than depended on: the caller passes an inline arrow and the
  // grid above re-renders on every keystroke, which would re-arm the timers
  // below on each character.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const progress = restProgress(startedAt, endsAt, now);

  /**
   * Both moments are armed **once, from the deadline** — and neither depends on
   * `now`.
   *
   * Depending on the tick is what the first version did, and it was silently
   * broken: `now` changes every second, so each tick cleared the pending
   * timeout and started a fresh one. The grace never elapsed and the bar stood
   * for the whole session. Found by driving the screen, not by a test — the
   * same trap `UndoRow` documents, walked into anyway.
   *
   * Computing the delay from the instant rather than passing a fixed duration
   * also makes a late mount correct instead of restarting the rest.
   */
  useEffect(() => {
    const delay = endsAt - Date.now();
    if (delay <= 0) return;
    const id = setTimeout(() => {
      playChime();
      buzzRestOver();
    }, delay);
    return () => clearTimeout(id);
  }, [endsAt]);

  useEffect(() => {
    // A bounded timer, never a transition event: `transitionend` never arrives
    // in a backgrounded tab, and the bar would stay up for the whole session.
    const id = setTimeout(() => done.current(), Math.max(0, endsAt + GRACE_MS - Date.now()));
    return () => clearTimeout(id);
  }, [endsAt]);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <span
      // The lane. Inset from the row's walls so a full bar can never be read as
      // a rule between two rows: a border runs edge to edge, this stops short.
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-3 bottom-1 h-[3px] overflow-hidden
        rounded-full bg-[var(--border)]"
    >
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        // Queryable on demand, and deliberately not a live region: a reading
        // that speaks every second is unusable with a screen reader.
        aria-valuetext={t('workout.restRemaining', { time: formatRest(remaining) })}
        className="block h-full rounded-full bg-[var(--accent-ink)]"
        style={{ width: `${progress * 100}%` }}
      />
    </span>
  );
}
