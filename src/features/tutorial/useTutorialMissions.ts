import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { advanceMission, dismissMission, startMission } from './tutorialMissionMachine';
import {
  isMissionAvailable,
  isMissionReachable,
  missionFor,
  stepOf,
  type TutorialMissionFacts,
} from './tutorialMissions';
import { movesForward, pathForScreen, routineIdFromPath, screenHolds } from './tutorialScreens';
import { loadTutorialState, saveTutorialState } from './tutorialStore';
import type {
  TutorialActivationPath,
  TutorialCompletion,
  TutorialEvent,
  TutorialMissionId,
  TutorialStateV2,
} from './tutorialTypes';

export function useTutorialMissions(
  pathname: string,
  navigate: NavigateFunction,
  facts: TutorialMissionFacts,
) {
  const [state, setState] = useState<TutorialStateV2>(loadTutorialState);
  const stateRef = useRef(state);

  const commit = useCallback((change: (current: TutorialStateV2) => TutorialStateV2) => {
    const current = stateRef.current;
    const next = change(current);
    if (next === current) return false;
    stateRef.current = next;
    saveTutorialState(next);
    setState(next);
    return true;
  }, []);

  /*
   * Une mission choisie dans l'aide de la page emmène tout de suite sur son
   * écran, y compris en arrière — l'utilisateur vient de la demander. Le trajet
   * ne passe donc pas par la règle de l'effet, qui, elle, ne va qu'en avant.
   */
  const start = useCallback(
    (missionId: TutorialMissionId) => {
      const started = commit((current) => {
        const mission = missionFor(missionId);
        if (!isMissionAvailable(mission, facts)) return current;
        if (!isMissionReachable(mission, current.missionRoutineId)) return current;
        return startMission(current, missionId);
      });
      if (!started) return false;
      const first = missionFor(missionId).steps[0];
      if (first === undefined) return true;
      const { missionRoutineId } = stateRef.current;
      const destination = pathForScreen(first.screen, missionRoutineId);
      if (destination !== null && !screenHolds(pathname, first.screen, missionRoutineId)) {
        navigate(destination);
      }
      return true;
    },
    [commit, facts, navigate, pathname],
  );
  const offer = useCallback(
    (missionId: TutorialMissionId) =>
      commit((current) => {
        const mission = missionFor(missionId);
        if (
          current.activeMissionId !== null ||
          current.missions[missionId] !== undefined ||
          (mission.guard !== 'external' && !isMissionAvailable(mission, facts)) ||
          !isMissionReachable(mission, current.missionRoutineId)
        ) {
          return current;
        }
        return startMission(current, missionId);
      }),
    [commit, facts],
  );
  const report = useCallback(
    (event: TutorialEvent) => commit((current) => advanceMission(current, event)),
    [commit],
  );
  const dismiss = useCallback(() => commit(dismissMission), [commit]);
  const setOrientation = useCallback(
    (orientation: TutorialCompletion) => commit((current) => ({ ...current, orientation })),
    [commit],
  );
  const chooseActivation = useCallback(
    (activationPath: TutorialActivationPath | null) =>
      commit((current) => {
        if (current.activeMissionId !== null) return current;
        if (activationPath === null) {
          return current.activationPath === null ? current : { ...current, activationPath };
        }
        const missionId = activationPath === 'template' ? 'TUT-ACT-01' : 'TUT-ROU-01';
        if (!isMissionAvailable(missionFor(missionId), facts)) return current;
        return { ...startMission(current, missionId), activationPath };
      }),
    [commit, facts],
  );

  const activeMission = useMemo(
    () => (state.activeMissionId === null ? null : missionFor(state.activeMissionId)),
    [state.activeMissionId],
  );

  const activeStep = stepOf(activeMission, state.activeStepIndex);
  const onStepScreen =
    activeStep !== null && screenHolds(pathname, activeStep.screen, state.missionRoutineId);

  /*
   * La routine dont parlent les missions de composition, retenue dès qu'on
   * entre dans son éditeur.
   *
   * C'est l'URL qui l'apprend, et non les événements : une mission lancée
   * depuis l'aide de la page n'en a émis aucun, et c'est précisément le cas où
   * l'ancienne version partait dans le vide.
   */
  const pathRoutineId = routineIdFromPath(pathname);
  useEffect(() => {
    if (pathRoutineId === null) return;
    commit((current) =>
      current.missionRoutineId === pathRoutineId
        ? current
        : { ...current, missionRoutineId: pathRoutineId },
    );
  }, [commit, pathRoutineId]);

  useEffect(() => {
    if (activeStep === null || onStepScreen || activeStep.reach === 'wait') return;
    const destination = pathForScreen(activeStep.screen, state.missionRoutineId);
    if (destination === null || !movesForward(pathname, destination)) return;
    navigate(destination);
  }, [activeStep, navigate, onStepScreen, pathname, state.missionRoutineId]);

  useEffect(() => {
    if (
      activeMission === null ||
      activeMission.guard === 'always' ||
      activeMission.guard === 'external' ||
      facts.hasActiveWorkout === null ||
      isMissionAvailable(activeMission, facts)
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      commit((current) =>
        current.activeMissionId === activeMission.id ? dismissMission(current) : current,
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeMission, commit, facts]);

  return {
    state,
    activeMission,
    activeStep,
    onStepScreen,
    start,
    offer,
    report,
    dismiss,
    setOrientation,
    chooseActivation,
  };
}
