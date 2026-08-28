import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_TUTORIAL_STORAGE_KEY,
  LEGACY_TUTORIAL_V2_STORAGE_KEY,
  TUTORIAL_STORAGE_KEY,
  createTutorialState,
  loadTutorialState,
  saveTutorialState,
} from './tutorialStore';

describe('tutorialStore v3', () => {
  beforeEach(() => localStorage.clear());

  it('starts with an untouched v3 state', () => {
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('migrates a completed v1 orientation without inventing mission progress', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'completed');
    expect(loadTutorialState()).toEqual({
      ...createTutorialState(),
      orientation: 'completed',
    });
  });

  it('treats a skipped v1 visit as an already-seen orientation', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'skipped');
    expect(loadTutorialState().orientation).toBe('completed');
  });

  it('migre v2 sans prétendre que la campagne interactive a été faite', () => {
    localStorage.setItem(
      LEGACY_TUTORIAL_V2_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        scriptVersion: 1,
        orientation: 'completed',
        activationPath: 'blank',
        activeMissionId: null,
        activeStepIndex: 0,
        missionRoutineId: 'r-old',
        missions: { 'TUT-DAT-01': 'completed' },
      }),
    );

    expect(loadTutorialState()).toEqual({
      version: 3,
      scriptVersion: 2,
      orientation: 'completed',
      campaign: 'not-started',
      activeMissionId: null,
      activeStepIndex: 0,
      campaignRoutineId: null,
      missionRoutineId: 'r-old',
      missionProgramId: null,
      missionWorkoutId: null,
      missions: { 'TUT-DAT-01': 'completed' },
    });
  });

  /*
   * `TUT-ACT-01` n'existe plus : la campagne a repris son rôle. Une progression
   * v2 qui la contient n'est pas pour autant illisible — jeter l'état entier
   * pour un identifiant retiré ferait recommencer les dix autres missions.
   */
  it('oublie une mission v2 dont l’identifiant a disparu, sans jeter le reste', () => {
    localStorage.setItem(
      LEGACY_TUTORIAL_V2_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        scriptVersion: 1,
        orientation: 'completed',
        activationPath: 'template',
        activeMissionId: 'TUT-ACT-01',
        activeStepIndex: 0,
        missionRoutineId: null,
        missions: { 'TUT-ACT-01': 'completed', 'TUT-ROU-02': 'completed' },
      }),
    );

    expect(loadTutorialState()).toMatchObject({
      version: 3,
      activeMissionId: null,
      missions: { 'TUT-ROU-02': 'completed' },
    });
    expect(loadTutorialState().missions).not.toHaveProperty('TUT-ACT-01');
  });

  it('ne réécrit pas la clé v2 pendant une lecture', () => {
    const raw = JSON.stringify({
      version: 2,
      scriptVersion: 1,
      orientation: 'skipped',
      activationPath: null,
      activeMissionId: null,
      activeStepIndex: 0,
      missionRoutineId: null,
      missions: {},
    });
    localStorage.setItem(LEGACY_TUTORIAL_V2_STORAGE_KEY, raw);

    loadTutorialState();

    expect(localStorage.getItem(LEGACY_TUTORIAL_V2_STORAGE_KEY)).toBe(raw);
  });

  it('reprend une routine prête sans inventer de séance', () => {
    const state = {
      ...createTutorialState(),
      campaign: 'routine-ready' as const,
      campaignRoutineId: 'r-discovery',
    };
    saveTutorialState(state);
    expect(loadTutorialState()).toEqual(state);
  });

  it('round-trips an active mission and its exact step', () => {
    const state = {
      ...createTutorialState(),
      orientation: 'skipped' as const,
      campaign: 'preparing' as const,
      activeMissionId: 'TUT-ROU-03' as const,
      activeStepIndex: 1,
      missionProgramId: 'p-1',
      missions: { 'TUT-ROU-01': 'completed' as const },
    };
    saveTutorialState(state);
    expect(loadTutorialState()).toEqual(state);
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toContain('TUT-ROU-03');
  });

  it('complète une progression v3 écrite avant qu’un champ existe', () => {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        scriptVersion: 2,
        orientation: 'completed',
        campaign: 'preparing',
        activeMissionId: 'TUT-ROU-03',
        activeStepIndex: 1,
        missions: { 'TUT-ROU-02': 'completed' },
      }),
    );

    // La progression est conservée telle quelle ; seuls les champs ajoutés sont
    // complétés. Jeter l'état entier ferait recommencer une mission en cours
    // pour cause de mise à jour de l'application.
    expect(loadTutorialState()).toEqual({
      ...createTutorialState(),
      orientation: 'completed',
      campaign: 'preparing',
      activeMissionId: 'TUT-ROU-03',
      activeStepIndex: 1,
      missions: { 'TUT-ROU-02': 'completed' },
    });
  });

  it('ignores malformed or future state', () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '{broken');
    expect(loadTutorialState()).toEqual(createTutorialState());
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('ignores a v3 state whose missions value is an array', () => {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({ ...createTutorialState(), missions: [] }),
    );
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('ignores a v3 state containing an unknown mission key', () => {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({
        ...createTutorialState(),
        missions: { 'TUT-UNKNOWN': 'completed' },
      }),
    );
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('ignores a v3 state whose campaign status is unknown', () => {
    localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({ ...createTutorialState(), campaign: 'finished' }),
    );
    expect(loadTutorialState()).toEqual(createTutorialState());
  });
});
