import { describe, expect, it } from 'vitest';
import { contextualMissionsForPath, missionFor } from './tutorialMissions';
import { movesForward, pathForScreen, routineIdFromPath, screenHolds } from './tutorialScreens';
import { createTutorialState } from './tutorialStore';

const NO_WORKOUT = { hasActiveWorkout: false };

describe('les écrans des missions guidées', () => {
  it('lit la routine de l’URL, et rien d’autre', () => {
    expect(routineIdFromPath('/routines/r-1')).toBe('r-1');
    expect(routineIdFromPath('/routines/r-1/add')).toBe('r-1');
    expect(routineIdFromPath('/routines')).toBeNull();
    expect(routineIdFromPath('/programs/p-1')).toBeNull();
  });

  it('distingue la liste des routines de l’éditeur d’une routine', () => {
    expect(screenHolds('/routines', 'routines', 'r-1')).toBe(true);
    expect(screenHolds('/routines/r-1', 'routines', 'r-1')).toBe(false);
    expect(screenHolds('/routines', 'routine-editor', 'r-1')).toBe(false);
    expect(screenHolds('/routines/r-1', 'routine-editor', 'r-1')).toBe(true);
  });

  /*
   * Le sélecteur d'exercices est ouvert par l'étape elle-même. Le compter
   * comme « ailleurs » renverrait l'utilisateur à l'éditeur au moment précis
   * où il fait le geste demandé.
   */
  it('reste dans l’étape pendant le sélecteur d’exercices', () => {
    expect(screenHolds('/routines/r-1/add', 'routine-editor', 'r-1')).toBe(true);
    expect(screenHolds('/workout/add', 'workout', null)).toBe(true);
    expect(screenHolds('/routines/autre', 'routine-editor', 'r-1')).toBe(false);
  });

  it('sait où emmener, et se tait quand la routine est inconnue', () => {
    expect(pathForScreen('routine-editor', 'r-1')).toBe('/routines/r-1');
    expect(pathForScreen('routine-editor', null)).toBeNull();
    expect(pathForScreen('anywhere', 'r-1')).toBeNull();
    expect(pathForScreen('settings', null)).toBe('/settings');
  });

  it('ne fait pas du bilan de séance une destination', () => {
    const save = missionFor('TUT-WRK-04').steps[1];
    expect(save?.screen).toBe('workout-finish');
    expect(save?.reach).toBe('wait');
    // Les sauvegardes non plus : elles s'allument dans les Réglages, elles n'y
    // téléportent pas quelqu'un qui vient d'enregistrer sa première séance.
    expect(missionFor('TUT-DAT-01').steps[0]?.reach).toBe('wait');
  });

  /*
   * `TUT-CAM-01` vise le bouton de création, sur la liste, et s'achève sur
   * `routine-opened` — dans l'éditeur, une fois la routine lue en base. Entre
   * les deux, l'étape désigne encore la liste : sans cette règle, la visite
   * renvoyait à la liste quelqu'un qui venait d'ouvrir la routine demandée.
   */
  it('ne renvoie jamais vers un écran déjà dépassé', () => {
    expect(movesForward('/routines/r-1', '/routines')).toBe(false);
    expect(movesForward('/routines', '/routines')).toBe(false);
    expect(movesForward('/settings/debug', '/settings')).toBe(false);
    expect(movesForward('/routines', '/routines/r-1')).toBe(true);
    expect(movesForward('/history', '/settings')).toBe(true);
    // Deux routines sœurs : ni l'une ni l'autre n'est en amont de sa voisine.
    expect(movesForward('/routines/autre', '/routines/r-1')).toBe(true);
  });

  it('ne propose pas depuis l’aide une mission dont la cible est ailleurs', () => {
    const unknownRoutine = { ...createTutorialState(), orientation: 'completed' as const };
    const offered = contextualMissionsForPath('/routines', unknownRoutine, NO_WORKOUT);
    expect(offered.map((mission) => mission.id)).toEqual(['TUT-ROU-01']);

    const knownRoutine = { ...unknownRoutine, missionRoutineId: 'r-1' };
    expect(contextualMissionsForPath('/routines', knownRoutine, NO_WORKOUT).map((m) => m.id)).toEqual(
      ['TUT-ROU-01', 'TUT-ROU-02', 'TUT-ROU-03', 'TUT-ROU-04'],
    );
  });
});
