import { t } from '@/i18n/fr';
import { muscleLabel, muscleSetsReading } from '@/i18n/labels';
import { barFractions } from '@/lib/analytics/plot';
import type { MuscleBalance, MuscleCount } from '@/lib/analytics/muscles';
import { Card } from '@/ui';
import { CardHeadline } from './CardHeadline';

/**
 * The distribution — a ranked horizontal bar per muscle, and the third form of
 * this app's charts. Cf. `docs/superpowers/specs/2026-07-28-analytics-muscle-group-series-design.md`.
 *
 * **The drawing is the list**, and that is what makes this milestone different
 * from the two before it. A point on a curve and a column of a histogram cannot
 * carry their own label — hence, in G1 and G2, a mute `<svg>`, a cursor to
 * interrogate it, and a twin list underneath to make it accessible. A ranked row
 * carries its name and its number in text, on its own line. So there is no
 * `ChartSurface` here, no `<svg>`, no selection and no duplicate list: there is
 * nothing inaccessible to duplicate.
 *
 * **Nothing is coloured**, and that is a finding rather than an omission. The
 * charte reserves the accent for primary actions, validated sets and records;
 * this screen has none of the three. Colouring the most-trained muscle would
 * congratulate an imbalance — the exact opposite of what the screen is for — and
 * colouring the least-trained one would be an alarm the app has no threshold to
 * justify.
 */

/** What a week's worth of sets is rounded to in the header. */
const decimal = (value: number): string => (Math.round(value * 10) / 10).toLocaleString('fr-FR');

interface Props {
  balance: MuscleBalance;
  /** Weeks in the window, so two periods can be compared with each other. */
  weeks: number;
  /** Held at reduced opacity while a new period loads — never a skeleton. */
  stale?: boolean;
}

export function MuscleBalanceCard({ balance, weeks, stale }: Props) {
  const { ranked, total } = balance;
  const counts = ranked.map((entry) => entry.sets);
  // The largest count, and nothing else: there is no goal per muscle to fold in.
  const ceiling = Math.max(...counts, 0);
  const fractions = barFractions(counts, ceiling);

  return (
    <Card padded>
      <div className={`transition-opacity duration-[var(--dur-1)] ${stale ? 'opacity-50' : ''}`}>
        <CardHeadline label={t('muscles.totalLabel')} value={String(total)} />

        {weeks > 0 && (
          <p className="mt-1 text-right text-sm text-[var(--text-2)]">
            {t('muscles.weeklyRate', { rate: decimal(total / weeks) })}
          </p>
        )}

        <ul className="mt-5">
          {ranked.map((entry, index) => (
            <MuscleRow key={entry.muscle} entry={entry} fraction={fractions[index]!} />
          ))}
        </ul>

        {/* What is measured, not how to read the drawing — the same nature as
            `metricHint` under a curve. The primary muscle alone is an
            approximation, and an approximation gets written down. */}
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text-2)]">
          {t('muscles.footnote')}
        </p>
      </div>
    </Card>
  );
}

/**
 * One muscle: its name, its bar, its count. Not a button — an affordance that
 * leads nowhere is a tactile lie, and there is nothing here a tap could reveal
 * that the row does not already say.
 */
function MuscleRow({ entry, fraction }: { entry: MuscleCount; fraction: number }) {
  return (
    <li className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2">
      <span className="text-sm text-[var(--text-1)]">
        {entry.muscle === undefined ? t('muscles.unknownMuscle') : muscleLabel(entry.muscle)}
      </span>

      <MuscleBar fraction={fraction} />

      <span className="metric w-9 text-right text-base font-semibold text-[var(--text-1)]">
        <span aria-hidden="true">{entry.sets}</span>
        <span className="sr-only">{muscleSetsReading(entry.sets)}</span>
      </span>
    </li>
  );
}

/**
 * The bar. No track behind it: every row starts at the same left edge, so the
 * lengths compare without a rule being drawn — and fifteen full-width grey lines
 * would be exactly the grid the charte forbids.
 *
 * A muscle at **zero** gets four pixels in the tone of the axis. Milestone G2
 * paid for that rule in use: a week that drew nothing at all read as irregular
 * spacing rather than as a column at zero. It is not a quantity — it is the
 * origin thickening where a row exists and is worth nothing. The symmetrical
 * case is handled one layer down, in `barFractions`: a small non-zero value
 * keeps a floor, so one set never looks like none.
 */
function MuscleBar({ fraction }: { fraction: number }) {
  if (fraction <= 0) {
    return <span aria-hidden="true" className="block h-1.5 w-1 rounded-full bg-[var(--border)]" />;
  }

  return (
    <span aria-hidden="true" className="block">
      <span
        className="block h-1.5 rounded-full bg-[var(--text-2)]"
        style={{ width: `${fraction * 100}%` }}
      />
    </span>
  );
}
