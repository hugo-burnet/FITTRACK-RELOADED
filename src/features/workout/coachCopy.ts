import type { CoachRecommendation } from '@/data/types';
import type { CoachSignal } from '@/lib/coach';
import { t } from '@/i18n/fr';
import { formatNumber } from '@/ui/numberField';

type SignalLike = Pick<CoachSignal, 'code' | 'nextLoadKg' | 'evidence'> & {
  id?: string;
};

function evidenceValue(signal: SignalLike, label: string): number | undefined {
  return signal.evidence.find((item) => item.label === label)?.value;
}

/** French explanation with the numbers that produced the signal — never a bare tip. */
export function coachSignalMessage(signal: SignalLike): string {
  switch (signal.code) {
    case 'range_completed': {
      const weight = signal.nextLoadKg ?? evidenceValue(signal, 'next_load_kg') ?? 0;
      const sets = evidenceValue(signal, 'working_sets') ?? 0;
      const reps = evidenceValue(signal, 'target_reps_max') ?? 0;
      const current = evidenceValue(signal, 'current_load_kg');
      const assist = current !== undefined && weight < current;
      return assist
        ? t('coach.range_completed_assist', {
            weight: formatNumber(weight),
            sets,
            reps,
          })
        : t('coach.range_completed', {
            weight: formatNumber(weight),
            sets,
            reps,
          });
    }
    case 'intra_session_drop':
      return t('coach.intra_session_drop', {
        first: evidenceValue(signal, 'first_reps') ?? 0,
        low: evidenceValue(signal, 'low_reps') ?? 0,
        drop: evidenceValue(signal, 'drop_reps') ?? 0,
      });
    case 'plateau':
      return t('coach.plateau', {
        sessions: evidenceValue(signal, 'sessions') ?? 0,
        value: formatNumber(evidenceValue(signal, 'best_1rm_kg') ?? 0),
      });
    case 'long_rest':
      return t('coach.long_rest', {
        seconds: evidenceValue(signal, 'max_rest_seconds') ?? 0,
      });
  }
}

export function recommendationAsSignal(row: CoachRecommendation): SignalLike {
  return {
    id: row.id,
    code: row.code,
    nextLoadKg: row.nextLoadKg,
    evidence: row.evidence,
  };
}
