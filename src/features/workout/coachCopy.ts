import type { CoachRecommendation } from '@/data/types';
import type { CoachSignal } from '@/lib/coach';
import { t } from '@/i18n/fr';
import { formatNumber } from '@/ui/numberField';

type SignalLike = Pick<CoachSignal, 'code' | 'nextLoadKg' | 'evidence'> & {
  id?: string;
};

/** Machine flags written by phase shaping — never stored as French prose. */
const FLAG_PROGRESSION_DEFERRED = 'progression_deferred';
const FLAG_CONTROLLED_ATTEMPT = 'controlled_attempt';

function evidenceValue(signal: SignalLike, label: string): number | undefined {
  return signal.evidence.find((item) => item.label === label)?.value;
}

function hasFlag(signal: SignalLike, label: string): boolean {
  return evidenceValue(signal, label) === 1;
}

/** Constat from the signal code alone (no phase requalification). */
function baseSignalMessage(signal: SignalLike): string {
  switch (signal.code) {
    case 'range_satisfied': {
      const sets = evidenceValue(signal, 'working_sets') ?? 0;
      const reps = evidenceValue(signal, 'target_reps') ?? 0;
      const max = evidenceValue(signal, 'target_reps_max') ?? 0;
      return t('coach.range_satisfied', { sets, reps, max });
    }
    // Stored `range_completed` journal rows read as ceiling (spec §4.1).
    case 'range_ceiling_reached':
    case 'range_completed': {
      const weight = signal.nextLoadKg ?? evidenceValue(signal, 'next_load_kg') ?? 0;
      const sets = evidenceValue(signal, 'working_sets') ?? 0;
      const reps = evidenceValue(signal, 'target_reps_max') ?? 0;
      const current = evidenceValue(signal, 'current_load_kg');
      // `47,5 → 50`, never `+50`: the figure on the card is the load to put on
      // the bar, so a `+` in front of it reads as an increment of fifty kilos.
      // The step is the distance between the two numbers, and it shows itself.
      if (current === undefined) {
        return t('coach.range_ceiling_reached_plain', {
          weight: formatNumber(weight),
          sets,
          reps,
        });
      }
      // Assistance gets lighter as you get stronger: same arrow, number down.
      const assist = weight < current;
      return assist
        ? t('coach.range_ceiling_reached_assist', {
            current: formatNumber(current),
            weight: formatNumber(weight),
            sets,
            reps,
          })
        : t('coach.range_ceiling_reached', {
            current: formatNumber(current),
            weight: formatNumber(weight),
            sets,
            reps,
          });
    }
    case 'range_missed': {
      const weight = signal.nextLoadKg ?? evidenceValue(signal, 'next_load_kg') ?? 0;
      const current = evidenceValue(signal, 'current_load_kg') ?? 0;
      const params = {
        current: formatNumber(current),
        weight: formatNumber(weight),
        floor: evidenceValue(signal, 'target_reps') ?? 0,
        low: evidenceValue(signal, 'low_reps') ?? 0,
        sessions: evidenceValue(signal, 'sessions') ?? 0,
      };
      // Assistance again: backing off means *more* weight on the machine.
      return weight > current
        ? t('coach.range_missed_assist', params)
        : t('coach.range_missed', params);
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

/**
 * French explanation with the numbers that produced the signal — never a bare tip.
 * Phase shaping may stamp machine flags on evidence (spec §6 / §7):
 * - `progression_deferred` → maintain when Progression had no increase_*
 * - `controlled_attempt` → Test requalifies an authorized increase_load
 */
export function coachSignalMessage(signal: SignalLike): string {
  // Progression without an authorized increase: the card is the hold, not a load step.
  if (hasFlag(signal, FLAG_PROGRESSION_DEFERRED)) {
    return t('coach.progressionDeferred');
  }

  const reason = baseSignalMessage(signal);

  // Test phase: same nextLoadKg figure, wording marks a controlled attempt.
  if (hasFlag(signal, FLAG_CONTROLLED_ATTEMPT)) {
    return t('coach.controlledAttempt', { reason });
  }

  return reason;
}

export function recommendationAsSignal(row: CoachRecommendation): SignalLike {
  return {
    id: row.id,
    code: row.code,
    nextLoadKg: row.nextLoadKg,
    evidence: row.evidence,
  };
}
