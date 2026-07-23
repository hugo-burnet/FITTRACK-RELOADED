import { useState } from 'react';
import type { RoutineSetTargets } from '@/data/repositories/routines';
import type { MeasurementType, RoutineSet, SetType } from '@/data/types';
import { t } from '@/i18n/fr';
import { setTypeLabel } from '@/i18n/labels';
import { measurementShape } from '@/lib/measurement';
import type { WeightRole } from '@/lib/measurement';
import { Button, NumberInput, Sheet } from '@/ui';

/**
 * Lot 4 plans two kinds of set. Dropsets and sets to failure belong to Lot 6,
 * where RF-20 gives them behaviour; a plan cannot really prescribe a dropset
 * anyway — that is a decision taken with the bar in your hands.
 */
const PLANNABLE_TYPES: SetType[] = ['normal', 'warmup'];

/** One field's worth of wording, chosen by what the kilos mean here. */
const WEIGHT_WORDS: Record<WeightRole, { label: string; hint: string }> = {
  load: { label: t('routine.targetWeightLabel'), hint: t('routine.targetWeightHint') },
  added: { label: t('routine.targetWeightAddedLabel'), hint: t('routine.targetWeightAddedHint') },
  assist: {
    label: t('routine.targetWeightAssistLabel'),
    hint: t('routine.targetWeightAssistHint'),
  },
};

type Props = {
  open: boolean;
  onClose: () => void;
  set: RoutineSet | null;
  /** Decides which fields exist at all. */
  measurementType: MeasurementType;
  /** 1-based, as shown in the card. */
  number: number;
  onSave: (changes: RoutineSetTargets) => void;
  onApplyToAll: (changes: RoutineSetTargets) => void;
  onDelete: () => void;
};

/** Engraved caption above a stepper, the shape every field on this sheet takes. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">{label}</p>
      {children}
      {hint !== undefined && (
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">{hint}</p>
      )}
    </div>
  );
}

/**
 * Editing one planned set — with the fields **this** exercise is measured in.
 *
 * Until real use it showed reps, rep range and load to everything, so a plank
 * asked for repetitions and had nowhere to put 45 seconds. The shape now comes
 * from the exercise's `measurementType`, which had been carried on every row
 * since Lot 2 and read by nothing.
 *
 * A sheet rather than inline fields: three values across five sets across six
 * exercises, on a 375px screen, is a swamp of 24px targets. The whole row opens
 * this instead, and the Lot 1 steppers get the room to be 48px.
 *
 * The draft is local and written straight through on each change — the same
 * shape as the exercise notes of Lot 3. Without it `useLiveQuery` would echo
 * every write back into the field and move the caret.
 */
export function RoutineSetSheet({
  open,
  onClose,
  set,
  measurementType,
  number,
  onSave,
  onApplyToAll,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<RoutineSetTargets>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = open && set !== null ? set.id : null;
  if (loadedFor !== key) {
    setLoadedFor(key);
    setDraft({
      setType: set?.setType ?? 'normal',
      targetReps: set?.targetReps,
      targetRepsMax: set?.targetRepsMax,
      targetWeight: set?.targetWeight,
      targetDurationSeconds: set?.targetDurationSeconds,
      targetDistanceMeters: set?.targetDistanceMeters,
    });
  }

  const write = (changes: RoutineSetTargets) => {
    setDraft({ ...draft, ...changes });
    onSave(changes);
  };

  const shape = measurementShape(measurementType);
  const weightWords = shape.weightRole === undefined ? undefined : WEIGHT_WORDS[shape.weightRole];

  return (
    <Sheet open={open} onClose={onClose} title={t('routine.setSheetTitle', { number })}>
      <div className="flex flex-col gap-6 pb-2">
        <Field label={t('routine.setTypeLabel')}>
          <div
            role="radiogroup"
            aria-label={t('routine.setTypeLabel')}
            className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1"
          >
            {PLANNABLE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={draft.setType === type}
                onClick={() => write({ setType: type })}
                className={`min-h-12 flex-1 rounded-lg text-base font-semibold
                  transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                  ${
                    draft.setType === type
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : 'text-[var(--text-2)]'
                  }`}
              >
                {setTypeLabel(type)}
              </button>
            ))}
          </div>
        </Field>

        {shape.fields.includes('reps') && (
          <div>
            <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
              {t('routine.targetRepsLabel')}
            </p>
            <NumberInput
              value={draft.targetReps}
              onChange={(targetReps) => write({ targetReps })}
              step={1}
              max={999}
              aria-label={t('routine.targetRepsLabel')}
            />
            <p className="label-xs mt-4 mb-2 font-semibold text-[var(--text-2)]">
              {t('routine.targetRepsMaxLabel')}
            </p>
            <NumberInput
              value={draft.targetRepsMax}
              onChange={(targetRepsMax) => write({ targetRepsMax })}
              step={1}
              max={999}
              aria-label={t('routine.targetRepsMaxLabel')}
            />
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
              {t('routine.targetRepsHint')}
            </p>
          </div>
        )}

        {/* Distance before duration, because that is the order the set row reads
            them in ("500 m · 2:00") — a form that asks in one order and displays
            in another makes you check twice that you filled the right box. */}
        {shape.fields.includes('distance') && (
          <Field label={t('routine.targetDistanceLabel')} hint={t('routine.targetDistanceHint')}>
            <NumberInput
              value={draft.targetDistanceMeters}
              onChange={(targetDistanceMeters) => write({ targetDistanceMeters })}
              step={100}
              max={100000}
              suffix={t('units.meters')}
              aria-label={t('routine.targetDistanceLabel')}
            />
          </Field>
        )}

        {shape.fields.includes('duration') && (
          <Field label={t('routine.targetDurationLabel')} hint={t('routine.targetDurationHint')}>
            <NumberInput
              value={draft.targetDurationSeconds}
              onChange={(targetDurationSeconds) => write({ targetDurationSeconds })}
              integer
              step={15}
              max={7200}
              suffix={t('units.seconds')}
              // Seconds, whole ones: the same "1,3" that meant 1:30 must not land
              // here as 1.3 s any more than it does in the live grid.
              integer
              aria-label={t('routine.targetDurationLabel')}
            />
          </Field>
        )}

        {weightWords !== undefined && (
          <Field label={weightWords.label} hint={weightWords.hint}>
            <NumberInput
              value={draft.targetWeight}
              onChange={(targetWeight) => write({ targetWeight })}
              step={2.5}
              suffix={t('units.kg')}
              aria-label={weightWords.label}
            />
          </Field>
        )}

        {/* Raising a whole exercise from 80 to 85 kg is a routine's most frequent
            edit, and doing it set by set is how you forget one. */}
        <Button
          fullWidth
          size="lg"
          onClick={() => {
            onApplyToAll(draft);
            onClose();
          }}
        >
          {t('routine.applyToAll')}
        </Button>

        <Button
          variant="danger"
          fullWidth
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          {t('routine.deleteSet')}
        </Button>
      </div>
    </Sheet>
  );
}
