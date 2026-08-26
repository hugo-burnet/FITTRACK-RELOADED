import { useState } from 'react';
import type { CoachSignal } from '@/lib/coach';
import { t } from '@/i18n/fr';
import { Button } from '@/ui';
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
   * Optional apply for a live objective that carries a load. Only the explicit
   * action writes it onto the sets left to do.
   */
  onApply?: () => void | Promise<void>;
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
    variant === 'strip'
      ? t('coach.title')
      : tone === 'objective'
        ? t('coach.objective')
        : t('coach.title');
  const reason = coachSignalMessage(signal);
  const weight = hasLoad ? formatNumber(signal.nextLoadKg!) : undefined;
  const [applying, setApplying] = useState(false);

  const apply = async () => {
    if (onApply === undefined || applying) return;
    setApplying(true);
    try {
      await onApply();
    } catch {
      // The pending recommendation remains visible and can be tried again.
    } finally {
      setApplying(false);
    }
  };

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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
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
        </div>

        {weight !== undefined && (
          <p
            className="record-figure shrink-0 text-[1.75rem] leading-none font-semibold
              tracking-tight text-[var(--text-1)]"
          >
            {weight}
            <span className="ml-1 text-sm font-semibold tracking-normal text-[var(--text-2)]">
              {t('units.kg')}
            </span>
          </p>
        )}
      </div>

      <p className="mt-2 text-sm leading-snug text-pretty text-[var(--text-1)]">{reason}</p>

      {(applicable || onDismiss !== undefined) && (
        <div className={`mt-3 flex flex-col gap-2 ${applicable ? 'min-[23rem]:flex-row' : ''}`}>
          {applicable && weight !== undefined && (
            <Button
              variant="primary"
              fullWidth
              disabled={applying}
              aria-label={t('coach.applyAction', { weight })}
              onClick={() => void apply()}
            >
              {t('coach.applyButton', { weight })}
            </Button>
          )}
          {/* Seule, la commande d'une observation flottait à droite : un mot gris
              centré dans 48 px transparents, qui se lisait comme du texte et non
              comme un bouton, avec un vide sans fonction à sa gauche. Elle prend
              sa rangée et le trait de `--border`, qui est ce qui dessine une
              surface sur le bandeau `--surface-2` où un fond `secondary`
              disparaîtrait. À côté d'« Appliquer », rien ne change : le contraste
              avec l'aplat plein suffit déjà à la situer. */}
          {onDismiss !== undefined && (
            <Button
              variant="ghost"
              fullWidth={!applicable}
              disabled={applying}
              onClick={onDismiss}
              className={
                applicable ? 'min-[23rem]:shrink-0' : 'border border-[var(--border)]'
              }
            >
              {t(hasLoad ? 'coach.dismiss' : 'coach.hideObservation')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
