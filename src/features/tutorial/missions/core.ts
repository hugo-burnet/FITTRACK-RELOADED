import { eventIs, onEvent, positiveRest, recordableSet, type TutorialMission } from './kit';

export const RECOVER: TutorialMission = {
  id: 'TUT-REC-01',
  routePrefix: '/',
  titleKey: 'tutorial.mission.recovery.title',
  guard: 'external',
  steps: [
    {
      id: 'recover',
      screen: 'anywhere',
      reach: 'navigate',
      targetId: 'active-workout-bar',
      instructionKey: 'tutorial.mission.recovery.instruction',
      clipId: 'mission-recovery-1',
      detailKey: 'tutorial.mission.recovery.detail',
      advance: onEvent(eventIs('stale-workout-choice')),
    },
  ],
  nextMissionId: null,
};

export const ROUTINE_CREATE: TutorialMission = {
  id: 'TUT-ROU-01',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineCreate.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'create',
      screen: 'routines',
      reach: 'navigate',
      targetId: 'routine-create',
      instructionKey: 'tutorial.mission.routineCreate.instruction',
      clipId: 'mission-routine-create-1',
      detailKey: 'tutorial.mission.routineCreate.detail',
      advance: onEvent(eventIs('routine-created')),
    },
  ],
  nextMissionId: 'TUT-ROU-02',
};

export const ROUTINE_EXERCISE: TutorialMission = {
  id: 'TUT-ROU-02',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineExercise.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'add-exercise',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-add-exercise',
      instructionKey: 'tutorial.mission.routineExercise.instruction',
      clipId: 'mission-routine-exercise-1',
      detailKey: 'tutorial.mission.routineExercise.detail',
      advance: onEvent(
        (event) => event.type === 'routine-exercise-added' && event.exerciseSlugs.length > 0,
      ),
    },
    {
      id: 'add-set',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-add-set',
      instructionKey: 'tutorial.mission.routineSet.instruction',
      clipId: 'mission-routine-set-1',
      detailKey: 'tutorial.mission.routineSet.detail',
      advance: onEvent(eventIs('routine-set-added')),
    },
  ],
  nextMissionId: 'TUT-ROU-03',
};

export const ROUTINE_TARGETS: TutorialMission = {
  id: 'TUT-ROU-03',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineTargets.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'set-target',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-first-set',
      instructionKey: 'tutorial.mission.routineTargets.instruction',
      clipId: 'mission-routine-targets-1',
      detailKey: 'tutorial.mission.routineTargets.detail',
      advance: onEvent(eventIs('routine-target-updated')),
    },
    {
      id: 'set-rest',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-exercise-menu',
      instructionKey: 'tutorial.mission.routineRest.instruction',
      clipId: 'mission-routine-rest-1',
      detailKey: 'tutorial.mission.routineRest.detail',
      advance: onEvent(positiveRest),
    },
  ],
  nextMissionId: 'TUT-ROU-04',
};

export const ROUTINE_START: TutorialMission = {
  id: 'TUT-ROU-04',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineStart.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'start',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-start',
      instructionKey: 'tutorial.mission.routineStart.instruction',
      clipId: 'mission-routine-start-1',
      detailKey: 'tutorial.mission.routineStart.detail',
      advance: onEvent(eventIs('workout-started')),
    },
  ],
  nextMissionId: 'TUT-WRK-01',
};

export const WORKOUT_INPUT: TutorialMission = {
  id: 'TUT-WRK-01',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setInput.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'write',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set',
      instructionKey: 'tutorial.mission.setInput.instruction',
      clipId: 'mission-set-input-1',
      detailKey: 'tutorial.mission.setInput.detail',
      advance: onEvent(recordableSet),
    },
  ],
  nextMissionId: 'TUT-WRK-02',
};

export const WORKOUT_VALIDATE: TutorialMission = {
  id: 'TUT-WRK-02',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setValidate.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'complete',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set-complete',
      instructionKey: 'tutorial.mission.setValidate.instruction',
      clipId: 'mission-set-validate-1',
      detailKey: 'tutorial.mission.setValidate.detail',
      advance: onEvent(eventIs('workout-set-completed')),
    },
  ],
  nextMissionId: 'TUT-WRK-03',
};

export const WORKOUT_REST: TutorialMission = {
  id: 'TUT-WRK-03',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.rest.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'rest',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-rest',
      instructionKey: 'tutorial.mission.rest.instruction',
      clipId: 'mission-rest-1',
      detailKey: 'tutorial.mission.rest.detail',
      advance: onEvent(eventIs('rest-finished')),
    },
  ],
  nextMissionId: 'TUT-WRK-04',
};

export const WORKOUT_FINISH: TutorialMission = {
  id: 'TUT-WRK-04',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.workoutFinish.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-finish',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-finish',
      instructionKey: 'tutorial.mission.workoutFinish.instruction',
      clipId: 'mission-workout-finish-1',
      detailKey: 'tutorial.mission.workoutFinish.detail',
      advance: onEvent(eventIs('workout-finish-opened')),
    },
    {
      id: 'save',
      screen: 'workout-finish',
      reach: 'wait',
      targetId: 'workout-save',
      instructionKey: 'tutorial.mission.workoutSave.instruction',
      clipId: 'mission-workout-save-1',
      detailKey: 'tutorial.mission.workoutSave.detail',
      advance: onEvent(eventIs('workout-saved')),
    },
  ],
  nextMissionId: 'TUT-DAT-01',
};

export const BACKUP_EXPORT: TutorialMission = {
  id: 'TUT-DAT-01',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupExport.title',
  guard: 'always',
  steps: [
    {
      id: 'export',
      screen: 'settings',
      reach: 'wait',
      targetId: 'backup-export',
      instructionKey: 'tutorial.mission.backupExport.instruction',
      clipId: 'mission-backup-export-1',
      detailKey: 'tutorial.mission.backupExport.detail',
      advance: onEvent(eventIs('backup-exported')),
    },
  ],
  nextMissionId: 'TUT-DAT-02',
};

export const BACKUP_RESTORE: TutorialMission = {
  id: 'TUT-DAT-02',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupRestore.title',
  guard: 'always',
  steps: [
    {
      id: 'restore',
      screen: 'settings',
      reach: 'wait',
      targetId: 'backup-restore',
      instructionKey: 'tutorial.mission.backupRestore.instruction',
      clipId: 'mission-backup-restore-1',
      detailKey: 'tutorial.mission.backupRestore.detail',
      advance: onEvent(eventIs('restore-confirmation-opened')),
    },
  ],
  nextMissionId: null,
};
