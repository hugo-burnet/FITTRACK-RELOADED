import type { PacePreparation, PaceTarget } from './paceTarget';

/**
 * The single waiting state of the cadence, between the moment something asks
 * for it and the moment the metronome actually owns a set.
 *
 * **One value, not two flags.** The screen used to hold "waiting for the
 * repetitions" and "armed by the repetitions just typed" as two independent
 * pieces of state. Nothing forbade them from being set at once, or from
 * outliving the set they pointed at — and both are how the cadence stopped
 * arming for the rest of the session. Here they are two branches of one union:
 * being in one is being out of the other, and there is exactly one place that
 * decides what comes next.
 */
export type PacePlan =
  | { kind: 'idle' }
  /** Only the missing repetitions stand between this set and its cadence. */
  | { kind: 'awaiting-reps'; rowId: string; setId: string; afterSetId?: string }
  /** Repetitions typed: the launch is scheduled, the target not yet fixed. */
  | { kind: 'arming'; rowId: string; setId: string; launchAt: number };

export const IDLE_PACE_PLAN: PacePlan = { kind: 'idle' };

/** Preparation window announced as "début dans dix secondes". */
export const PACE_LEAD_SECONDS = 10;

/**
 * While "10" is being typed the persisted value is briefly "1". The cadence
 * reads the settled cell, never the first digit.
 */
export const PACE_SETTLE_MS = 600;

export type PaceDecision =
  /** Legitimately waiting: nothing to schedule, nothing to drop. */
  | { kind: 'hold' }
  /** The plan points at a set nobody is going to perform. Drop it. */
  | { kind: 'forget' }
  | {
      kind: 'start';
      delayMs: number;
      rowId: string;
      setId: string;
      target: PaceTarget;
      /** `null` starts a fresh ten seconds; otherwise the deadline to honour. */
      launchAt: number | null;
      /** The tap that armed this plan may already have said it. */
      announceStart: boolean;
    }
  /** Ask for the repetitions, then wait for them. */
  | { kind: 'ask'; delayMs: number; rowId: string; setId: string };

/**
 * The set a preparation still points at — `null` once it points nowhere.
 *
 * A plan is keyed on a set, and must be dropped the moment that set stops
 * being the one to pace: validated, deleted, or simply overtaken. A plan left
 * behind is not inert — it blocks every later arming.
 */
export function pacedSetIdOf(preparation: PacePreparation): string | null {
  if (preparation.kind === 'ready') return preparation.target.setId;
  if (preparation.kind === 'missing-reps') return preparation.setId;
  return null;
}

/** The set a plan is waiting on, `null` when it waits on nothing. */
export function plannedSetIdOf(plan: PacePlan): string | null {
  return plan.kind === 'idle' ? null : plan.setId;
}

/**
 * What the plan owes, given what the workout now says about its set.
 *
 * Pure: it reads a plan and a preparation and returns an intent. The screen
 * owns the clock and the sound; this owns the rule.
 */
export function paceDecision(
  plan: PacePlan,
  preparation: PacePreparation | null,
  now: number,
): PaceDecision {
  if (plan.kind === 'idle') return { kind: 'hold' };
  if (preparation === null || pacedSetIdOf(preparation) !== plan.setId) {
    return { kind: 'forget' };
  }

  if (plan.kind === 'awaiting-reps') {
    if (preparation.kind !== 'ready') return { kind: 'hold' };
    return {
      kind: 'start',
      delayMs: PACE_SETTLE_MS,
      rowId: plan.rowId,
      setId: plan.setId,
      target: preparation.target,
      launchAt: null,
      announceStart: true,
    };
  }

  if (preparation.kind === 'ready') {
    return {
      kind: 'start',
      delayMs: PACE_SETTLE_MS,
      rowId: plan.rowId,
      setId: plan.setId,
      target: preparation.target,
      launchAt: plan.launchAt,
      announceStart: false,
    };
  }

  // Everything else was filtered above: the preparation still points at this
  // set, and it is not ready — the repetitions are what is missing.
  return {
    kind: 'ask',
    delayMs: Math.max(0, plan.launchAt - now),
    rowId: plan.rowId,
    setId: plan.setId,
  };
}

/**
 * The lead left to run, read when the metronome is configured rather than when
 * the decision is taken — the settle delay must not push the beat back.
 */
export function leadSecondsAt(launchAt: number | null, now: number): number {
  if (launchAt === null) return PACE_LEAD_SECONDS;
  const remaining = Math.max(0, (launchAt - now) / 1_000);
  return remaining > 0 ? remaining : PACE_LEAD_SECONDS;
}

/**
 * Releases a plan once its set has been handed to the metronome — and only if
 * the plan is still that one. A later plan, armed while the timer ran, keeps
 * its place.
 */
export function planWithoutSet(plan: PacePlan, setId: string): PacePlan {
  return plannedSetIdOf(plan) === setId ? IDLE_PACE_PLAN : plan;
}

/** Turns the plan that was arming this set into a wait for its repetitions. */
export function planAskingReps(plan: PacePlan, rowId: string, setId: string): PacePlan {
  if (plan.kind !== 'arming' || plan.setId !== setId) return plan;
  return { kind: 'awaiting-reps', rowId, setId };
}
