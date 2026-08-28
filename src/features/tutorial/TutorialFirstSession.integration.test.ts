import { beforeEach, describe, expect, it } from 'vitest';
import {
  advanceMission,
  continueMission,
  resumeCampaignForWorkout,
  startCampaign,
  startMission,
} from './tutorialMissionMachine';
import { createTutorialState, loadTutorialState, saveTutorialState } from './tutorialStore';
import type { TutorialStateV3 } from './tutorialTypes';

/** Les onze gestes de l'acte 1, sur la routine que l'étape 2 vient de créer. */
function prepareDiscoveryRoutine(routineId: string): TutorialStateV3 {
  let state = startCampaign(createTutorialState());
  state = advanceMission(state, { type: 'routine-create-opened' });
  state = advanceMission(state, { type: 'routine-created', routineId });
  state = advanceMission(state, { type: 'routine-renamed', routineId, name: 'Séance découverte' });
  state = advanceMission(state, { type: 'routine-picker-opened', routineId });
  state = advanceMission(state, {
    type: 'routine-exercise-query-changed',
    routineId,
    query: 'curl',
  });
  state = advanceMission(state, {
    type: 'routine-exercise-selected',
    routineId,
    exerciseSlug: 'dumbbell-curl',
  });
  state = advanceMission(state, {
    type: 'routine-exercise-added',
    routineId,
    exerciseSlugs: ['dumbbell-curl'],
  });
  state = advanceMission(state, { type: 'routine-set-added', routineId, setId: 's2', count: 2 });
  state = advanceMission(state, { type: 'routine-target-updated', routineId, setId: 's1' });
  state = advanceMission(state, { type: 'routine-rest-updated', routineId, seconds: 60 });
  return continueMission(state);
}

describe('campagne découverte', () => {
  beforeEach(() => localStorage.clear());

  it('prépare Curl haltères puis attend le vrai démarrage de cette routine', () => {
    const ready = prepareDiscoveryRoutine('r1');

    expect(ready).toMatchObject({
      campaign: 'routine-ready',
      activeMissionId: null,
      campaignRoutineId: 'r1',
      missions: { 'TUT-CAM-01': 'completed' },
    });
  });

  /*
   * L'identité n'est pas un détail de plomberie : sans elle, préparer une autre
   * routine dans un autre onglet ferait avancer la découverte, et une séance
   * lancée sur n'importe quoi la relancerait.
   */
  it('ignore les gestes faits sur une autre routine', () => {
    let state = startCampaign(createTutorialState());
    state = advanceMission(state, { type: 'routine-create-opened' });
    state = advanceMission(state, { type: 'routine-created', routineId: 'r1' });
    const named = advanceMission(state, {
      type: 'routine-renamed',
      routineId: 'autre',
      name: 'Autre chose',
    });

    expect(named).toBe(state);
  });

  it('n’accepte que le curl haltères, et pas un autre curl', () => {
    let state = prepareUpToSelection('r1');
    const wrongExercise = advanceMission(state, {
      type: 'routine-exercise-selected',
      routineId: 'r1',
      exerciseSlug: 'barbell-curl',
    });
    expect(wrongExercise).toBe(state);

    state = advanceMission(state, {
      type: 'routine-exercise-selected',
      routineId: 'r1',
      exerciseSlug: 'dumbbell-curl',
    });
    expect(state.activeStepIndex).toBe(6);
  });

  it('ne reprend pas sur une séance qui n’est pas la sienne', () => {
    const ready = prepareDiscoveryRoutine('r1');

    expect(resumeCampaignForWorkout(ready, { workoutId: 'w-autre', routineId: 'autre' })).toBe(
      ready,
    );
    expect(resumeCampaignForWorkout(ready, { workoutId: 'w-libre' })).toBe(ready);
  });

  it('reprend l’acte 2 quand la routine découverte est réellement démarrée', () => {
    const ready = prepareDiscoveryRoutine('r1');

    expect(resumeCampaignForWorkout(ready, { workoutId: 'w1', routineId: 'r1' })).toMatchObject({
      campaign: 'workout-active',
      activeMissionId: 'TUT-CAM-02',
      activeStepIndex: 0,
    });
  });

  it('termine la campagne sur le bilan, sans rien enregistrer d’autre', () => {
    let state = resumeCampaignForWorkout(prepareDiscoveryRoutine('r1'), {
      workoutId: 'w1',
      routineId: 'r1',
    });
    state = advanceMission(state, {
      type: 'workout-set-written',
      workoutId: 'w1',
      setId: 's1',
      recordable: true,
    });
    state = advanceMission(state, {
      type: 'workout-set-completed',
      workoutId: 'w1',
      setId: 's1',
    });
    state = advanceMission(state, { type: 'rest-finished', setId: 's1' });
    state = advanceMission(state, {
      type: 'workout-set-completed',
      workoutId: 'w1',
      setId: 's2',
    });
    state = advanceMission(state, { type: 'workout-finish-opened', workoutId: 'w1' });
    state = advanceMission(state, { type: 'workout-saved', workoutId: 'w1' });
    state = continueMission(state);

    expect(state).toMatchObject({
      campaign: 'completed',
      activeMissionId: null,
      missions: { 'TUT-CAM-01': 'completed', 'TUT-CAM-02': 'completed' },
    });
  });

  it('reprend une campagne en attente après un rechargement', () => {
    saveTutorialState(prepareDiscoveryRoutine('r1'));

    expect(loadTutorialState()).toMatchObject({
      campaign: 'routine-ready',
      campaignRoutineId: 'r1',
      activeMissionId: null,
    });
  });
});

/** L'acte 1 jusqu'à l'étape qui attend le choix de l'exercice. */
function prepareUpToSelection(routineId: string): TutorialStateV3 {
  let state = startCampaign(createTutorialState());
  state = advanceMission(state, { type: 'routine-create-opened' });
  state = advanceMission(state, { type: 'routine-created', routineId });
  state = advanceMission(state, { type: 'routine-renamed', routineId, name: 'Découverte' });
  state = advanceMission(state, { type: 'routine-picker-opened', routineId });
  return advanceMission(state, {
    type: 'routine-exercise-query-changed',
    routineId,
    query: 'Curl',
  });
}

describe('missions guidées hors campagne', () => {
  beforeEach(() => localStorage.clear());

  it('reaches data safety only through observed user outcomes', () => {
    let state = startMission(createTutorialState(), 'TUT-ROU-01');
    state = advanceMission(state, { type: 'routine-created', routineId: 'routine-1' });
    state = advanceMission(state, {
      type: 'routine-exercise-added',
      routineId: 'routine-1',
      exerciseSlugs: ['dumbbell-curl'],
    });
    state = advanceMission(state, {
      type: 'routine-set-added',
      routineId: 'routine-1',
      setId: 'planned-set-2',
      count: 2,
    });
    state = advanceMission(state, {
      type: 'routine-target-updated',
      routineId: 'routine-1',
      setId: 'planned-set-1',
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
      workoutId: 'workout-1',
      setId: 'set-1',
      recordable: true,
    });
    state = advanceMission(state, {
      type: 'workout-set-completed',
      workoutId: 'workout-1',
      setId: 'set-1',
    });
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
      setId: 'set-1',
    });

    saveTutorialState(targeted);

    expect(loadTutorialState()).toMatchObject({
      activeMissionId: 'TUT-ROU-03',
      activeStepIndex: 1,
    });
  });
});
