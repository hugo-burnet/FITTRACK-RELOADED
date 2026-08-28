import { missionFor } from './tutorialMissions';
import type { TutorialEvent, TutorialMissionId, TutorialStateV3 } from './tutorialTypes';

export function startMission(
  state: TutorialStateV3,
  missionId: TutorialMissionId,
): TutorialStateV3 {
  return { ...state, activeMissionId: missionId, activeStepIndex: 0 };
}

export function advanceMission(state: TutorialStateV3, event: TutorialEvent): TutorialStateV3 {
  if (state.activeMissionId === null) return state;
  const mission = missionFor(state.activeMissionId);
  const step = mission.steps[state.activeStepIndex];
  if (step === undefined || !step.advanceWhen(event)) return state;
  if (state.activeStepIndex + 1 < mission.steps.length) {
    return { ...state, activeStepIndex: state.activeStepIndex + 1 };
  }
  return {
    ...state,
    activeMissionId: mission.nextMissionId,
    activeStepIndex: 0,
    missions: { ...state.missions, [mission.id]: 'completed' },
  };
}

export function dismissMission(state: TutorialStateV3): TutorialStateV3 {
  if (state.activeMissionId === null) return state;
  return {
    ...state,
    activeMissionId: null,
    activeStepIndex: 0,
    missions: { ...state.missions, [state.activeMissionId]: 'dismissed' },
  };
}
