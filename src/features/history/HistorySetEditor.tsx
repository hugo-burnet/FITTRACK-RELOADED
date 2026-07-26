import { useState } from 'react';
import { SET_TYPES, type MeasurementType } from '@/data/types';
import { t } from '@/i18n/fr';
import { setTypeLabel } from '@/i18n/labels';
import { entryColumns, type TargetField } from '@/lib/measurement';
import { NumberInput, OptionSheet, type ItemState } from '@/ui';
import { ChevronDownIcon, CloseIcon, GripIcon } from '@/ui/icons';
import {
  normalizeHistoryRpe,
  type HistorySetDraft,
} from './historyDraft';

type Props = {
  set: HistorySetDraft;
  number: number;
  measurementType?: MeasurementType;
  state: ItemState;
  onChange: (set: HistorySetDraft) => void;
  onRemove: () => void;
};

const setTypeOptions = SET_TYPES.map((value) => ({
  value,
  label: setTypeLabel(value),
}));

const FIELD_WORDS: Record<TargetField, { label: string; suffix: string; step: number }> = {
  weight: { label: t('history.editWeight'), suffix: t('units.kg'), step: 2.5 },
  reps: { label: t('history.editReps'), suffix: t('units.reps'), step: 1 },
  distance: { label: t('history.editDistance'), suffix: t('units.meters'), step: 1 },
  duration: { label: t('history.editSetDuration'), suffix: t('units.seconds'), step: 1 },
};

function fieldsFor(
  set: HistorySetDraft,
  measurementType: MeasurementType | undefined,
): TargetField[] {
  if (measurementType !== undefined) {
    return entryColumns(measurementType).map(({ field }) => field);
  }

  return [
    ...(set.weight === undefined ? [] : ['weight' as const]),
    ...(set.distanceMeters === undefined ? [] : ['distance' as const]),
    ...(set.reps === undefined ? [] : ['reps' as const]),
    ...(set.durationSeconds === undefined ? [] : ['duration' as const]),
  ];
}

function valueOf(set: HistorySetDraft, field: TargetField): number | undefined {
  if (field === 'weight') return set.weight;
  if (field === 'reps') return set.reps;
  if (field === 'distance') return set.distanceMeters;
  return set.durationSeconds;
}

function withValue(
  set: HistorySetDraft,
  field: TargetField,
  value: number | undefined,
): HistorySetDraft {
  if (field === 'weight') return { ...set, weight: value };
  if (field === 'reps') return { ...set, reps: value };
  if (field === 'distance') return { ...set, distanceMeters: value };
  return { ...set, durationSeconds: value };
}

export function HistorySetEditor({
  set,
  number,
  measurementType,
  state,
  onChange,
  onRemove,
}: Props) {
  const [typeOpen, setTypeOpen] = useState(false);
  const fields = fieldsFor(set, measurementType);

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors
        duration-[var(--dur-1)] ${
          state.dragging
            ? 'border-[var(--accent-ink)] bg-[var(--surface-2)]'
            : 'border-[var(--border)] bg-[var(--surface-1)]'
        }`}
    >
      <div className="flex min-h-12 items-stretch">
        <button
          type="button"
          aria-label={t('history.editDragSet', { number })}
          className="flex w-12 shrink-0 cursor-grab items-center justify-center
            text-[var(--text-2)] active:cursor-grabbing"
          {...state.handleProps}
        >
          <GripIcon />
        </button>

        <span className="tabular flex w-8 shrink-0 items-center text-sm text-[var(--text-2)]">
          {number}
        </span>

        <button
          type="button"
          onClick={() => setTypeOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm
            font-semibold text-[var(--text-1)]"
        >
          <span className="truncate">{setTypeLabel(set.setType)}</span>
          <ChevronDownIcon className="shrink-0 text-[var(--text-2)]" />
        </button>

        <button
          type="button"
          aria-label={t('history.editRemoveSet')}
          onClick={onRemove}
          className="flex w-12 shrink-0 items-center justify-center text-[var(--danger-ink)]
            active:bg-[var(--surface-2)]"
        >
          <CloseIcon />
        </button>
      </div>

      {(fields.length > 0 || set.rpe !== undefined) && (
        <div className="grid gap-4 border-t border-[var(--border)] p-3">
          {fields.map((field) => {
            const words = FIELD_WORDS[field];
            return (
              <div key={field}>
                <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
                  {words.label}
                </p>
                <NumberInput
                  value={valueOf(set, field)}
                  onChange={(value) => onChange(withValue(set, field, value))}
                  step={words.step}
                  max={Number.MAX_SAFE_INTEGER}
                  suffix={words.suffix}
                  integer={field !== 'weight'}
                  focusTone="neutral"
                  aria-label={words.label}
                />
              </div>
            );
          })}

          <div>
            <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
              {t('history.editRpe')}
            </p>
            <NumberInput
              value={set.rpe}
              onChange={(rpe) =>
                onChange({ ...set, rpe: normalizeHistoryRpe(rpe) })
              }
              min={6}
              max={10}
              step={0.5}
              focusTone="neutral"
              aria-label={t('history.editRpe')}
            />
          </div>
        </div>
      )}

      <OptionSheet
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title={t('history.editSetType')}
        options={setTypeOptions}
        value={set.setType}
        onSelect={(setType) => onChange({ ...set, setType })}
      />
    </div>
  );
}
