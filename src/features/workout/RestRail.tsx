import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
 * The rest timer, entire: a bar in a lane on the resting exercise's card, anchored
 * to the bottom of its header — the divider between header and body, which is also
 * the card's own bottom edge once the finished exercise folds. No row, no control,
 * no tap target — the session screen gains nothing it did not already have.
 *
 * It sits **in a track** rather than on the row's own edge. Without one it ran
 * wall to wall when full and read as a border between two rows, which is the
 * defect this shape was reported with: "quand il se remplit, il se fond avec
 * d'autres trucs, ça fait pas fini". A lane gives the bar an end to reach.
 *
 * The bar is advanced by the **compositor**, not by a tick. It was first driven
 * by a `setState` every second, and it moved in one-second jerks — reported as
 * "des à-coups par seconde, je voyais plutôt une ligne bien fluide". So instead
 * a single linear transition is armed once, from wherever the rest currently is
 * to full, lasting exactly as long as the rest has left; the browser fills in
 * every frame between. A CSS transition is timed off the wall clock, so it is
 * also correct after the tab is backgrounded — where the old once-a-second tick
 * was throttled to roughly one step a minute and the bar lurched on return.
 */
export function RestRail({ startedAt, endsAt, onDone }: Props) {
  const barRef = useRef<HTMLSpanElement | null>(null);

  // Read once: a rest lives about two minutes, far less than it takes to change
  // an OS accessibility setting mid-set, so there is nothing to subscribe to.
  const [reduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  // Pinned rather than depended on: the caller passes an inline arrow and the
  // grid above re-renders on every keystroke, which would re-arm the timers
  // below on each character.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  /**
   * Both moments are armed **once, from the deadline** — and neither depends on
   * a tick.
   *
   * Depending on `now` is what the first version did, and it was silently
   * broken: `now` changed every second, so each tick cleared the pending
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

  /**
   * Arm the smooth bar: jump to the current position with no animation, force a
   * reflow so the browser takes that as the start, then let it glide to full
   * over the time that is left. Skipped under reduced motion, where the stepped
   * path below owns the width instead.
   */
  useLayoutEffect(() => {
    if (reduced) return;
    const bar = barRef.current;
    if (bar === null) return;
    const remaining = Math.max(0, endsAt - Date.now());
    bar.style.transition = 'none';
    bar.style.width = `${restProgress(startedAt, endsAt, Date.now()) * 100}%`;
    if (remaining === 0) return;
    void bar.offsetWidth; // commit the start position before the next line animates from it
    bar.style.transition = `width ${remaining}ms linear`;
    bar.style.width = '100%';
  }, [startedAt, endsAt, reduced]);

  // The stepped fallback: under reduced motion the bar advances once a second,
  // in discrete steps, rather than animating. Its tick runs only then, so the
  // smooth path carries no per-second re-render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reduced) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reduced]);

  const progress = restProgress(startedAt, endsAt, now);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <span
      // The lane. Inset from the row's walls so a full bar can never be read as
      // a rule between two rows: a border runs edge to edge, this stops short.
      // Lifted a few px off the header divider rather than sitting flush on it —
      // reported from the phone as glued to the separator; the gap lets the bar
      // read as its own object instead of a thickening of the rule below it.
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-3 bottom-[5px] h-[3px] overflow-hidden
        rounded-full bg-[var(--border)]"
    >
      <span
        ref={barRef}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        // Queryable on demand, and deliberately not a live region: a reading
        // that speaks every second is unusable with a screen reader.
        aria-valuetext={t('workout.restRemaining', { time: formatRest(remaining) })}
        className="block h-full rounded-full bg-[var(--accent-ink)]"
        // Reduced motion: the width is stepped here, once a second. Otherwise the
        // layout effect owns it, so React must not fight it with a value of its own.
        style={reduced ? { width: `${progress * 100}%` } : undefined}
      />
    </span>
  );
}

/**
 * « ● Repos 0:47 » — the rest countdown, to the second, in the status line of the
 * card whose set is resting. It replaces that card's subtitle while the rest runs
 * and vanishes with it, so a rest is the *state of the moment*, not a third thing
 * to fit on the row.
 *
 * Its own component so its per-second tick re-renders **only itself** — never the
 * card around it, and never the sibling `RestRail`, which the compositor drives
 * and must not be re-rendered every second (cf. its note above).
 */
export function RestStatus({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--accent-ink)]">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--accent-ink)]" />
      <span className="tabular truncate">
        {t('workout.restLabel', { duration: formatRest(remaining) })}
      </span>
    </span>
  );
}
