import type { TranslationKey } from '@/i18n/fr';
import type { TutorialEvent, TutorialMissionId, TutorialStateV2 } from './tutorialTypes';

export interface TutorialMissionStep {
  id: string;
  targetId: string;
  instructionKey: TranslationKey;
  detailKey: TranslationKey;
  clipId?: string;
  advanceWhen: (event: TutorialEvent) => boolean;
}

export interface TutorialMission {
  id: TutorialMissionId;
  routePrefix: '/routines' | '/workout' | '/settings' | '/';
  titleKey: TranslationKey;
  guard: 'always' | 'requires-active-workout' | 'requires-no-active-workout' | 'external';
  steps: readonly TutorialMissionStep[];
  nextMissionId: TutorialMissionId | null;
}

export interface TutorialMissionFacts {
  hasActiveWorkout: boolean | null;
}

const eventIs =
  <T extends TutorialEvent['type']>(type: T) =>
  (event: TutorialEvent): boolean =>
    event.type === type;

const positiveRest = (event: TutorialEvent): boolean =>
  event.type === 'routine-rest-updated' && event.seconds > 0;

const recordableSet = (event: TutorialEvent): boolean =>
  event.type === 'workout-set-written' && event.recordable;

export function isMissionAvailable(mission: TutorialMission, facts: TutorialMissionFacts): boolean {
  if (mission.guard === 'requires-active-workout') return facts.hasActiveWorkout === true;
  if (mission.guard === 'requires-no-active-workout') return facts.hasActiveWorkout === false;
  return mission.guard === 'always';
}

const ACTIVATE: TutorialMission = {
  id: 'TUT-ACT-01',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.activation.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'pick-template',
      targetId: 'routine-create',
      instructionKey: 'tutorial.mission.activation.instruction',
      clipId: 'mission-activation-1',
      detailKey: 'tutorial.mission.activation.detail',
      advanceWhen: eventIs('routine-opened'),
    },
  ],
  nextMissionId: 'TUT-ROU-02',
};

const RECOVER: TutorialMission = {
  id: 'TUT-REC-01',
  routePrefix: '/',
  titleKey: 'tutorial.mission.recovery.title',
  guard: 'external',
  steps: [
    {
      id: 'recover',
      targetId: 'active-workout-bar',
      instructionKey: 'tutorial.mission.recovery.instruction',
      clipId: 'mission-recovery-1',
      detailKey: 'tutorial.mission.recovery.detail',
      advanceWhen: eventIs('stale-workout-choice'),
    },
  ],
  nextMissionId: null,
};

const ROUTINE_CREATE: TutorialMission = {
  id: 'TUT-ROU-01',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineCreate.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'create',
      targetId: 'routine-create',
      instructionKey: 'tutorial.mission.routineCreate.instruction',
      clipId: 'mission-routine-create-1',
      detailKey: 'tutorial.mission.routineCreate.detail',
      advanceWhen: eventIs('routine-created'),
    },
  ],
  nextMissionId: 'TUT-ROU-02',
};

const ROUTINE_EXERCISE: TutorialMission = {
  id: 'TUT-ROU-02',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineExercise.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'add-exercise',
      targetId: 'routine-add-exercise',
      instructionKey: 'tutorial.mission.routineExercise.instruction',
      clipId: 'mission-routine-exercise-1',
      detailKey: 'tutorial.mission.routineExercise.detail',
      advanceWhen: (event) => event.type === 'routine-exercise-added' && event.count > 0,
    },
    {
      id: 'add-set',
      targetId: 'routine-add-set',
      instructionKey: 'tutorial.mission.routineSet.instruction',
      clipId: 'mission-routine-set-1',
      detailKey: 'tutorial.mission.routineSet.detail',
      advanceWhen: eventIs('routine-set-added'),
    },
  ],
  nextMissionId: 'TUT-ROU-03',
};

const ROUTINE_TARGETS: TutorialMission = {
  id: 'TUT-ROU-03',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineTargets.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'set-target',
      targetId: 'routine-first-set',
      instructionKey: 'tutorial.mission.routineTargets.instruction',
      clipId: 'mission-routine-targets-1',
      detailKey: 'tutorial.mission.routineTargets.detail',
      advanceWhen: eventIs('routine-target-updated'),
    },
    {
      id: 'set-rest',
      targetId: 'routine-exercise-menu',
      instructionKey: 'tutorial.mission.routineRest.instruction',
      clipId: 'mission-routine-rest-1',
      detailKey: 'tutorial.mission.routineRest.detail',
      advanceWhen: positiveRest,
    },
  ],
  nextMissionId: 'TUT-ROU-04',
};

const ROUTINE_START: TutorialMission = {
  id: 'TUT-ROU-04',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineStart.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'start',
      targetId: 'routine-start',
      instructionKey: 'tutorial.mission.routineStart.instruction',
      clipId: 'mission-routine-start-1',
      detailKey: 'tutorial.mission.routineStart.detail',
      advanceWhen: eventIs('workout-started'),
    },
  ],
  nextMissionId: 'TUT-WRK-01',
};

const WORKOUT_INPUT: TutorialMission = {
  id: 'TUT-WRK-01',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setInput.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'write',
      targetId: 'workout-first-set',
      instructionKey: 'tutorial.mission.setInput.instruction',
      clipId: 'mission-set-input-1',
      detailKey: 'tutorial.mission.setInput.detail',
      advanceWhen: recordableSet,
    },
  ],
  nextMissionId: 'TUT-WRK-02',
};

const WORKOUT_VALIDATE: TutorialMission = {
  id: 'TUT-WRK-02',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setValidate.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'complete',
      targetId: 'workout-first-set-complete',
      instructionKey: 'tutorial.mission.setValidate.instruction',
      clipId: 'mission-set-validate-1',
      detailKey: 'tutorial.mission.setValidate.detail',
      advanceWhen: eventIs('workout-set-completed'),
    },
  ],
  nextMissionId: 'TUT-WRK-03',
};

const WORKOUT_REST: TutorialMission = {
  id: 'TUT-WRK-03',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.rest.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'rest',
      targetId: 'workout-rest',
      instructionKey: 'tutorial.mission.rest.instruction',
      clipId: 'mission-rest-1',
      detailKey: 'tutorial.mission.rest.detail',
      advanceWhen: eventIs('rest-finished'),
    },
  ],
  nextMissionId: 'TUT-WRK-04',
};

const WORKOUT_FINISH: TutorialMission = {
  id: 'TUT-WRK-04',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.workoutFinish.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-finish',
      targetId: 'workout-finish',
      instructionKey: 'tutorial.mission.workoutFinish.instruction',
      clipId: 'mission-workout-finish-1',
      detailKey: 'tutorial.mission.workoutFinish.detail',
      advanceWhen: eventIs('workout-finish-opened'),
    },
    {
      id: 'save',
      targetId: 'workout-save',
      instructionKey: 'tutorial.mission.workoutSave.instruction',
      clipId: 'mission-workout-save-1',
      detailKey: 'tutorial.mission.workoutSave.detail',
      advanceWhen: eventIs('workout-saved'),
    },
  ],
  nextMissionId: 'TUT-DAT-01',
};

const BACKUP_EXPORT: TutorialMission = {
  id: 'TUT-DAT-01',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupExport.title',
  guard: 'always',
  steps: [
    {
      id: 'export',
      targetId: 'backup-export',
      instructionKey: 'tutorial.mission.backupExport.instruction',
      clipId: 'mission-backup-export-1',
      detailKey: 'tutorial.mission.backupExport.detail',
      advanceWhen: eventIs('backup-exported'),
    },
  ],
  nextMissionId: 'TUT-DAT-02',
};

const BACKUP_RESTORE: TutorialMission = {
  id: 'TUT-DAT-02',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupRestore.title',
  guard: 'always',
  steps: [
    {
      id: 'restore',
      targetId: 'backup-restore',
      instructionKey: 'tutorial.mission.backupRestore.instruction',
      clipId: 'mission-backup-restore-1',
      detailKey: 'tutorial.mission.backupRestore.detail',
      advanceWhen: eventIs('restore-confirmation-opened'),
    },
  ],
  nextMissionId: null,
};

export const P1_MISSIONS: readonly TutorialMission[] = [
  ACTIVATE,
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

export function contextualMissionsForPath(
  pathname: string,
  state: TutorialStateV2,
  facts: TutorialMissionFacts,
): readonly TutorialMission[] {
  return P1_MISSIONS.filter(
    (mission) =>
      mission.id !== 'TUT-ACT-01' &&
      mission.id !== 'TUT-REC-01' &&
      pathname.startsWith(mission.routePrefix) &&
      isMissionAvailable(mission, facts) &&
      state.missions[mission.id] !== 'completed',
  );
}
