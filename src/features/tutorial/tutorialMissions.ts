import { pathForScreen, type TutorialRouteContext } from './tutorialScreens';
import type { TutorialMissionId, TutorialStateV3 } from './tutorialTypes';
import { CAMPAIGN_PREPARE, CAMPAIGN_WORKOUT } from './missions/campaign';
import { HOME_BODY, HOME_WEIGHT } from './missions/home';
import { ANNOUNCER_TUNE, NOTIFICATION_TUNE } from './missions/settings';
import {
  BACKUP_EXPORT,
  BACKUP_RESTORE,
  RECOVER,
  ROUTINE_CREATE,
  ROUTINE_EXERCISE,
  ROUTINE_START,
  ROUTINE_TARGETS,
  WORKOUT_FINISH,
  WORKOUT_INPUT,
  WORKOUT_REST,
  WORKOUT_VALIDATE,
} from './missions/core';
import { ANALYTICS_READ, ANALYTICS_SHARE } from './missions/analytics';
import { EXERCISE_CREATE, EXERCISE_FIND } from './missions/exercises';
import { HEVY_IMPORT, HISTORY_EDIT, HISTORY_FIND, HISTORY_SHARE } from './missions/history';
import { KNOWLEDGE_LEARNING_PATH, KNOWLEDGE_SEARCH } from './missions/knowledge';
import { PROGRAM } from './missions/program';

/*
 * Le registre, et rien que lui.
 *
 * Les missions elles-mêmes vivent dans `missions/` : la campagne, le chapitre
 * Programmes, et celles qui répondent à une page. Ce fichier reste la porte
 * d'entrée — il dit quelles missions existent et comment les interroger — parce
 * qu'une dizaine d'appelants la connaissent déjà sous ce nom.
 */
export { isMissionAvailable } from './missions/kit';
export type { TutorialMission, TutorialMissionFacts, TutorialMissionStep } from './missions/kit';
export { CAMPAIGN_EXERCISE_SLUG } from './missions/campaign';

import {
  isMissionAvailable,
  type TutorialMission,
  type TutorialMissionFacts,
  type TutorialMissionStep,
} from './missions/kit';
export const P1_MISSIONS: readonly TutorialMission[] = [
  CAMPAIGN_PREPARE,
  CAMPAIGN_WORKOUT,
  PROGRAM,
  HISTORY_FIND,
  HISTORY_EDIT,
  HISTORY_SHARE,
  HEVY_IMPORT,
  EXERCISE_FIND,
  EXERCISE_CREATE,
  ANALYTICS_READ,
  ANALYTICS_SHARE,
  KNOWLEDGE_SEARCH,
  KNOWLEDGE_LEARNING_PATH,
  HOME_BODY,
  HOME_WEIGHT,
  ANNOUNCER_TUNE,
  NOTIFICATION_TUNE,
  RECOVER,
  ROUTINE_CREATE,
  ROUTINE_EXERCISE,
  ROUTINE_TARGETS,
  ROUTINE_START,
  WORKOUT_INPUT,
  WORKOUT_VALIDATE,
  WORKOUT_REST,
  WORKOUT_FINISH,
  BACKUP_EXPORT,
  BACKUP_RESTORE,
];

export function missionFor(id: TutorialMissionId): TutorialMission {
  const mission = P1_MISSIONS.find((candidate) => candidate.id === id);
  if (mission === undefined) throw new Error(`Unknown tutorial mission: ${id}`);
  return mission;
}

/**
 * L'étape en cours, ou `null` quand la mission est finie ou absente.
 *
 * L'index vit dans l'état et le catalogue peut changer entre deux versions :
 * la lecture est donc faite ici, une fois, plutôt que ré-indexée sur place par
 * chaque appelant.
 */
export function stepOf(
  mission: TutorialMission | null,
  stepIndex: number,
): TutorialMissionStep | null {
  return mission?.steps[stepIndex] ?? null;
}

/**
 * Peut-on seulement jouer cette mission depuis ici ?
 *
 * L'aide de la page proposait « Ajouter un exercice » depuis la **liste** des
 * routines : la mission démarrait, le coach parlait, et sa cible vivait dans un
 * éditeur qu'aucune routine retenue ne permettait d'ouvrir. Une mission dont on
 * ne sait pas rejoindre la première étape n'est pas proposée du tout.
 */
export function isMissionReachable(
  mission: TutorialMission,
  context: TutorialRouteContext,
): boolean {
  const first = mission.steps[0];
  if (first === undefined) return false;
  return first.screen === 'anywhere' || pathForScreen(first.screen, context) !== null;
}

/** Ce que la progression sait des adresses dynamiques, sous la forme attendue. */
export function routeContextOf(state: TutorialStateV3): TutorialRouteContext {
  return {
    routineId: state.missionRoutineId,
    programId: state.missionProgramId,
    workoutId: state.missionWorkoutId,
  };
}

/**
 * Cette adresse appartient-elle à la zone de la mission ?
 *
 * Deux défauts que `startsWith` seul laissait passer. `/` est un préfixe de
 * **toutes** les adresses : les missions de l'Accueil se proposaient sur
 * l'Historique, les Réglages, partout, et l'aide d'une page finissait par
 * offrir des consignes qui parlent d'un autre écran. Et dans l'autre sens,
 * `/history` attrapait une hypothétique `/historyx` — une zone est une
 * adresse ou ce qui est dessous, pas ce qui commence par les mêmes lettres.
 */
function routeHolds(routePrefix: string, pathname: string): boolean {
  if (routePrefix === '/') return pathname === '/';
  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

export function contextualMissionsForPath(
  pathname: string,
  state: TutorialStateV3,
  facts: TutorialMissionFacts,
): readonly TutorialMission[] {
  const context = routeContextOf(state);
  return P1_MISSIONS.filter(
    (mission) =>
      mission.id !== 'TUT-CAM-01' &&
      mission.id !== 'TUT-CAM-02' &&
      mission.id !== 'TUT-REC-01' &&
      routeHolds(mission.routePrefix, pathname) &&
      isMissionAvailable(mission, facts) &&
      state.missions[mission.id] !== 'completed' &&
      isMissionReachable(mission, context),
  );
}
