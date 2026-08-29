import type { Dispatch, SetStateAction } from 'react';
import {
  completeFirstSide,
  completeSet,
  duplicateLastSet,
  uncompleteSet,
  updateSetValues,
  workoutExerciseIdentityOf,
} from '@/data/repositories/workouts';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { SetType, WorkoutSet } from '@/data/types';
import { announce } from '@/audio/announce';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { isRestTriggering, type restPlans } from '@/lib/rest';
import { loadEffortPrompt } from '@/stores/effortPrompt';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRestTimer } from '@/stores/restTimer';
import { heldSecondsAt } from './holdDuration';
import { sideStageFor } from './sideProgress';
import type { useWorkoutPace } from './useWorkoutPace';
import { setValidationCue } from './workoutCues';

/**
 * Ce qui arrive à une série quand on la saisit, la valide ou la défait.
 *
 * **Sorti de l'écran parce que ce n'est pas de l'affichage.** Chaque geste tire
 * quatre fils à la fois — l'écriture en base, le minuteur, la voix, le tutoriel —
 * et leur ordre est le sujet. Mêlés au JSX de la carte, ces enchaînements se
 * lisaient à quatre niveaux d'indentation, entre deux attributs.
 *
 * Le tutoriel et les minuteurs sont lus ici : ce sont des contextes et des
 * magasins globaux, les faire descendre en propriétés n'aurait rien dit de plus.
 */
export interface WorkoutSetActionsOptions {
  /**
   * `undefined` tant que la séance charge — le hook est monté avant les retours
   * anticipés de l'écran, comme `useWorkoutAnnouncements` et pour la même
   * raison. Les deux gestes qui nomment la séance au tutoriel se taisent alors,
   * ce qui ne coûte rien : aucune carte n'est encore à l'écran pour les
   * déclencher.
   */
  workoutId: string | undefined;
  /** Les repos par ligne, calculés une fois pour la séance entière. */
  plans: ReturnType<typeof restPlans>;
  pace: ReturnType<typeof useWorkoutPace>;
  /** La bande d'effort : au plus une ouverte, celle de la dernière série validée. */
  setEffortSetId: Dispatch<SetStateAction<string | null>>;
}

export function useWorkoutSetActions({
  workoutId,
  plans,
  pace,
  setEffortSetId,
}: WorkoutSetActionsOptions) {
  const tutorial = useTutorialControls();
  const rest = useRestTimer();
  const stopRest = useRestTimer((state) => state.stop);
  const hold = useHoldTimer();

  /** Le stade de cette série, ou `null` si elle n'est pas unilatérale. */
  const stageOf = (line: WorkoutExerciseDetail, set: WorkoutSet) =>
    sideStageFor(set, workoutExerciseIdentityOf(line).isUnilateral === 1);

  /**
   * Fin du premier côté — le seul chemin, qu'on y arrive par la coche ou par la
   * cadence qui s'achève d'elle-même.
   *
   * **Rien de durable n'en découle** : ni validation, ni repos, ni RPE, ni
   * record. La série n'est pas finie, elle est à moitié faite, et l'écrire
   * autrement enregistrerait une demi-série comme une série entière.
   *
   * L'annonce et la reprise du tempo n'ont lieu que sur `started` : un second
   * appui pendant la transition répond `existing`, et réannoncer « changement
   * de côté » à ce moment-là dirait deux fois une chose qui n'est arrivée
   * qu'une.
   */
  const finishFirstSide = (line: WorkoutExerciseDetail, setId: string): void => {
    void completeFirstSide(setId)
      .then((result) => {
        if (result.kind !== 'started') return;
        announce('side-change');
        tutorial?.report({ type: 'workout-side-turned', setId });
        pace.startSecondSide(line, setId, result.startsAt);
      })
      .catch(() => undefined);
  };

  // Warm-ups, supersets, and chained drop sets do not trigger a rest.
  const startRest = (line: WorkoutExerciseDetail, setId: string, setType: SetType): void => {
    const plan = plans.get(line.row.id);
    if (plan === undefined) return;
    const index = line.sets.findIndex((set) => set.id === setId);
    const next = index === -1 ? undefined : line.sets[index + 1];
    if (
      !isRestTriggering(
        { setType },
        { isLastOfBlock: plan.isLastOfBlock, nextSetType: next?.setType },
      )
    ) {
      return;
    }
    rest.start(setId, plan.seconds);
  };

  const onWrite = (
    line: WorkoutExerciseDetail,
    setId: string,
    values: Parameters<typeof updateSetValues>[1],
    recordable: boolean,
  ): void => {
    if (workoutId === undefined) return;
    void updateSetValues(setId, values)
      .then(() => {
        tutorial?.report({
          type: 'workout-set-written',
          workoutId,
          setId,
          recordable,
        });
      })
      .catch(() => undefined);
    pace.armFromTypedReps(line, setId, values.reps);
  };

  const onComplete = (
    line: WorkoutExerciseDetail,
    setId: string,
    values: Parameters<typeof completeSet>[1],
    set: WorkoutSet,
  ): void => {
    if (workoutId === undefined) return;
    /*
     * Sur une ligne unilatérale, la première coche finit le côté et non la
     * série. Le stade est lu dans la série elle-même : il survit ainsi à un
     * écran éteint, à un appel et à un kill — un cycle en mémoire renvoyait au
     * premier côté quelqu'un qui venait de finir les deux.
     *
     * Pendant la transition, le bouton est déjà désactivé ; la garde reste
     * parce qu'une coche peut arriver par un autre chemin que le doigt.
     */
    const stage = stageOf(line, set);
    if (stage === 'transition') return;
    if (stage === 'first') {
      finishFirstSide(line, setId);
      return;
    }
    // Le chrono est ce qui sait combien de temps a été tenu, et la coche est le
    // geste qui l'arrête : c'est donc elle qui écrit la durée. Tant qu'il
    // tourne, la saisie manuelle des secondes n'a plus lieu d'être.
    const held = hold.setId === setId ? heldSecondsAt(hold.startedAt, Date.now()) : undefined;
    const written = held === undefined ? values : { ...values, durationSeconds: held };
    void completeSet(setId, written)
      .then(() => {
        tutorial?.report({ type: 'workout-set-completed', workoutId, setId });
      })
      .catch(() => undefined);
    // The metronome or the chronometer owned this set; it is over.
    pace.stop(setId);
    startRest(line, setId, set.setType);
    announce(setValidationCue(line.sets, setId));
    // A warm-up is not an effort to report, and one strip at a time: the
    // previous question dies with the set that replaces it rather than stacking
    // up down the card.
    setEffortSetId(set.setType !== 'warmup' && loadEffortPrompt() ? setId : null);
  };

  const onUncomplete = (setId: string): void => {
    void uncompleteSet(setId);
    setEffortSetId((current) => (current === setId ? null : current));
    // Only stop the rest owned by this set.
    stopRest(setId);
  };

  const onAddSet = (rowId: string): void => {
    void duplicateLastSet(rowId)
      .then(() => tutorial?.report({ type: 'workout-set-added', rowId }))
      .catch(() => undefined);
  };

  /**
   * La cadence est arrivée au bout d'elle-même.
   *
   * Sur le premier côté d'une série unilatérale, ce n'est pas la fin de la
   * série : la cadence repart seule après dix secondes, sur la même série.
   */
  const onPaceFinished = (line: WorkoutExerciseDetail, setId: string | null): void => {
    const set = setId === null ? undefined : line.sets.find((candidate) => candidate.id === setId);
    if (setId !== null && set !== undefined && stageOf(line, set) === 'first') {
      finishFirstSide(line, setId);
      return;
    }
    pace.stop();
  };

  return { onWrite, onComplete, onUncomplete, onAddSet, onPaceFinished };
}
