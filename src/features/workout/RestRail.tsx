import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from '@/i18n/fr';
import { formatRest, restProgress } from '@/lib/rest';
import { signalRestFinishedOnCurrentPlatform } from './restAlert';
import { armRestCountdown } from './restCountdown';

type Props = {
  startedAt: number;
  endsAt: number;
  /** Returns true when the next set takes over with its repetition cadence. */
  onDone: () => boolean;
};

/** Compositor-driven progress bar anchored to the resting exercise. */
export function RestRail({ startedAt, endsAt, onDone }: Props) {
  const barRef = useRef<HTMLSpanElement | null>(null);

  const [reduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  // Keep inline callbacks from re-arming deadline timers on each keystroke.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  // The three ticks before the deadline, cancelled with the rest they count.
  useEffect(() => armRestCountdown(endsAt), [endsAt]);

  useEffect(() => {
    // The countdown hands the clock directly to the next set at zero. Its first
    // repetition beat replaces the old end-of-rest chime, so the two never land
    // on top of each other. Without a pace target, keep the normal alert.
    const id = setTimeout(() => {
      if (!done.current()) signalRestFinishedOnCurrentPlatform();
    }, Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(id);
  }, [endsAt]);

  // Commit the current position before transitioning to the deadline.
  useLayoutEffect(() => {
    if (reduced) return;
    const bar = barRef.current;
    if (bar === null) return;
    const remaining = Math.max(0, endsAt - Date.now());
    bar.style.transition = 'none';
    bar.style.width = `${restProgress(startedAt, endsAt, Date.now()) * 100}%`;
    if (remaining === 0) return;
    void bar.offsetWidth;
    bar.style.transition = `width ${remaining}ms linear`;
    bar.style.width = '100%';
  }, [startedAt, endsAt, reduced]);

  // Reduced motion uses discrete one-second updates.
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
        // Deliberately not live: announcing every second is unusable.
        aria-valuetext={t('workout.restRemaining', { time: formatRest(remaining) })}
        className="block h-full rounded-full bg-[var(--accent-ink)]"
        style={reduced ? { width: `${progress * 100}%` } : undefined}
      />
    </span>
  );
}

/** Isolates the per-second countdown from the surrounding exercise card. */
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
