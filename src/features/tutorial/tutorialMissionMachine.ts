import { missionFor, type TutorialMission } from './tutorialMissions';
import type { TutorialEvent, TutorialMissionId, TutorialStateV3 } from './tutorialTypes';

export function startMission(
  state: TutorialStateV3,
  missionId: TutorialMissionId,
): TutorialStateV3 {
  return { ...state, activeMissionId: missionId, activeStepIndex: 0 };
}

/** L'étape suivante, ou la mission terminée et la suivante ouverte. */
function step(state: TutorialStateV3, mission: TutorialMission): TutorialStateV3 {
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

export function advanceMission(state: TutorialStateV3, event: TutorialEvent): TutorialStateV3 {
  if (state.activeMissionId === null) return state;
  const mission = missionFor(state.activeMissionId);
  const current = mission.steps[state.activeStepIndex];
  if (current === undefined) return state;
  if (current.advance.kind !== 'event' || !current.advance.accepts(event, state)) return state;
  return step(state, mission);
}

/**
 * Le « Continuer » d'une étape qui n'a rien à faire faire.
 *
 * Refusé sur une étape d'action : sans ce garde, un bouton rendu par erreur —
 * ou un clic sur celui de l'étape précédente pendant une transition — validerait
 * un geste que l'utilisateur n'a pas fait, et la mission déclarerait acquis ce
 * qu'elle devait faire pratiquer.
 */
export function continueMission(state: TutorialStateV3): TutorialStateV3 {
  if (state.activeMissionId === null) return state;
  const mission = missionFor(state.activeMissionId);
  const current = mission.steps[state.activeStepIndex];
  if (current === undefined || current.advance.kind !== 'manual') return state;
  return step(state, mission);
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
