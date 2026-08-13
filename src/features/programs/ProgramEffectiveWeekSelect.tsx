import { t } from '@/i18n/fr';

interface Props {
  weeks: readonly number[];
  value: number | null;
  onChange: (weekIndex: number) => void;
}

/**
 * The seam of an active block: everything before this week is history, from the
 * split to the week list. One selector governs both, so the two never disagree.
 */
export function ProgramEffectiveWeekSelect({ weeks, value, onChange }: Props) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label-xs font-semibold text-[var(--text-2)]">
        {t('program.effectiveWeekLabel')}
      </span>
      <select
        aria-label={t('program.effectiveWeekLabel')}
        value={value ?? ''}
        disabled={weeks.length === 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-12 rounded-lg bg-[var(--surface-2)] px-4 text-base
          text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]"
      >
        {weeks.map((weekIndex) => (
          <option key={weekIndex} value={weekIndex}>
            {t('program.week', { number: weekIndex + 1 })}
          </option>
        ))}
      </select>
      <span className="text-sm leading-relaxed text-[var(--text-2)]">
        {t('program.effectiveWeekHint')}
      </span>
    </label>
  );
}
