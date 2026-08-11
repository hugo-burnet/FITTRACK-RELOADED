import type { CoachSignal } from '@/lib/coach';
import { t } from '@/i18n/fr';
import { formatNumber } from '@/ui/numberField';
import { coachSignalMessage } from './coachCopy';

type SignalLike = Pick<CoachSignal, 'code' | 'nextLoadKg' | 'evidence'> & {
  id?: string;
};

type Props = {
  signal: SignalLike;
  /** Optional dismiss for live pending recommendations. */
  onDismiss?: () => void;
  /** Visual register: objective (next session) vs observation (finish / live). */
  tone?: 'objective' | 'signal';
  /**
   * Exercise title when the card sits outside its exercise card
   * (finish screen, multi-signal list).
   */
  exerciseName?: string;
  /**
   * `strip` — continues a workout exercise card (full-bleed, no second frame).
   * `row` — one reading in a Card stack (finish, history).
   */
  variant?: 'strip' | 'row';
  /** Optional status line for the journal (pending / followed / dismissed). */
  statusLabel?: string;
  /** Optional date line for the journal. */
  dateLabel?: string;
};

/**
 * Coach readout — gym instrument, not a toast and not a record.
 *
 * **Signature:** when there is a next load, the kilos are the figure
 * (`record-figure` / metric), same visual family as a PR readout, but in
 * `--text-1` only. Accent is reserved for validated sets and records.
 *
 * **Why always visible:** the plan's transparency rule — never a bare "+2,5 kg".
 * The prose is secondary; the number is what you load on the bar with one hand.
 */
export function CoachCard({
  signal,
  onDismiss,
  tone = 'signal',
  exerciseName,
  variant = 'row',
  statusLabel,
  dateLabel,
}: Props) {
  const hasLoad = signal.nextLoadKg !== undefined;
  const role =
    tone === 'objective' ? t('coach.objective') : t('coach.title');
  const reason = coachSignalMessage(signal);

  const shell =
    variant === 'strip'
      ? // Continues the exercise card: same band as notes / record strip, not a nested card.
        'w-full bg-[var(--surface-2)] px-4 py-3'
      : // One engraved reading in a Card — hairline only, no rounded island on island.
        'w-full border-b border-[var(--border)] px-4 py-4 last:border-b-0';

  return (
    <article
      className={shell}
      data-coach-code={signal.code}
      data-coach-tone={tone}
      aria-label={role}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* Meta row: role + optional journal chrome. Engraved, never a kicker parade. */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="label-xs font-semibold text-[var(--text-2)]">{role}</p>
            {dateLabel !== undefined && (
              <p className="text-sm text-[var(--text-2)]">{dateLabel}</p>
            )}
            {statusLabel !== undefined && (
              <p className="label-xs font-semibold text-[var(--text-2)]">{statusLabel}</p>
            )}
          </div>

          {exerciseName !== undefined && exerciseName !== '' && (
            <p className="mt-1.5 truncate text-base font-medium text-[var(--text-1)]">
              {exerciseName}
            </p>
          )}

          {/*
            The plate stamp: only when the rule proposes a load.
            Observations (drop, plateau, rest) lead with prose — a fake hero
            metric would invent precision the signal does not have.
          */}
          {hasLoad ? (
            <p className="record-figure mt-2 text-[1.75rem] leading-none font-semibold tracking-tight text-[var(--text-1)]">
              {formatNumber(signal.nextLoadKg!)}
              <span className="ml-1.5 text-base font-semibold tracking-normal text-[var(--text-2)]">
                {t('units.kg')}
              </span>
            </p>
          ) : null}

          <p
            className={`text-sm leading-snug text-pretty text-[var(--text-1)] ${
              hasLoad || exerciseName ? 'mt-2' : 'mt-1.5'
            }`}
          >
            {reason}
          </p>
        </div>

        {onDismiss !== undefined && (
          <button
            type="button"
            onClick={onDismiss}
            // 48×48 — one thumb, sweaty; never a tiny text link.
            className="label-xs flex h-12 min-w-12 shrink-0 items-center justify-center
              rounded-xl px-3 font-semibold text-[var(--text-2)]
              transition-colors duration-[var(--dur-1)]
              active:bg-[var(--surface-1)]"
          >
            {t('coach.dismiss')}
          </button>
        )}
      </div>
    </article>
  );
}
