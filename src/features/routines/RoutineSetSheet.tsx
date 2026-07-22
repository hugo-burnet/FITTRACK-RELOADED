import { useState } from 'react';
import type { RoutineSetTargets } from '@/data/repositories/routines';
import type { RoutineSet, SetType } from '@/data/types';
import { t } from '@/i18n/fr';
import { setTypeLabel } from '@/i18n/labels';
import { Button, NumberInput, Sheet } from '@/ui';

/**
 * Lot 4 plans two kinds of set. Dropsets and sets to failure belong to Lot 6,
 * where RF-20 gives them behaviour; a plan cannot really prescribe a dropset
 * anyway — that is a decision taken with the bar in your hands.
 */
const PLANNABLE_TYPES: SetType[] = ['normal', 'warmup'];

type Props = {
  open: boolean;
  onClose: () => void;
  set: RoutineSet | null;
  /** 1-based, as shown in the card. */
  number: number;
  onSave: (changes: RoutineSetTargets) => void;
  onApplyToAll: (changes: RoutineSetTargets) => void;
  onDelete: () => void;
};

/**
 * Editing one planned set.
 *
 * A sheet rather than inline fields: three values across five sets across six
 * exercises, on a 375 px screen, is a swamp of 24 px targets. The whole row
 * opens this instead, and the Lot 1 steppers get the room to be 48 px.
 *
 * The draft is local and written straight through on each change — the same
 * shape as the exercise notes of Lot 3. Without it `useLiveQuery` would echo
 * every write back into the field and move the caret.
 */
export function RoutineSetSheet({
  open,
  onClose,
  set,
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
    });
  }

  const write = (changes: RoutineSetTargets) => {
    setDraft({ ...draft, ...changes });
    onSave(changes);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('routine.setSheetTitle', { number })}>
      <div className="flex flex-col gap-6 pb-2">
        <div>
          <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
            {t('routine.setTypeLabel')}
          </p>
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
        </div>

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

        <div>
          <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
            {t('routine.targetWeightLabel')}
          </p>
          <NumberInput
            value={draft.targetWeight}
            onChange={(targetWeight) => write({ targetWeight })}
            step={2.5}
            suffix={t('units.kg')}
            aria-label={t('routine.targetWeightLabel')}
          />
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
            {t('routine.targetWeightHint')}
          </p>
        </div>

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
