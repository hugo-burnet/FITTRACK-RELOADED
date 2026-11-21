import { useState } from 'react';
import { t } from '@/i18n/fr';
import {
  MAX_REP_SECONDS,
  MIN_REP_SECONDS,
  REP_SECONDS_PRESETS,
  clampRepSeconds,
  stepRepSeconds,
} from '@/lib/tempo';
import { Button, Sheet } from '@/ui';
import { formatNumber } from '@/ui/numberField';

export type PaceSheetView = {
  /** Ce que la feuille pilote : un tempo à battre, ou une montre à lancer. */
  kind: 'reps' | 'hold';
  rowId: string;
  name: string;
  /** The tempo in force for this exercise, preference included. */
  repSeconds: number;
  /** The preference behind it, so the sheet can say when the two differ. */
  defaultRepSeconds: number;
  /** Reps of the set the cadence would beat; `null` while its cell is empty. */
  reps: number | null;
  /** False once every set of the exercise is done — nothing left to beat. */
  canStart: boolean;
  running: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  view: PaceSheetView | null;
  /** Writes the exercise's own tempo. Called on every step, like every field. */
  onChange: (repSeconds: number) => void;
  /** Makes this tempo the one every exercise without a choice of its own takes. */
  onSetDefault: (repSeconds: number) => void;
  onStart: () => void;
  onStop: () => void;
};

/**
 * The cadence of one exercise: the seconds a repetition is given, and the
 * button that starts beating them.
 *
 * **The tempo is set here and nowhere else.** It used to be computed — three
 * seconds, plus a quarter per set already done, plus a half on the last one.
 * The number now belongs to whoever is under the bar; this sheet is the whole
 * of its interface, reached from the stopwatch on the card's header, which is
 * also the button that stops a running cadence.
 *
 * A ± pair on a quarter-second grid and five presets, exactly like `RestPicker`
 * and for the same reason: there is no text field to type "2,5" into wrong.
 */
export function PaceSheet({ open, onClose, view, onChange, onSetDefault, onStart, onStop }: Props) {
  // Adjusted during render rather than in an effect, like every other draft of
  // the app: the sheet opens on the value already in force.
  const [draft, setDraft] = useState<{ rowId: string; repSeconds: number } | null>(null);
  if (view !== null && draft?.rowId !== view.rowId) {
    setDraft({ rowId: view.rowId, repSeconds: view.repSeconds });
  }

  const repSeconds = draft?.repSeconds ?? view?.repSeconds ?? 0;

  const write = (next: number) => {
    const value = clampRepSeconds(next);
    if (view !== null) setDraft({ rowId: view.rowId, repSeconds: value });
    onChange(value);
  };

  const stepper =
    'min-h-14 w-14 shrink-0 rounded-lg bg-[var(--surface-2)] text-2xl text-[var(--text-1)] ' +
    'transition-transform duration-[var(--dur-1)] ease-[var(--ease-mech)] active:scale-[0.94] ' +
    'disabled:opacity-40';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(view?.kind === 'hold' ? 'workout.holdTitle' : 'workout.paceTitle')}
    >
      {view !== null && (
        <div className="flex flex-col gap-4">
          {/* Un maintien n'a pas de secondes par répétition. Montrer le réglage
              quand même, désactivé ou sans effet, serait pire que de ne rien
              montrer : il promettrait une prise sur le chrono qui n'existe pas. */}
          {view.kind === 'reps' && (
            <div role="group" aria-label={t('workout.paceTempoLabel')}>
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  aria-label={t('workout.paceDecrease')}
                  disabled={repSeconds <= MIN_REP_SECONDS}
                  onClick={() => write(stepRepSeconds(repSeconds, -1))}
                  className={stepper}
                >
                  −
                </button>

                <div
                  className="flex min-h-14 flex-1 items-center justify-center rounded-lg
                  bg-[var(--surface-2)]"
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className="metric text-3xl font-semibold text-[var(--text-1)]">
                      {formatNumber(repSeconds)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[0.6875rem] font-semibold tracking-[0.08em]
                      text-[var(--text-2)]"
                    >
                      {t('workout.paceUnit')}
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  aria-label={t('workout.paceIncrease')}
                  disabled={repSeconds >= MAX_REP_SECONDS}
                  onClick={() => write(stepRepSeconds(repSeconds, 1))}
                  className={stepper}
                >
                  +
                </button>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2">
                {REP_SECONDS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={repSeconds === preset}
                    onClick={() => write(preset)}
                    className={`metric min-h-12 w-full rounded-xl px-1 text-base font-semibold
                    transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)] ${
                      repSeconds === preset
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-1)]'
                    }`}
                  >
                    {formatNumber(preset)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* What the number costs, in the only unit that is felt: the set. A
              tempo is abstract until it is "8 reps ≈ 24 s". Pour un maintien,
              la seule chose à dire est ce que la coche va écrire. */}
          <p className="text-sm leading-relaxed text-[var(--text-2)]">
            {view.kind === 'hold'
              ? t(view.canStart ? 'workout.holdHelp' : 'workout.holdNoSet')
              : !view.canStart
                ? t('workout.paceNoSet')
                : view.reps === null
                  ? t('workout.paceMissingReps')
                  : t('workout.paceSetReading', {
                      reps: view.reps,
                      seconds: Math.round(view.reps * repSeconds),
                    })}
          </p>

          <Button
            variant={view.running ? 'secondary' : 'primary'}
            size="lg"
            fullWidth
            disabled={!view.running && !view.canStart}
            onClick={() => {
              onClose();
              if (view.running) onStop();
              else onStart();
            }}
          >
            {view.kind === 'hold'
              ? t(view.running ? 'workout.holdStop' : 'workout.holdStart')
              : t(view.running ? 'workout.paceStop' : 'workout.pace')}
          </Button>

          {/* The preference belongs with its explanation, one quiet level below
              the primary action. It spans the same axis as the controls above
              instead of looking like a sixth preset dropped on the left. */}
          {view.kind === 'reps' && (
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                aria-pressed={view.defaultRepSeconds === repSeconds}
                onClick={() => onSetDefault(repSeconds)}
                className={`min-h-12 w-full rounded-xl px-4 text-base font-semibold
                transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)] ${
                  view.defaultRepSeconds === repSeconds
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-1)]'
                }`}
              >
                {t('workout.paceSetDefault')}
              </button>
              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {t('workout.paceHelp')}
              </p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
