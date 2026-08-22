import { useEffect, useRef, useState } from 'react';
import { announce, primeAnnouncer } from '@/audio/announce';
import {
  workoutExerciseIdentityOf,
  type WorkoutExerciseDetail,
} from '@/data/repositories/workouts';
import { resolveRepSeconds } from '@/lib/tempo';
import { useHoldTimer } from '@/stores/holdTimer';
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
import {
  cadenceFor,
  prepareFollowingExercisePace,
  prepareNextPace,
  type PaceTarget,
} from './paceTarget';

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

/**
 * One exercise line, as the pace reads it.
 *
 * L'exercice en fait partie depuis que l'horloge peut être une montre : c'est
 * le type de mesure qui dit laquelle des deux tourne, et il vient de
 * l'instantané de la ligne avant la bibliothèque.
 */
type Line = Pick<WorkoutExerciseDetail, 'row' | 'sets' | 'exercise' | 'identity'>;

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
  const startHold = useHoldTimer((state) => state.start);
  const stopHold = useHoldTimer((state) => state.stop);
  const holdSetId = useHoldTimer((state) => state.setId);
  const holdRowId = useHoldTimer((state) => state.rowId);

  const repSecondsOf = (line: Line): number =>
    resolveRepSeconds(line.row.repSeconds, defaultRepSeconds);

  const cadenceOf = (line: Line) =>
    cadenceFor(workoutExerciseIdentityOf(line).measurementType, repSecondsOf(line));

  /**
   * Une seule horloge à la fois, et c'est ici que ça se décide.
   *
   * Deux horloges vivantes, ce sont deux files audio qui parlent l'une par-dessus
   * l'autre et deux relevés qui se disputent la même place dans le bandeau. Même
   * règle que « un seul repos à la fois », et elle est épinglée par un test
   * plutôt que laissée à la discipline des appelants.
   */
  const startClock = (rowId: string, target: PaceTarget, leadSeconds: number): void => {
    if (target.kind === 'hold') {
      stopPace();
      startHold(rowId, target.setId, leadSeconds);
      return;
    }
    stopHold();
    startPace(rowId, target.setId, target.reps, target.repSeconds, leadSeconds);
  };

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
            cadenceOf(line),
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
      startClock(
        decision.rowId,
        decision.target,
        // Read now, not when the decision was taken: the settle delay must not
        // push the beat back.
        leadSecondsAt(decision.launchAt, Date.now()),
      );
      setPlan((current) => planWithoutSet(current, decision.setId));
    }, decision.delayMs);
    return () => clearTimeout(timer);
    // `cadenceOf` et `startClock` sont recréés à chaque rendu : les lister
    // rejouerait cet effet en boucle et annulerait le minuteur qu'il vient
    // d'armer. Tout ce dont ils dépendent réellement est déjà là — `lines` et
    // `defaultRepSeconds` pour la cadence, des actions Zustand stables pour les
    // deux horloges.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, plan, startPace, defaultRepSeconds]);

  const startFor = (line: Line, afterSetId?: string): boolean => {
    const preparation = prepareNextPace(line.sets, cadenceOf(line), afterSetId);
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
    // Se mettre en gainage prend dix secondes ; se remettre sous la barre après
    // un repos qui vient de compter 3–2–1 n'en prend aucune. Une cadence de
    // répétitions, elle, part quand on la lance : la main est déjà sur la barre.
    const lead = target.kind === 'hold' && afterSetId === undefined ? PACE_LEAD_SECONDS : 0;
    if (lead > 0) announce('pace-start-10');
    startClock(line.row.id, target, lead);
    return true;
  };

  const startFollowing = (completedLine: Line): boolean => {
    const following = prepareFollowingExercisePace(
      lines.map((line) => ({
        rowId: line.row.id,
        sets: line.sets,
        cadence: cadenceOf(line),
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
    startClock(following.rowId, target, PACE_LEAD_SECONDS);
    return true;
  };

  const armFromTypedReps = (line: Line, setId: string, reps: number | undefined): void => {
    if (reps === undefined || reps <= 0) return;
    // Une ligne chronométrée n'a pas de colonne « répétitions » : rien ne peut y
    // être tapé, et rien ne doit y armer une cadence qui n'a rien à battre.
    if (cadenceOf(line).kind === 'hold') return;
    const nextWorkingSet = line.sets.find(
      (set) => set.deletedAt === 0 && set.setType !== 'warmup' && set.isCompleted === 0,
    );
    if (
      nextWorkingSet?.id !== setId ||
      pacer.setId !== null ||
      holdSetId !== null ||
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
    const cadence = cadenceOf(line);
    const running =
      cadence.kind === 'hold'
        ? holdRowId === line.row.id && holdSetId !== null
        : pacer.rowId === line.row.id && pacer.setId !== null;
    const preparation = prepareNextPace(line.sets, cadence);
    const target = preparation.kind === 'ready' ? preparation.target : null;

    return {
      kind: cadence.kind,
      rowId: line.row.id,
      name,
      repSeconds: running && cadence.kind === 'reps' ? pacer.repSeconds : repSecondsOf(line),
      defaultRepSeconds: defaultRepSeconds ?? repSecondsOf(line),
      reps:
        running && cadence.kind === 'reps'
          ? pacer.reps
          : target?.kind === 'reps'
            ? target.reps
            : null,
      canStart: preparation.kind !== 'done',
      running,
    };
  };

  /** Arrête l'horloge de ce set, quelle que soit celle des deux qui le suivait. */
  const stop = (setId?: string): void => {
    stopPace(setId);
    stopHold(setId);
  };

  return { repSecondsOf, startFor, startFollowing, armFromTypedReps, stop, viewFor };
}
