import { TUTORIAL_MISSION_IDS, type TutorialStateV2 } from './tutorialTypes';

export const LEGACY_TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v1';
export const TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v2';

export function createTutorialState(): TutorialStateV2 {
  return {
    version: 2,
    scriptVersion: 1,
    orientation: null,
    activationPath: null,
    activeMissionId: null,
    activeStepIndex: 0,
    missionRoutineId: null,
    missions: {},
  };
}

function isTutorialState(value: unknown): value is TutorialStateV2 {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<TutorialStateV2>;
  if (
    typeof state.missions !== 'object' ||
    state.missions === null ||
    Array.isArray(state.missions)
  ) {
    return false;
  }
  const missionEntries = Object.entries(state.missions);
  return (
    state.version === 2 &&
    state.scriptVersion === 1 &&
    (state.orientation === null ||
      state.orientation === 'completed' ||
      state.orientation === 'skipped') &&
    (state.activationPath === null ||
      state.activationPath === 'template' ||
      state.activationPath === 'blank') &&
    (state.activeMissionId === null ||
      TUTORIAL_MISSION_IDS.includes(
        state.activeMissionId as (typeof TUTORIAL_MISSION_IDS)[number],
      )) &&
    typeof state.activeStepIndex === 'number' &&
    Number.isInteger(state.activeStepIndex) &&
    state.activeStepIndex >= 0 &&
    // Absente des états écrits avant qu'elle existe : `loadTutorialState` la
    // complète, plutôt que de jeter une progression entière pour un champ ajouté.
    (state.missionRoutineId === undefined ||
      state.missionRoutineId === null ||
      typeof state.missionRoutineId === 'string') &&
    missionEntries.every(
      ([missionId, status]) =>
        TUTORIAL_MISSION_IDS.includes(missionId as (typeof TUTORIAL_MISSION_IDS)[number]) &&
        (status === 'completed' || status === 'dismissed'),
    )
  );
}

export function loadTutorialState(): TutorialStateV2 {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isTutorialState(parsed)) return { ...createTutorialState(), ...parsed };
    }
  } catch {
    return createTutorialState();
  }

  const legacy = localStorage.getItem(LEGACY_TUTORIAL_STORAGE_KEY);
  const state = createTutorialState();
  if (legacy === 'completed' || legacy === 'skipped') state.orientation = 'completed';
  return state;
}

export function saveTutorialState(state: TutorialStateV2): void {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
}
