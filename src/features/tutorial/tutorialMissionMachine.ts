import { missionFor } from './tutorialMissions';
import type { TutorialEvent, TutorialMissionId, TutorialStateV2 } from './tutorialTypes';

export function startMission(
  state: TutorialStateV2,
  missionId: TutorialMissionId,
): TutorialStateV2 {
  return { ...state, activeMissionId: missionId, activeStepIndex: 0 };
}

export function advanceMission(state: TutorialStateV2, event: TutorialEvent): TutorialStateV2 {
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

export function dismissMission(state: TutorialStateV2): TutorialStateV2 {
  if (state.activeMissionId === null) return state;
  return {
    ...state,
    activeMissionId: null,
    activeStepIndex: 0,
    missions: { ...state.missions, [state.activeMissionId]: 'dismissed' },
  };
}
