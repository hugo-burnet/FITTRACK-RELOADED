import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
  advanceMission,
  continueMission,
  dismissMission,
  startMission,
} from './tutorialMissionMachine';
import {
  isMissionAvailable,
  isMissionReachable,
  missionFor,
  routeContextOf,
  stepOf,
  type TutorialMissionFacts,
} from './tutorialMissions';
import {
  movesForward,
  pathForScreen,
  programIdFromPath,
  routineIdFromPath,
  screenHolds,
} from './tutorialScreens';
import { useTutorialAnchor } from './useTutorialAnchor';
import { loadTutorialState, saveTutorialState } from './tutorialStore';
import type {
  TutorialCompletion,
  TutorialEvent,
  TutorialMissionId,
  TutorialStateV3,
} from './tutorialTypes';

export function useTutorialMissions(
  pathname: string,
  navigate: NavigateFunction,
  facts: TutorialMissionFacts,
) {
  const [state, setState] = useState<TutorialStateV3>(loadTutorialState);
  const stateRef = useRef(state);

  const commit = useCallback((change: (current: TutorialStateV3) => TutorialStateV3) => {
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
        if (!isMissionReachable(mission, routeContextOf(current))) return current;
        return startMission(current, missionId);
      });
      if (!started) return false;
      const first = missionFor(missionId).steps[0];
      if (first === undefined) return true;
      const context = routeContextOf(stateRef.current);
      const destination = pathForScreen(first.screen, context);
      if (destination !== null && !screenHolds(pathname, first.screen, context)) {
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
          !isMissionReachable(mission, routeContextOf(current))
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
  const advanceManually = useCallback(() => commit(continueMission), [commit]);
  /*
   * Rouvrir l'écran de l'étape quand sa commande ne s'y trouve pas.
   *
   * Une route paresseuse peut échouer à charger, une liste peut rester vide sur
   * une lecture ratée : la cible n'arrive alors jamais, et attendre en silence
   * est une impasse. Redemander l'adresse remonte la route ; si la commande
   * manque encore, l'utilisateur a l'autre sortie sous les yeux.
   */
  const retryStep = useCallback(() => {
    const current = stateRef.current;
    if (current.activeMissionId === null) return;
    const step = stepOf(missionFor(current.activeMissionId), current.activeStepIndex);
    if (step === null) return;
    const destination = pathForScreen(step.screen, routeContextOf(current));
    if (destination !== null) navigate(destination, { replace: true });
  }, [navigate]);
  const setOrientation = useCallback(
    (orientation: TutorialCompletion) => commit((current) => ({ ...current, orientation })),
    [commit],
  );
  /*
   * L'entrée dans la campagne, et sa seule alternative : plus tard.
   *
   * Le démarrage et la mission sont écrits d'un seul tenant. Deux écritures
   * laisseraient, entre les deux, un état où la campagne est « en préparation »
   * sans mission active — c'est-à-dire un tutoriel qui se croit commencé et ne
   * dirige rien.
   */
  const startCampaign = useCallback(
    () =>
      commit((current) => {
        if (current.activeMissionId !== null) return current;
        if (!isMissionAvailable(missionFor('TUT-CAM-01'), facts)) return current;
        return { ...startMission(current, 'TUT-CAM-01'), campaign: 'preparing' };
      }),
    [commit, facts],
  );
  const postponeCampaign = useCallback(
    () =>
      commit((current) =>
        current.campaign === 'not-started' ? { ...current, campaign: 'dismissed' } : current,
      ),
    [commit],
  );

  const activeMission = useMemo(
    () => (state.activeMissionId === null ? null : missionFor(state.activeMissionId)),
    [state.activeMissionId],
  );

  const routeContext = useMemo(() => routeContextOf(state), [state]);
  const activeStep = stepOf(activeMission, state.activeStepIndex);
  const onStepScreen =
    activeStep !== null && screenHolds(pathname, activeStep.screen, routeContext);

  /*
   * La cible existe-t-elle, là, maintenant ?
   *
   * Être sur le bon écran ne suffit pas : la route est paresseuse, la liste
   * vient de Dexie, et l'ancre apparaît quelques images après l'adresse. La
   * consigne partait pendant cet intervalle — une voix qui décrit un bouton que
   * personne ne voit encore. `useTutorialAnchor` suit l'apparition et la
   * disparition de l'ancre ; on ne parle qu'une fois qu'elle est là.
   */
  const anchorSelector =
    activeStep === null || !onStepScreen ? null : `[data-tutorial-id="${activeStep.targetId}"]`;
  const anchorRect = useTutorialAnchor(anchorSelector);
  const stepReady = activeStep !== null && onStepScreen && anchorRect !== null;

  /*
   * La routine et le programme dont parlent les missions, retenus dès qu'on
   * entre dans leur écran.
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

  const pathProgramId = programIdFromPath(pathname);
  useEffect(() => {
    if (pathProgramId === null) return;
    commit((current) =>
      current.missionProgramId === pathProgramId
        ? current
        : { ...current, missionProgramId: pathProgramId },
    );
  }, [commit, pathProgramId]);

  useEffect(() => {
    if (activeStep === null || onStepScreen || activeStep.reach === 'wait') return;
    const destination = pathForScreen(activeStep.screen, routeContext);
    if (destination === null || !movesForward(pathname, destination)) return;
    navigate(destination);
  }, [activeStep, navigate, onStepScreen, pathname, routeContext]);

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
    stepReady,
    anchorRect,
    start,
    offer,
    report,
    dismiss,
    advanceManually,
    retryStep,
    setOrientation,
    startCampaign,
    postponeCampaign,
  };
}
