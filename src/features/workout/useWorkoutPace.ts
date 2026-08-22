import { useEffect, useRef, useState } from 'react';
import { announce, primeAnnouncer } from '@/audio/announce';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { resolveRepSeconds } from '@/lib/tempo';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import type { PaceSheetView } from './PaceSheet';
import {
  IDLE_PACE_PLAN,
  PACE_LEAD_SECONDS,
  leadSecondsAt,
  paceDecision,
  planAskingReps,
  planWithoutSet,
  type PacePlan,
} from './paceMachine';
import { prepareFollowingExercisePace, prepareNextPace } from './paceTarget';

/**
 * The whole preparation of a cadence, kept in one place.
 *
 * It was inside `WorkoutScreen`, spread across a state, a ref, one long effect
 * and four closures, in a component that also owns the sheets, the rest, the
 * records and the effort strip. The metronome is a subject of its own — when it
 * arms, what it does about a set with no repetitions yet, how it hands the beat
 * from one exercise to the next — and it now reads as one.
 *
 * Nothing about the rules changed; the comments that carry them moved with the
 * code they explain.
 */

/** One exercise line, as the pace reads it. */
type Line = Pick<WorkoutExerciseDetail, 'row' | 'sets'>;

export interface WorkoutPace {
  /** The tempo in force for a line: its own choice, then the preference, then 3 s. */
  repSecondsOf: (line: Line) => number;
  /**
   * Starts the cadence of a line's next working set. Returns false when there
   * is nothing left to beat, which is how the rest knows to fall back.
   */
  startFor: (line: Line, afterSetId?: string) => boolean;
  /** Hands the beat to the exercise that follows a finished one. */
  startFollowing: (completedLine: Line) => boolean;
  /** Arms the ten-second preparation from the first digit typed into a cell. */
  armFromTypedReps: (line: Line, setId: string, reps: number | undefined) => void;
  stop: (setId?: string) => void;
  /** What the tempo sheet shows for a line, `null` when no line is open. */
  viewFor: (line: Line | null, name: string) => PaceSheetView | null;
}

export function useWorkoutPace(
  lines: readonly Line[],
  defaultRepSeconds: number | undefined,
): WorkoutPace {
  /** The one cadence being prepared — waiting for reps, or armed by them. */
  const [plan, setPlan] = useState<PacePlan>(IDLE_PACE_PLAN);
  const armedTypedSets = useRef(new Set<string>());
  const pacer = useRepPacer();
  const startPace = useRepPacer((state) => state.start);
  const stopPace = useRepPacer((state) => state.stop);
  const stopRest = useRestTimer((state) => state.stop);
  const restingSetId = useRestTimer((state) => state.setId);

  const repSecondsOf = (line: Line): number =>
    resolveRepSeconds(line.row.repSeconds, defaultRepSeconds);

  // Waiting for repetitions is legitimate; waiting for a set nobody is going to
  // perform is not, and it costs every arming that comes after — validating a
  // set inside its own ten-second lead is the ordinary way of logging a series
  // after doing it. `paceDecision` is what says which of the two this is.
  //
  // Ten seconds gives enough time to put the phone down and get under the bar;
  // the final 3–2–1 is armed by `RepPaceRail` at the right time.
  useEffect(() => {
    if (plan.kind === 'idle') return;
    const rowId = plan.rowId;
    const line = lines.find(({ row }) => row.id === rowId);
    const preparation =
      line === undefined
        ? null
        : prepareNextPace(
            line.sets,
            resolveRepSeconds(line.row.repSeconds, defaultRepSeconds),
            plan.kind === 'awaiting-reps' ? plan.afterSetId : undefined,
          );
    const decision = paceDecision(plan, preparation, Date.now());

    if (decision.kind === 'hold') return;
    if (decision.kind === 'forget') {
      const forget = setTimeout(() => setPlan((current) => planWithoutSet(current, plan.setId)));
      return () => clearTimeout(forget);
    }

    if (decision.kind === 'ask') {
      const timer = setTimeout(() => {
        announce('pace-reps-missing');
        setPlan((current) => planAskingReps(current, decision.rowId, decision.setId));
      }, decision.delayMs);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (decision.announceStart) announce('pace-start-10');
      startPace(
        decision.rowId,
        decision.target.setId,
        decision.target.reps,
        decision.target.repSeconds,
        // Read now, not when the decision was taken: the settle delay must not
        // push the beat back.
        leadSecondsAt(decision.launchAt, Date.now()),
      );
      setPlan((current) => planWithoutSet(current, decision.setId));
    }, decision.delayMs);
    return () => clearTimeout(timer);
  }, [lines, plan, startPace, defaultRepSeconds]);

  const startFor = (line: Line, afterSetId?: string): boolean => {
    const preparation = prepareNextPace(line.sets, repSecondsOf(line), afterSetId);
    if (preparation.kind === 'done') return false;
    primeAnnouncer();
    // Starting the next set is the clearest possible signal that rest is over.
    // Keeping both clocks alive hides the pace reading and lets the rest
    // countdown speak over the repetition beats.
    stopRest();
    if (preparation.kind === 'missing-reps') {
      setPlan({
        kind: 'awaiting-reps',
        rowId: line.row.id,
        setId: preparation.setId,
        afterSetId,
      });
      announce('pace-reps-missing');
      return true;
    }
    // An explicit launch supersedes whatever was being prepared: replacing the
    // single plan is what keeps a delayed launch from restarting a cadence the
    // user has just stopped.
    setPlan(IDLE_PACE_PLAN);
    const target = preparation.target;
    startPace(line.row.id, target.setId, target.reps, target.repSeconds);
    return true;
  };

  const startFollowing = (completedLine: Line): boolean => {
    const following = prepareFollowingExercisePace(
      lines.map((line) => ({
        rowId: line.row.id,
        sets: line.sets,
        repSeconds: repSecondsOf(line),
      })),
      completedLine.row.id,
    );
    if (following === null) return false;

    primeAnnouncer();
    stopRest();
    if (following.preparation.kind === 'missing-reps') {
      setPlan({
        kind: 'awaiting-reps',
        rowId: following.rowId,
        setId: following.preparation.setId,
      });
      announce('pace-reps-missing');
      return true;
    }

    const target = following.preparation.target;
    setPlan(IDLE_PACE_PLAN);
    // A new exercise needs its own preparation window. The rest has just
    // finished; this is a fresh "dans dix secondes", followed by 3–2–1.
    announce('pace-start-10');
    startPace(following.rowId, target.setId, target.reps, target.repSeconds, 10);
    return true;
  };

  const armFromTypedReps = (line: Line, setId: string, reps: number | undefined): void => {
    if (reps === undefined || reps <= 0) return;
    const nextWorkingSet = line.sets.find(
      (set) => set.deletedAt === 0 && set.setType !== 'warmup' && set.isCompleted === 0,
    );
    if (
      nextWorkingSet?.id !== setId ||
      pacer.setId !== null ||
      restingSetId !== null ||
      plan.kind !== 'idle' ||
      armedTypedSets.current.has(setId)
    ) {
      return;
    }

    armedTypedSets.current.add(setId);
    primeAnnouncer();
    announce('pace-start-10');
    // The first digit deliberately starts the ten-second preparation, while
    // the effect above waits for the complete cell value before fixing the
    // cadence target (for example 10, not the transient 1).
    setPlan({
      kind: 'arming',
      rowId: line.row.id,
      setId,
      launchAt: Date.now() + PACE_LEAD_SECONDS * 1_000,
    });
  };

  const viewFor = (line: Line | null, name: string): PaceSheetView | null => {
    if (line === null) return null;
    const running = pacer.rowId === line.row.id && pacer.setId !== null;
    const preparation = prepareNextPace(line.sets, repSecondsOf(line));

    return {
      rowId: line.row.id,
      name,
      repSeconds: running ? pacer.repSeconds : repSecondsOf(line),
      defaultRepSeconds: defaultRepSeconds ?? repSecondsOf(line),
      reps: running ? pacer.reps : preparation.kind === 'ready' ? preparation.target.reps : null,
      canStart: preparation.kind !== 'done',
      running,
    };
  };

  return { repSecondsOf, startFor, startFollowing, armFromTypedReps, stop: stopPace, viewFor };
}
