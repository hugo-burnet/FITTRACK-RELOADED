import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from '@/i18n/fr';
import { formatRest, msUntilCritical, restProgress } from '@/lib/rest';
import { signalRestFinishedOnCurrentPlatform } from './restAlert';
import { armRestCountdown } from './restCountdown';

type Props = {
  startedAt: number;
  endsAt: number;
  /** Keeps the wall clock running while muting every rest-owned sound. */
  audioSuppressed: boolean;
  /** Returns true when the next set takes over with its repetition cadence. */
  onDone: (audioAllowed: boolean) => boolean;
};

/** Compositor-driven progress bar anchored to the resting exercise. */
export function RestRail({ startedAt, endsAt, audioSuppressed, onDone }: Props) {
  const barRef = useRef<HTMLSpanElement | null>(null);

  const [reduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  // Keep inline callbacks from re-arming deadline timers on each keystroke.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  // The deadline is armed once for the wall-clock instant, so keep the latest
  // RPE state in a ref rather than resetting that timer when the strip closes.
  const suppressed = useRef(audioSuppressed);
  useLayoutEffect(() => {
    suppressed.current = audioSuppressed;
  }, [audioSuppressed]);

  // The three ticks before the deadline, cancelled with the rest they count.
  useEffect(() => {
    if (audioSuppressed) return;
    return armRestCountdown(endsAt);
  }, [endsAt, audioSuppressed]);

  useEffect(() => {
    // The countdown hands the clock directly to the next set at zero. Its first
    // repetition beat replaces the old end-of-rest chime, so the two never land
    // on top of each other. Without a pace target, keep the normal alert.
    const id = setTimeout(
      () => {
        const audioAllowed = !suppressed.current;
        const paced = done.current(audioAllowed);
        if (audioAllowed && !paced) signalRestFinishedOnCurrentPlatform();
      },
      Math.max(0, endsAt - Date.now()),
    );
    return () => clearTimeout(id);
  }, [endsAt]);

  // Commit the current position before transitioning to the deadline. A `scaleX` and not a `width`:
  // the compositor runs it alone, with no layout and no paint on any frame of a two-minute rest —
  // animating the width repainted the whole page sixty times a second, twice as costly in Cyber.
  useLayoutEffect(() => {
    if (reduced) return;
    const bar = barRef.current;
    if (bar === null) return;
    const remaining = Math.max(0, endsAt - Date.now());
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${restProgress(startedAt, endsAt, Date.now())})`;
    if (remaining === 0) return;
    void bar.offsetWidth;
    bar.style.transition = `transform ${remaining}ms linear`;
    bar.style.transform = 'scaleX(1)';
  }, [startedAt, endsAt, reduced]);

  /*
   * Deux états que seul le thème Cyber dessine (sa barre de vie) et qui ne coûtent rien ailleurs :
   * les dix dernières secondes, et le coup d'un repos raccourci (−15 s). Un attribut chacun, posé ici
   * parce que c'est ici que vit l'échéance ; la feuille du thème fait le reste.
   */
  const [critical, setCritical] = useState(() => msUntilCritical(endsAt, Date.now()) === 0);
  useEffect(() => {
    // Hors du rendu, par minuteur : un +15 s dans la zone rouge doit pouvoir en faire sortir.
    const wait = msUntilCritical(endsAt, Date.now());
    const settle = setTimeout(() => setCritical(wait === 0), 0);
    const enter = wait > 0 ? setTimeout(() => setCritical(true), wait) : undefined;
    return () => {
      clearTimeout(settle);
      clearTimeout(enter);
    };
  }, [endsAt]);

  const [hit, setHit] = useState(false);
  /*
   * Le morceau de vie perdu par un −15 s, que Cyber détache de la barre et fait monter en s'évaporant
   * (« les traînées de perte partent vers le ciel »). Mesuré là où la vie restante se lit dans Cyber,
   * à gauche : de la vie d'après à la vie d'avant. Une clé par perte, pour que deux −15 rapprochés
   * fassent deux morceaux.
   */
  const [loss, setLoss] = useState<{ key: number; left: number; width: number } | null>(null);
  const previous = useRef({ startedAt, endsAt });
  useEffect(() => {
    const before = previous.current;
    previous.current = { startedAt, endsAt };
    if (endsAt >= before.endsAt) return;
    const now = Date.now();
    const lifeBefore = 1 - restProgress(before.startedAt, before.endsAt, now);
    const lifeAfter = 1 - restProgress(startedAt, endsAt, now);
    const show = setTimeout(() => {
      setHit(true);
      if (lifeBefore > lifeAfter) {
        setLoss((last) => ({
          key: (last?.key ?? 0) + 1,
          left: Math.round(lifeAfter * 100_000) / 1000,
          width: Math.round((lifeBefore - lifeAfter) * 100_000) / 1000,
        }));
      }
    }, 0);
    const hide = setTimeout(() => setHit(false), 450);
    const gone = setTimeout(() => setLoss(null), 900);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      clearTimeout(gone);
    };
  }, [startedAt, endsAt]);

  // Reduced motion uses discrete one-second updates.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reduced) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reduced]);

  const progress = restProgress(startedAt, endsAt, now);

  /*
   * Decoration, and declared as such. The bar used to carry a `progressbar`
   * role with a carefully worded `aria-valuetext` — inside a wrapper marked
   * `aria-hidden`, which removes the whole subtree from the accessibility tree.
   * The sentence was never announced by anything.
   *
   * Removed rather than un-hidden, because the countdown is already readable:
   * `RestStatus` prints it in the card, as text, once a second. Exposing the
   * bar too would say the same thing twice.
   */
  return (
    <>
      <span
        aria-hidden="true"
        data-part="meter-rail"
        data-crit={critical || undefined}
        data-hit={hit || undefined}
        className="pointer-events-none absolute inset-x-3 bottom-[5px] h-[3px] overflow-hidden
        rounded-full bg-[var(--border)]"
      >
        <span
          ref={barRef}
          className="block h-full w-full origin-left rounded-full bg-[var(--accent-ink)]"
          style={reduced ? { transform: `scaleX(${progress})` } : undefined}
        />
      </span>
      {/* Hors de la barre, qui rogne : le morceau perdu doit pouvoir monter. Caché hors de Cyber. */}
      <span
        aria-hidden="true"
        data-part="rest-loss"
        className="pointer-events-none absolute inset-x-3 bottom-[5px] h-[3px]"
      >
        {loss !== null && (
          <i key={loss.key} style={{ left: `${loss.left}%`, width: `${loss.width}%` }} />
        )}
      </span>
    </>
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
      <span
        aria-hidden="true"
        data-part="rest-dot"
        className="size-1.5 shrink-0 rounded-full bg-[var(--accent-ink)]"
      />
      <span className="tabular truncate">
        {t('workout.restLabel', { duration: formatRest(remaining) })}
      </span>
    </span>
  );
}
