import {
  TUTORIAL_MISSION_IDS,
  type TutorialCampaignStatus,
  type TutorialMissionId,
  type TutorialMissionStatus,
  type TutorialStateV3,
} from './tutorialTypes';

export const LEGACY_TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v1';
export const LEGACY_TUTORIAL_V2_STORAGE_KEY = 'fittrack:tutorial:v2';
export const TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v3';

const CAMPAIGN_STATUSES: readonly TutorialCampaignStatus[] = [
  'not-started',
  'preparing',
  'routine-ready',
  'workout-active',
  'completed',
  'dismissed',
];

export function createTutorialState(): TutorialStateV3 {
  return {
    version: 3,
    scriptVersion: 2,
    orientation: null,
    campaign: 'not-started',
    activeMissionId: null,
    activeStepIndex: 0,
    campaignRoutineId: null,
    missionRoutineId: null,
    missionProgramId: null,
    missionWorkoutId: null,
    missions: {},
  };
}

function isMissionId(value: unknown): value is TutorialMissionId {
  return TUTORIAL_MISSION_IDS.includes(value as TutorialMissionId);
}

function isMissionStatus(value: unknown): value is TutorialMissionStatus {
  return value === 'completed' || value === 'dismissed';
}

function isOptionalId(value: unknown): boolean {
  // Absent des états écrits avant que le champ existe : `loadTutorialState` le
  // complète, plutôt que de jeter une progression entière pour un ajout.
  return value === undefined || value === null || typeof value === 'string';
}

function isTutorialState(value: unknown): value is TutorialStateV3 {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<TutorialStateV3>;
  if (
    typeof state.missions !== 'object' ||
    state.missions === null ||
    Array.isArray(state.missions)
  ) {
    return false;
  }
  return (
    state.version === 3 &&
    state.scriptVersion === 2 &&
    (state.orientation === null ||
      state.orientation === 'completed' ||
      state.orientation === 'skipped') &&
    (state.campaign === undefined ||
      CAMPAIGN_STATUSES.includes(state.campaign as TutorialCampaignStatus)) &&
    (state.activeMissionId === null || isMissionId(state.activeMissionId)) &&
    typeof state.activeStepIndex === 'number' &&
    Number.isInteger(state.activeStepIndex) &&
    state.activeStepIndex >= 0 &&
    isOptionalId(state.campaignRoutineId) &&
    isOptionalId(state.missionRoutineId) &&
    isOptionalId(state.missionProgramId) &&
    isOptionalId(state.missionWorkoutId) &&
    Object.entries(state.missions).every(
      ([missionId, status]) => isMissionId(missionId) && isMissionStatus(status),
    )
  );
}

/**
 * Une progression v2 relue avec les identifiants d'aujourd'hui.
 *
 * La v2 est validée plus mollement que la v3 : `TUT-ACT-01` a disparu du
 * catalogue, et refuser tout l'état pour cet identifiant retiré ferait
 * recommencer les dix missions qui, elles, existent encore. L'orientation est
 * conservée ; la campagne, elle, repart de zéro — l'ancienne visite passive
 * n'était pas cette campagne et n'a rien fait pratiquer.
 */
function migrateFromV2(raw: string): TutorialStateV3 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const legacy = parsed as Record<string, unknown>;
  if (legacy.version !== 2) return null;

  const state = createTutorialState();
  if (legacy.orientation === 'completed' || legacy.orientation === 'skipped') {
    state.orientation = legacy.orientation;
  }
  if (typeof legacy.missionRoutineId === 'string') state.missionRoutineId = legacy.missionRoutineId;
  if (isMissionId(legacy.activeMissionId)) {
    state.activeMissionId = legacy.activeMissionId;
    if (typeof legacy.activeStepIndex === 'number' && Number.isInteger(legacy.activeStepIndex)) {
      state.activeStepIndex = Math.max(0, legacy.activeStepIndex);
    }
  }
  const missions = legacy.missions;
  if (typeof missions === 'object' && missions !== null && !Array.isArray(missions)) {
    for (const [missionId, status] of Object.entries(missions)) {
      if (isMissionId(missionId) && isMissionStatus(status)) state.missions[missionId] = status;
    }
  }
  return state;
}

export function loadTutorialState(): TutorialStateV3 {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isTutorialState(parsed)) return { ...createTutorialState(), ...parsed };
      return createTutorialState();
    }
  } catch {
    return createTutorialState();
  }

  // Les anciennes clés ne sont ni réécrites ni supprimées ici : une lecture qui
  // écrit est une lecture qu'on ne peut plus faire deux fois sans conséquence,
  // et `TutorialProvider` en fait une pendant son rendu initial. La v3 s'écrit
  // au premier `saveTutorialState`, c'est-à-dire au premier vrai choix.
  const v2 = localStorage.getItem(LEGACY_TUTORIAL_V2_STORAGE_KEY);
  if (v2 !== null) {
    const migrated = migrateFromV2(v2);
    if (migrated !== null) return migrated;
  }

  const legacy = localStorage.getItem(LEGACY_TUTORIAL_STORAGE_KEY);
  const state = createTutorialState();
  if (legacy === 'completed' || legacy === 'skipped') state.orientation = 'completed';
  return state;
}

export function saveTutorialState(state: TutorialStateV3): void {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
}
