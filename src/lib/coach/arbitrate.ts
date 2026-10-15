import { CODE_ORDER } from './constants';
import type { CoachAction, CoachSignal } from './types';

/**
 * Décider, une fois les règles passées : quelles actions elles autorisent, et lequel de leurs
 * signaux la carte montre. Les règles ne se connaissent pas entre elles ; c'est ici qu'on tranche.
 */

/**
 * Build the action set from performance signals only (phase does not touch this).
 * Plateau strips every prescription escalation, including `add_set`.
 */
export function buildAllowedActions(signals: readonly CoachSignal[]): CoachAction[] {
  const allowed = new Set<CoachAction>(['maintain']);
  const codes = new Set(signals.map((signal) => signal.code));

  if (codes.has('range_satisfied')) {
    allowed.add('increase_reps');
  }
  const grinding = signals.some((signal) =>
    signal.evidence.some((item) => item.label === 'ceiling_grinding' && item.value === 1),
  );
  const stepNeedsReps = signals.some((signal) =>
    signal.evidence.some((item) => item.label === 'step_needs_reps'),
  );
  // Un plafond arraché n'autorise ni charge ni série de plus : consolider, c'est
  // refaire la même séance plus facilement. Un cran pas encore absorbé n'autorise
  // que des répétitions de plus.
  if ((codes.has('range_ceiling_reached') || codes.has('range_completed')) && !grinding) {
    if (stepNeedsReps) {
      allowed.add('increase_reps');
    } else {
      allowed.add('increase_load');
      allowed.add('add_set');
    }
  }
  if (codes.has('range_missed')) {
    allowed.add('reduce_load');
  }

  if (codes.has('plateau')) {
    for (const action of ['increase_reps', 'increase_load', 'add_set'] as const) {
      allowed.delete(action);
    }
  }
  // Reprise : ni charge ni série de plus. Les répétitions, elles, peuvent monter.
  if (codes.has('returning')) {
    allowed.delete('increase_load');
    allowed.delete('add_set');
  }

  return [...allowed];
}

function isLoadlessCeiling(signal: CoachSignal): boolean {
  return (
    (signal.code === 'range_ceiling_reached' || signal.code === 'range_completed') &&
    signal.nextLoadKg === undefined
  );
}

/** A shaped escalate / deferred hold must not erase the plateau constat (spec §5.2). */
function hidesPlateau(signal: CoachSignal): boolean {
  if (signal.code === 'plateau') return false;
  if (isLoadlessCeiling(signal)) return true;
  return signal.evidence.some(
    (item) => item.label === 'progression_deferred' && item.value === 1,
  );
}

/** Rank signals and keep the single strongest per exercise. */
export function pickSignals(signals: readonly CoachSignal[]): CoachSignal[] {
  const best = new Map<string, CoachSignal>();

  for (const signal of signals) {
    const current = best.get(signal.exerciseId);
    if (current === undefined) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (signal.code === 'plateau' && hidesPlateau(current)) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (current.code === 'plateau' && hidesPlateau(signal)) {
      continue;
    }
    if (signal.severity > current.severity) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (signal.severity < current.severity) continue;
    if (CODE_ORDER.indexOf(signal.code) < CODE_ORDER.indexOf(current.code)) {
      best.set(signal.exerciseId, signal);
    }
  }

  return [...best.values()].sort(
    (a, b) => b.severity - a.severity || CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code),
  );
}
