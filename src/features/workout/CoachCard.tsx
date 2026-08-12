import type { CoachSignal } from '@/lib/coach';
import { t } from '@/i18n/fr';
import { ChevronRightIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';
import { coachSignalMessage } from './coachCopy';

type SignalLike = Pick<CoachSignal, 'code' | 'nextLoadKg' | 'evidence'> & {
  id?: string;
};

type Props = {
  signal: SignalLike;
  /** Optional dismiss for live pending recommendations. */
  onDismiss?: () => void;
  /**
   * Optional apply for a live objective that carries a load. Tapping the card
   * body writes it onto the sets left to do — the plan's "never pre-fill" rule
   * is about the app deciding alone, not about the user asking for it.
   */
  onApply?: () => void;
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
  onApply,
  tone = 'signal',
  exerciseName,
  variant = 'row',
  statusLabel,
  dateLabel,
}: Props) {
  const hasLoad = signal.nextLoadKg !== undefined;
  // Nothing to apply without a load: an observation (plateau, long rest) has no
  // figure to write into the grid.
  const applicable = hasLoad && onApply !== undefined;
  const role =
    tone === 'objective' ? t('coach.objective') : t('coach.title');
  const reason = coachSignalMessage(signal);

  const shell =
    variant === 'strip'
      ? // Continues the exercise card: same band as notes / record strip, not a nested card.
        'w-full bg-[var(--surface-2)] px-4 py-3'
      : // One engraved reading in a Card — hairline only, no rounded island on island.
        'w-full border-b border-[var(--border)] px-4 py-4 last:border-b-0';

  const body = (
    <>
      {/* Meta row: role + optional journal chrome. Engraved, never a kicker parade. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="label-xs font-semibold text-[var(--text-2)]">{role}</p>
        {dateLabel !== undefined && <p className="text-sm text-[var(--text-2)]">{dateLabel}</p>}
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

    </>
  );

  return (
    <article
      className={shell}
      data-coach-code={signal.code}
      data-coach-tone={tone}
      aria-label={role}
    >
      <div className="flex items-start gap-3">
        {applicable ? (
          // The whole reading is the button — one big target, thumb-sized by
          // construction. `-m*/p*` keeps the text where it was while the
          // pressable area covers the band. The chevron carries the affordance:
          // a sentence explaining that a card is tappable is a sentence you read
          // once and then have to skip forever.
          <button
            type="button"
            onClick={onApply}
            aria-label={t('coach.applyAction', { weight: formatNumber(signal.nextLoadKg!) })}
            className="-m-2 flex min-w-0 flex-1 items-center gap-2 rounded-xl p-2 text-left
              transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-1)]"
          >
            <span className="min-w-0 flex-1">{body}</span>
            <ChevronRightIcon className="shrink-0 text-[var(--text-2)]" />
          </button>
        ) : (
          <div className="min-w-0 flex-1">{body}</div>
        )}

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
