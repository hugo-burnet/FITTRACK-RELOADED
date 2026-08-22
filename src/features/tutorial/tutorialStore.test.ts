import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_TUTORIAL_STORAGE_KEY,
  TUTORIAL_STORAGE_KEY,
  createTutorialState,
  loadTutorialState,
  saveTutorialState,
} from './tutorialStore';

describe('tutorialStore v2', () => {
  beforeEach(() => localStorage.clear());

  it('starts with an untouched v2 state', () => {
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('migrates a completed v1 orientation without inventing mission progress', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'completed');
    expect(loadTutorialState()).toEqual({
      version: 2,
      scriptVersion: 1,
      orientation: 'completed',
      activationPath: null,
      activeMissionId: null,
      activeStepIndex: 0,
      missionRoutineId: null,
      missions: {},
    });
  });

  it('complète une progression écrite avant que la routine de mission existe', () => {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        scriptVersion: 1,
        orientation: 'completed',
        activationPath: 'blank',
        activeMissionId: 'TUT-ROU-03',
        activeStepIndex: 1,
        missions: { 'TUT-ROU-02': 'completed' },
      }),
    );

    // La progression est conservée telle quelle ; seul le champ ajouté est
    // complété. Jeter l'état entier ferait recommencer une mission en cours
    // pour cause de mise à jour de l'application.
    expect(loadTutorialState()).toEqual({
      version: 2,
      scriptVersion: 1,
      orientation: 'completed',
      activationPath: 'blank',
      activeMissionId: 'TUT-ROU-03',
      activeStepIndex: 1,
      missionRoutineId: null,
      missions: { 'TUT-ROU-02': 'completed' },
    });
  });

  it('treats a skipped v1 visit as an already-seen orientation', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'skipped');
    expect(loadTutorialState().orientation).toBe('completed');
  });

  it('round-trips an active mission and its exact step', () => {
    const state = {
      ...createTutorialState(),
      orientation: 'skipped' as const,
      activationPath: 'blank' as const,
      activeMissionId: 'TUT-ROU-03' as const,
      activeStepIndex: 1,
      missions: { 'TUT-ROU-01': 'completed' as const },
    };
    saveTutorialState(state);
    expect(loadTutorialState()).toEqual(state);
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toContain('TUT-ROU-03');
  });

  it('ignores malformed or future state', () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '{broken');
    expect(loadTutorialState()).toEqual(createTutorialState());
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('ignores a v2 state whose missions value is an array', () => {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({ ...createTutorialState(), missions: [] }),
    );
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('ignores a v2 state containing an unknown mission key', () => {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        ...createTutorialState(),
        missions: { 'TUT-UNKNOWN': 'completed' },
      }),
    );
    expect(loadTutorialState()).toEqual(createTutorialState());
  });
});
