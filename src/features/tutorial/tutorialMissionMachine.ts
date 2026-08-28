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
  const done: TutorialStateV3 = {
    ...state,
    activeMissionId: mission.nextMissionId,
    activeStepIndex: 0,
    missions: { ...state.missions, [mission.id]: 'completed' },
  };
  return mission.completes?.(done) ?? done;
}

export function advanceMission(state: TutorialStateV3, event: TutorialEvent): TutorialStateV3 {
  if (state.activeMissionId === null) return state;
  const mission = missionFor(state.activeMissionId);
  const current = mission.steps[state.activeStepIndex];
  if (current === undefined) return state;
  if (current.advance.kind !== 'event' || !current.advance.accepts(event, state)) return state;
  // Ce que l'étape retient est écrit avant d'avancer : l'identité de la routine
  // que ce geste vient de créer sert déjà de garde à l'étape suivante.
  return step(current.remember?.(state, event) ?? state, mission);
}

/** L'entrée dans la campagne : l'acte 1 s'ouvre, et la préparation commence. */
export function startCampaign(state: TutorialStateV3): TutorialStateV3 {
  if (state.activeMissionId !== null) return state;
  return { ...startMission(state, 'TUT-CAM-01'), campaign: 'preparing' };
}

/**
 * La reprise de la campagne, et la seule.
 *
 * Entre les deux actes, le tutoriel n'a rien à faire : la routine découverte
 * existe, et il attend. Il ne reprend que sur **cette** routine réellement
 * démarrée — une séance lancée sur une autre n'est pas la suite de cette leçon,
 * et fabriquer la séance nous-mêmes reviendrait à écrire un faux historique
 * pour les besoins d'une démonstration.
 */
export function resumeCampaignForWorkout(
  state: TutorialStateV3,
  workout: { workoutId: string; routineId?: string },
): TutorialStateV3 {
  if (state.campaign !== 'routine-ready' || state.activeMissionId !== null) return state;
  if (state.campaignRoutineId === null || workout.routineId !== state.campaignRoutineId) {
    return state;
  }
  return { ...startMission(state, 'TUT-CAM-02'), campaign: 'workout-active' };
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
