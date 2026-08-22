import { beforeEach, describe, expect, it } from 'vitest';
import { advanceMission, startMission } from './tutorialMissionMachine';
import { createTutorialState, loadTutorialState, saveTutorialState } from './tutorialStore';

describe('first-session tutorial flow', () => {
  beforeEach(() => localStorage.clear());

  it('reaches data safety only through observed user outcomes', () => {
    let state = startMission(createTutorialState(), 'TUT-ROU-01');
    state = advanceMission(state, { type: 'routine-created', routineId: 'routine-1' });
    state = advanceMission(state, {
      type: 'routine-exercise-added',
      routineId: 'routine-1',
      count: 1,
    });
    state = advanceMission(state, {
      type: 'routine-set-added',
      routineId: 'routine-1',
      setId: 'planned-set-2',
    });
    state = advanceMission(state, {
      type: 'routine-target-updated',
      routineId: 'routine-1',
    });
    state = advanceMission(state, {
      type: 'routine-rest-updated',
      routineId: 'routine-1',
      seconds: 90,
    });
    state = advanceMission(state, {
      type: 'workout-started',
      workoutId: 'workout-1',
      routineId: 'routine-1',
    });
    state = advanceMission(state, {
      type: 'workout-set-written',
      setId: 'set-1',
      recordable: true,
    });
    state = advanceMission(state, { type: 'workout-set-completed', setId: 'set-1' });
    state = advanceMission(state, { type: 'rest-finished', setId: 'set-1' });
    state = advanceMission(state, {
      type: 'workout-finish-opened',
      workoutId: 'workout-1',
    });
    state = advanceMission(state, { type: 'workout-saved', workoutId: 'workout-1' });
    state = advanceMission(state, { type: 'backup-exported', outcome: 'downloaded' });
    state = advanceMission(state, { type: 'restore-confirmation-opened' });

    expect(state.activeMissionId).toBeNull();
    expect(state.missions).toMatchObject({
      'TUT-ROU-01': 'completed',
      'TUT-ROU-02': 'completed',
      'TUT-ROU-03': 'completed',
      'TUT-ROU-04': 'completed',
      'TUT-WRK-01': 'completed',
      'TUT-WRK-02': 'completed',
      'TUT-WRK-03': 'completed',
      'TUT-WRK-04': 'completed',
      'TUT-DAT-01': 'completed',
      'TUT-DAT-02': 'completed',
    });
  });

  it('resumes the second step of a mission after a reload', () => {
    const started = startMission(createTutorialState(), 'TUT-ROU-03');
    const targeted = advanceMission(started, {
      type: 'routine-target-updated',
      routineId: 'routine-1',
    });

    saveTutorialState(targeted);

    expect(loadTutorialState()).toMatchObject({
      activeMissionId: 'TUT-ROU-03',
      activeStepIndex: 1,
    });
  });
});
