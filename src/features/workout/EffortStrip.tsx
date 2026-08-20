import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '@/i18n/fr';
import { CheckIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';

/** As long as the strip waits for an answer. Long enough to rack the bar. */
const GRACE_MS = 20_000;

/** `--dur-2`, in a number: the collapse has to finish before the slot goes. */
const CLOSE_MS = 220;

/**
 * "How hard was that?", asked once, under the set it is asking about.
 *
 * **One rail, one thumb, one confirmation.** Adjectives made the lifter first
 * translate effort into a word and the app translate that word back into a
 * number. The gauge exposes the actual 6–10 scale in half-point detents. Its
 * large thumb is the only moving part; the check is deliberately separate so
 * a finger sliding across the row never records an accidental value.
 *
 * **Ignoring it is a valid answer.** It expires on its own, exactly like the
 * undo strip, and takes nothing with it: the set is already written, the rest is
 * already running. Nothing here is a gate.
 *
 * **It sits under its own set**, for the same reason `RecordNote` does: this
 * screen holds twenty near-identical rows, and a prompt at the foot of the
 * screen could never say which one it means.
 *
 * **It is a piece of the machine, not a settings slider.** Nine engraved
 * detents sit on the same raised surface as the validated set. The accent only
 * fills the loaded part of the rail and the current figure uses the app's
 * metric typography.
 *
 * **The rest bonus is not printed on the answers.** It used to be, and it cost
 * twice: three-line labels wrapping inside four cramped chips, and — worse — a
 * price tag on each answer, which invites choosing "Dur" to buy thirty seconds
 * rather than because the set was hard. An RPE that can be gamed is not a
 * measurement. The extra rest is felt where it happens: the countdown sits two
 * lines above, already on screen, and jumps the moment you answer.
 */
export function EffortStrip({
  onAnswer,
  onExpire,
}: {
  onAnswer: (rpe: number) => void;
  onExpire: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [value, setValue] = useState(8);

  // Pinned, not depended on: the grid above re-renders at every keystroke, and
  // a dependency here would restart the twenty seconds on each one.
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    const timer = setTimeout(() => setClosing(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => expire.current(), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  return (
    <div
      role="group"
      aria-label={t('workout.effortQuestion')}
      className="grid transition-[grid-template-rows] duration-[var(--dur-2)] ease-[var(--ease-mech)]"
      style={{ gridTemplateRows: closing ? '0fr' : '1fr' }}
    >
      <div className="overflow-hidden">
        {/* 12 px in, like `RestRail` and `RecordNote`: everything that hangs off
            a set line agrees on the same inset. */}
        <div className="flex min-h-24 items-stretch bg-[var(--surface-2)] px-3">
          <div className="min-w-0 flex-1 py-2">
            <div className="flex items-baseline justify-between">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('workout.rpeGaugeLabel')}
              </span>
              <output className="metric text-xl font-bold text-[var(--accent-ink)]">
                {formatNumber(value)}
              </output>
            </div>
            <div className="relative mt-0.5">
              <input
                type="range"
                min={6}
                max={10}
                step={0.5}
                value={value}
                aria-label={t('workout.rpeGauge')}
                aria-valuetext={t('workout.rpeValue', { value: formatNumber(value) })}
                onChange={(event) => setValue(Number(event.currentTarget.value))}
                className="rpe-gauge block w-full"
                style={{ '--rpe-progress': `${((value - 6) / 4) * 100}%` } as CSSProperties}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[13px] bottom-[7px] grid grid-cols-9"
              >
                {Array.from({ length: 9 }, (_, index) => (
                  <span key={index} className="mx-auto h-1 w-px bg-[var(--text-2)] opacity-70" />
                ))}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="metric -mt-0.5 flex justify-between text-xs text-[var(--text-2)]"
            >
              <span>6</span>
              <span>10</span>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('workout.rpeConfirm', { value: formatNumber(value) })}
            onClick={() => {
              setClosing(true);
              onAnswer(value);
            }}
            className="ml-3 flex w-12 shrink-0 items-center justify-center border-l
              border-[var(--border)] text-[var(--accent-ink)] transition-colors
              duration-[var(--dur-1)] active:bg-[var(--surface-1)]"
          >
            <CheckIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
