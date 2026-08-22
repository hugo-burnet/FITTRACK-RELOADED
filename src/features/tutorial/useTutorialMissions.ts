import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { advanceMission, dismissMission, startMission } from './tutorialMissionMachine';
import { isMissionAvailable, missionFor, type TutorialMissionFacts } from './tutorialMissions';
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

  const start = useCallback(
    (missionId: TutorialMissionId) =>
      commit((current) =>
        isMissionAvailable(missionFor(missionId), facts)
          ? startMission(current, missionId)
          : current,
      ),
    [commit, facts],
  );
  const offer = useCallback(
    (missionId: TutorialMissionId) =>
      commit((current) => {
        const mission = missionFor(missionId);
        if (
          current.activeMissionId !== null ||
          current.missions[missionId] !== undefined ||
          (mission.guard !== 'external' && !isMissionAvailable(mission, facts))
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

  useEffect(() => {
    if (activeMission === null || activeMission.routePrefix === '/') return;
    if (!pathname.startsWith(activeMission.routePrefix)) navigate(activeMission.routePrefix);
  }, [activeMission, navigate, pathname]);

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
    start,
    offer,
    report,
    dismiss,
    setOrientation,
    chooseActivation,
  };
}
