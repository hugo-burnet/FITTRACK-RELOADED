import { useEffect, useRef, useState } from 'react';
import { t, type TranslationKey } from '@/i18n/fr';
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
 *
 * **It is built like the two other things that hang off a set row**, and that
 * is the whole of its styling: a band on the validated surface, a muted label on
 * the left, accent words on the right, no boxes. `UndoRow` and `RecordNote`
 * already established that grammar; the first version of this strip invented
 * boxed chips instead and was the only place in the app wearing them, which is
 * exactly why it read as bolted on rather than built in.
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
        <div className="flex min-h-14 items-stretch gap-1 bg-[var(--surface-2)] px-3">
          {/* An opening, not a label. "Effort ?" was a question mark hung over
              four words that already are the answer — two grammars competing in
              48 px. « C’était » makes the four the end of one sentence, which
              is also how anyone would say it out loud. */}
          <span className="flex shrink-0 items-center pr-1 text-sm text-[var(--text-2)]">
            {t('workout.effortLead')}
          </span>
          {ANSWERS.map(({ labelKey, rpe }) => (
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
              // No background of its own: the press is the feedback, the same
              // one `UndoRow` uses. A resting chip would claim a weight these
              // four answers do not have.
              className="min-h-12 flex-1 text-sm font-semibold text-[var(--accent-ink)]
                transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-1)]"
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
