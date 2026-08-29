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
 * **One quiet line.** Adjectives made the lifter first translate effort into a
 * word and the app translate that word back into a number. The gauge exposes
 * the actual 6–10 scale, but it stays subordinate to the set: label, fine rail,
 * value, check. Confirmation remains separate so a sliding finger never
 * records an accidental value.
 *
 * **Ignoring it is a valid answer.** It expires on its own, exactly like the
 * undo strip, and takes nothing with it: the set is already written, the rest is
 * already running. Nothing here is a gate.
 *
 * **It sits under its own set**, for the same reason `RecordNote` does: this
 * screen holds twenty near-identical rows, and a prompt at the foot of the
 * screen could never say which one it means.
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
        <div className="flex min-h-14 items-center gap-2 bg-[var(--surface-2)] px-3">
          <span className="label-xs w-7 shrink-0 font-semibold text-[var(--text-2)]">
            {t('workout.rpeGaugeLabel')}
          </span>
          <input
            type="range"
            min={6}
            max={10}
            step={0.5}
            value={value}
            aria-label={t('workout.rpeGauge')}
            aria-valuetext={t('workout.rpeValue', { value: formatNumber(value) })}
            onChange={(event) => setValue(Number(event.currentTarget.value))}
            className="rpe-gauge min-w-0 flex-1"
            style={{ '--rpe-progress': `${((value - 6) / 4) * 100}%` } as CSSProperties}
          />
          <output className="metric w-7 shrink-0 text-center text-base font-semibold text-[var(--text-1)]">
            {formatNumber(value)}
          </output>
          <button
            type="button"
            aria-label={t('workout.rpeConfirm', { value: formatNumber(value) })}
            data-tutorial-id="workout-rpe"
            onClick={() => {
              setClosing(true);
              onAnswer(value);
            }}
            className="flex size-12 shrink-0 items-center justify-center rounded-lg
              text-[var(--accent-ink)] transition-colors duration-[var(--dur-1)]
              active:bg-[var(--surface-1)]"
          >
            <CheckIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
