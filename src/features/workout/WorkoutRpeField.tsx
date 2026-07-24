import { useId, useState } from 'react';
import { t } from '@/i18n/fr';
import { ChevronDownIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

type Props = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
};

/**
 * RF-30 — RPE stays one deliberate layer below the live grid.
 *
 * The entry is always discoverable in the set sheet, but the scale only takes
 * space after an explicit tap. Its disclosure state belongs to this mounted
 * sheet; the value itself belongs to the set and is written through by the
 * parent.
 */
export function WorkoutRpeField({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const labelId = useId();
  const valueId = useId();

  return (
    <div className="-mx-5 border-b border-[var(--border)]">
      <button
        type="button"
        aria-labelledby={labelId}
        aria-describedby={valueId}
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]
          focus-visible:[outline-color:var(--text-2)]"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={labelId} className="text-base font-semibold text-[var(--text-1)]">
            {t('workout.rpeLabel')}
          </span>
          <span id={valueId} className="metric text-sm text-[var(--text-2)]">
            {value === undefined
              ? t('workout.rpeEmpty')
              : t('workout.rpeValue', { value: formatNumber(value) })}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={`shrink-0 text-[var(--text-2)] transition-transform
            duration-[var(--dur-1)] ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="grid grid-cols-5 gap-2 px-5 pb-4">
          {RPE_VALUES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              aria-label={t('workout.rpeOption', { value: formatNumber(option) })}
              onClick={() => onChange(option)}
              className={`metric min-h-12 rounded-xl border text-sm
                transition-[box-shadow,border-color,background-color,color]
                duration-[var(--dur-1)] focus-visible:[outline-color:var(--text-2)]
                ${
                  value === option
                    ? `border-[var(--text-2)] bg-[var(--text-2)] font-bold
                      text-[var(--surface-0)] ring-1 ring-inset ring-[var(--text-2)]`
                    : `border-[var(--border)] bg-[var(--surface-2)] font-medium
                      text-[var(--text-2)]`
                }`}
            >
              {formatNumber(option)}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={value === undefined}
            aria-label={t('workout.rpeClear')}
            onClick={() => onChange(undefined)}
            className={`metric min-h-12 rounded-xl border text-sm
              transition-[box-shadow,border-color,background-color,color]
              duration-[var(--dur-1)] focus-visible:[outline-color:var(--text-2)]
              ${
                value === undefined
                  ? `border-[var(--text-2)] bg-[var(--text-2)] font-bold
                    text-[var(--surface-0)] ring-1 ring-inset ring-[var(--text-2)]`
                  : `border-[var(--border)] bg-[var(--surface-2)] font-medium
                    text-[var(--text-2)]`
              }`}
          >
            —
          </button>
        </div>
      )}
    </div>
  );
}
