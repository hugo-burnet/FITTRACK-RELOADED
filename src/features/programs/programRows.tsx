import type { ReactNode } from 'react';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { ChevronRightIcon } from '@/ui/icons';

const SHORT_DAY_KEYS: TranslationKey[] = [
  'program.weekdayShort1',
  'program.weekdayShort2',
  'program.weekdayShort3',
  'program.weekdayShort4',
  'program.weekdayShort5',
  'program.weekdayShort6',
  'program.weekdayShort7',
];

/** La colonne du jour. En accent quand c'est aujourd'hui : l'oeil retrouve où l'on en est dans la semaine. */
export function DayColumn({ dayOfWeek, today = false }: { dayOfWeek: number; today?: boolean }) {
  return (
    <span
      className={`label-xs w-9 shrink-0 font-semibold ${
        today ? 'text-[var(--accent-ink)]' : 'text-[var(--text-2)]'
      }`}
    >
      {t(SHORT_DAY_KEYS[dayOfWeek - 1]!)}
    </span>
  );
}

export function RowText({
  title,
  subtitle,
  muted = false,
  selected = false,
}: {
  title: string;
  subtitle?: string;
  muted?: boolean;
  selected?: boolean;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span
        className={`block truncate text-base ${
          selected
            ? 'text-[var(--accent-ink)]'
            : muted
              ? 'text-[var(--text-2)]'
              : 'text-[var(--text-1)]'
        }`}
      >
        {title}
      </span>
      {subtitle !== undefined && (
        <span className="mt-0.5 block text-sm text-[var(--text-2)]">{subtitle}</span>
      )}
    </span>
  );
}

/** À droite d'une ligne : un état en un mot, puis la flèche quand la ligne mène quelque part. */
export function RowTrailing({
  children,
  chevron = false,
}: {
  children?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-[var(--text-2)]">
      {children !== undefined && <span className="text-sm">{children}</span>}
      {chevron && <ChevronRightIcon />}
    </span>
  );
}
