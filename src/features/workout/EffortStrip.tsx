import { useEffect, useRef, useState } from 'react';
import { t, type TranslationKey } from '@/i18n/fr';
import { restBonusSecondsFor } from '@/lib/restBonus';
import { formatNumber } from '@/ui/numberField';

/** The four answers, and the RPE each one writes. RF-30's scale, quantised. */
const ANSWERS: readonly { labelKey: TranslationKey; rpe: number }[] = [
  { labelKey: 'workout.effortEasy', rpe: 7 },
  { labelKey: 'workout.effortOk', rpe: 8 },
  { labelKey: 'workout.effortHard', rpe: 9 },
  { labelKey: 'workout.effortMax', rpe: 10 },
];

/** As long as the strip waits for an answer. Long enough to rack the bar. */
const GRACE_MS = 20_000;

/** `--dur-2`, in a number: the collapse has to finish before the slot goes. */
const CLOSE_MS = 220;

/**
 * "How hard was that?", asked once, under the set it is asking about.
 *
 * **Four words, not nine numbers.** The RPE field in the set sheet already
 * offers the half-point scale for anyone who wants it. This is the version you
 * can answer with a thumb while still breathing hard, and its whole reason to
 * exist is that the precise one is too slow to use thirty times a session. Four
 * targets map onto the four answers that change what the app does — and nothing
 * finer than that changes anything.
 *
 * **Ignoring it is a valid answer.** It expires on its own, exactly like the
 * undo strip, and takes nothing with it: the set is already written, the rest is
 * already running. Nothing here is a gate.
 *
 * **It sits under its own set**, for the same reason `RecordNote` does: this
 * screen holds twenty near-identical rows, and a prompt at the foot of the
 * screen could never say which one it means.
 */
export function EffortStrip({
  onAnswer,
  onExpire,
}: {
  onAnswer: (rpe: number) => void;
  onExpire: () => void;
}) {
  const [closing, setClosing] = useState(false);

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
        <div className="flex items-center gap-1.5 bg-[var(--surface-2)] px-2 py-1.5">
          <span className="label-xs w-12 shrink-0 text-center font-semibold text-[var(--text-2)]">
            {t('workout.effortQuestion')}
          </span>
          {ANSWERS.map(({ labelKey, rpe }) => {
            const bonus = restBonusSecondsFor(rpe);
            return (
              <button
                key={rpe}
                type="button"
                aria-label={t('workout.effortOption', {
                  label: t(labelKey),
                  value: formatNumber(rpe),
                })}
                onClick={() => {
                  setClosing(true);
                  onAnswer(rpe);
                }}
                className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-lg
                  bg-[var(--surface-1)] px-1 text-sm font-semibold text-[var(--text-1)]
                  transition-colors duration-[var(--dur-1)] active:bg-[var(--accent-soft)]"
              >
                <span className="truncate">{t(labelKey)}</span>
                {bonus > 0 && (
                  <span className="label-xs font-semibold text-[var(--accent-ink)]">
                    {t('workout.effortBonus', { seconds: bonus })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
