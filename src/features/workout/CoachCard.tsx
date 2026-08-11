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
};

/**
 * Coach readout — text and surface only. Accent is reserved for actions,
 * validated sets and records (charter).
 */
export function CoachCard({ signal, onDismiss, tone = 'signal' }: Props) {
  const heading =
    tone === 'objective' && signal.nextLoadKg !== undefined
      ? t('coach.nextLoad', { weight: formatNumber(signal.nextLoadKg) })
      : t('coach.title');

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"
      data-coach-code={signal.code}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-xs font-semibold text-[var(--text-2)]">
            {tone === 'objective' ? t('coach.objective') : heading}
          </p>
          {tone === 'objective' && signal.nextLoadKg !== undefined && (
            <p className="metric mt-1 text-base font-semibold text-[var(--text-1)]">
              {t('coach.nextLoad', { weight: formatNumber(signal.nextLoadKg) })}
            </p>
          )}
          <p className="mt-1 text-sm leading-snug text-[var(--text-1)]">
            {coachSignalMessage(signal)}
          </p>
        </div>
        {onDismiss !== undefined && (
          <button
            type="button"
            onClick={onDismiss}
            className="label-xs shrink-0 rounded-lg px-2 py-2 font-semibold text-[var(--text-2)]
              transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-1)]"
          >
            {t('coach.dismiss')}
          </button>
        )}
      </div>
    </div>
  );
}
