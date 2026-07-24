import { useState } from 'react';
import { t } from '@/i18n/fr';
import {
  calculateWarmupSets,
  DEFAULT_WARMUP_INCREMENT_KG,
  DEFAULT_WARMUP_STEPS,
} from '@/lib/warmup';
import type { WarmupSetSuggestion } from '@/lib/warmup';
import { Button, NumberInput, Sheet } from '@/ui';
import { CloseIcon, PlusIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';

interface DraftStep {
  id: string;
  percentage: number | undefined;
  reps: number | undefined;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialTargetWeightKg: number | undefined;
  minimumWeightKg: number;
  onInsert: (suggestions: readonly WarmupSetSuggestion[]) => Promise<void>;
}

const defaultSteps = (): DraftStep[] =>
  DEFAULT_WARMUP_STEPS.map((step) => ({
    id: crypto.randomUUID(),
    percentage: step.percentage,
    reps: step.reps,
  }));

function DraftIntegerInput({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  label: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      enterKeyHint="done"
      value={value ?? ''}
      aria-label={label}
      onChange={(event) => {
        if (!/^\d*$/.test(event.target.value)) return;
        onChange(event.target.value === '' ? undefined : Number(event.target.value));
      }}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      className="metric min-h-12 w-full rounded-lg bg-[var(--surface-2)] px-2 text-center
        text-base font-semibold text-[var(--text-1)] outline-none
        focus:ring-2 focus:ring-[var(--text-2)]"
    />
  );
}

export function WarmupSheet({
  open,
  onClose,
  initialTargetWeightKg,
  minimumWeightKg,
  onInsert,
}: Props) {
  const [targetWeightKg, setTargetWeightKg] = useState(initialTargetWeightKg);
  const [steps, setSteps] = useState(defaultSteps);
  const [wasOpen, setWasOpen] = useState(open);
  const [submitting, setSubmitting] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTargetWeightKg(initialTargetWeightKg);
      setSteps(defaultSteps());
      setWriteFailed(false);
    }
  }

  const targetValid =
    targetWeightKg !== undefined && Number.isFinite(targetWeightKg) && targetWeightKg > 0;
  const stepsValid =
    steps.length > 0 &&
    steps.every(
      (step) =>
        step.percentage !== undefined &&
        step.percentage > 0 &&
        step.percentage < 100 &&
        step.reps !== undefined &&
        Number.isInteger(step.reps) &&
        step.reps > 0,
    );

  const suggestionFor = (step: DraftStep): WarmupSetSuggestion | undefined => {
    const target = targetWeightKg;
    if (
      target === undefined ||
      !Number.isFinite(target) ||
      target <= 0 ||
      step.percentage === undefined ||
      step.percentage <= 0 ||
      step.percentage >= 100 ||
      step.reps === undefined ||
      !Number.isInteger(step.reps) ||
      step.reps <= 0
    ) {
      return undefined;
    }

    return calculateWarmupSets({
      targetWeightKg: target,
      incrementKg: DEFAULT_WARMUP_INCREMENT_KG,
      minimumWeightKg,
      steps: [{ percentage: step.percentage, reps: step.reps }],
    })[0];
  };

  const previews = steps.map(suggestionFor);
  const suggestions = previews.filter(
    (suggestion): suggestion is WarmupSetSuggestion => suggestion !== undefined,
  );

  const validationMessage = !targetValid
    ? t('workout.warmupInvalidTarget')
    : !stepsValid
      ? t('workout.warmupInvalidSteps')
      : suggestions.length === 0
        ? t('workout.warmupNoSuggestion')
        : null;

  const insert = async () => {
    if (validationMessage !== null || submitting) return;
    setSubmitting(true);
    setWriteFailed(false);
    try {
      await onInsert(suggestions);
      onClose();
    } catch {
      setWriteFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('workout.warmupTitle')}>
      <div className="flex flex-col gap-5 pb-2">
        <label className="flex flex-col gap-2">
          <span className="label-xs font-semibold text-[var(--text-2)]">
            {t('workout.warmupTarget')}
          </span>
          <NumberInput
            value={targetWeightKg}
            onChange={setTargetWeightKg}
            min={0}
            step={DEFAULT_WARMUP_INCREMENT_KG}
            suffix={t('units.kg')}
            focusTone="neutral"
            aria-label={t('workout.warmupTarget')}
          />
        </label>

        <div className="flex flex-col gap-3">
          <div
            aria-hidden="true"
            className="grid grid-cols-[4.25rem_3.5rem_minmax(0,1fr)_3rem] gap-2"
          >
            <span className="label-xs text-center text-[var(--text-2)]">
              {t('workout.warmupStepPercentageShort')}
            </span>
            <span className="label-xs text-center text-[var(--text-2)]">
              {t('workout.warmupStepRepsShort')}
            </span>
            <span className="label-xs text-center text-[var(--text-2)]">
              {t('workout.warmupStepWeightShort')}
            </span>
          </div>

          {steps.map((step, index) => {
            const suggestion = previews[index];
            return (
              <div
                key={step.id}
                className="grid grid-cols-[4.25rem_3.5rem_minmax(0,1fr)_3rem]
                  items-end gap-2"
              >
                <DraftIntegerInput
                  value={step.percentage}
                  onChange={(percentage) =>
                    setSteps((current) =>
                      current.map((item) =>
                        item.id === step.id ? { ...item, percentage } : item,
                      ),
                    )
                  }
                  label={t('workout.warmupStepPercentage')}
                />
                <DraftIntegerInput
                  value={step.reps}
                  onChange={(reps) =>
                    setSteps((current) =>
                      current.map((item) => (item.id === step.id ? { ...item, reps } : item)),
                    )
                  }
                  label={t('workout.warmupStepReps')}
                />
                <p
                  aria-label={t('workout.warmupStepWeight')}
                  className="metric flex min-h-12 items-center justify-center rounded-lg
                    bg-[var(--surface-2)] text-sm text-[var(--text-1)]"
                >
                  {suggestion === undefined
                    ? t('workout.warmupPreviewEmpty')
                    : formatNumber(suggestion.weightKg)}
                </p>
                <button
                  type="button"
                  aria-label={t('workout.warmupRemoveStep')}
                  onClick={() =>
                    setSteps((current) => current.filter((item) => item.id !== step.id))
                  }
                  className="flex size-12 items-center justify-center rounded-lg
                    text-[var(--text-2)] active:bg-[var(--surface-2)]
                    focus-visible:[outline-color:var(--text-2)]"
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            setSteps((current) => [
              ...current,
              { id: crypto.randomUUID(), percentage: undefined, reps: undefined },
            ])
          }
          className="flex min-h-12 w-full items-center gap-2 rounded-xl px-4 text-left
            text-base font-semibold text-[var(--text-2)] active:bg-[var(--surface-2)]
            focus-visible:[outline-color:var(--text-2)]"
        >
          <PlusIcon width="18" height="18" />
          {t('workout.warmupAddStep')}
        </button>

        {validationMessage !== null && (
          <p className="text-sm text-[var(--text-2)]">{validationMessage}</p>
        )}
        {writeFailed && (
          <p role="alert" className="text-sm text-[var(--danger-ink)]">
            {t('workout.warmupInsertError')}
          </p>
        )}

        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={validationMessage !== null || submitting}
          onClick={() => void insert()}
        >
          {t('workout.warmupInsert')}
        </Button>
      </div>
    </Sheet>
  );
}
