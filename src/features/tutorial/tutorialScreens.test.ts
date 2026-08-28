import { describe, expect, it } from 'vitest';
import { contextualMissionsForPath, missionFor } from './tutorialMissions';
import {
  movesForward,
  pathForScreen,
  programIdFromPath,
  routineIdFromPath,
  screenHolds,
  type TutorialRouteContext,
} from './tutorialScreens';
import { createTutorialState } from './tutorialStore';

const NO_WORKOUT = { hasActiveWorkout: false, hasHistory: false };
const NOWHERE: TutorialRouteContext = { routineId: null, programId: null, workoutId: null };
const at = (partial: Partial<TutorialRouteContext>): TutorialRouteContext => ({
  ...NOWHERE,
  ...partial,
});

describe('les écrans des missions guidées', () => {
  it('lit la routine de l’URL, et rien d’autre', () => {
    expect(routineIdFromPath('/routines/r-1')).toBe('r-1');
    expect(routineIdFromPath('/routines/r-1/add')).toBe('r-1');
    expect(routineIdFromPath('/routines')).toBeNull();
    expect(routineIdFromPath('/programs/p-1')).toBeNull();
  });

  it('lit le programme de l’URL, sans confondre la création avec un bloc', () => {
    expect(programIdFromPath('/programs/p-1')).toBe('p-1');
    expect(programIdFromPath('/programs/p-1/edit')).toBe('p-1');
    expect(programIdFromPath('/programs/new')).toBeNull();
    expect(programIdFromPath('/programs')).toBeNull();
  });

  it.each([
    ['home', {}, '/'],
    ['routines', {}, '/routines'],
    ['routine-editor', { routineId: 'r1' }, '/routines/r1'],
    ['routine-picker', { routineId: 'r1' }, '/routines/r1/add'],
    ['programs', {}, '/programs'],
    ['program-editor', {}, '/programs/new'],
    ['program-editor', { programId: 'p1' }, '/programs/p1/edit'],
    ['program-detail', { programId: 'p1' }, '/programs/p1'],
    ['workout', {}, '/workout'],
    ['workout-finish', {}, '/workout/finish'],
    ['history', {}, '/history'],
    ['analytics', {}, '/analytics'],
    ['exercises', {}, '/exercises'],
    ['settings', {}, '/settings'],
    ['knowledge', {}, '/knowledge'],
  ] as const)('résout %s', (screen, partial, expected) => {
    expect(pathForScreen(screen, at(partial))).toBe(expected);
  });

  it('distingue la liste des routines de l’éditeur d’une routine', () => {
    expect(screenHolds('/routines', 'routines', at({ routineId: 'r-1' }))).toBe(true);
    expect(screenHolds('/routines/r-1', 'routines', at({ routineId: 'r-1' }))).toBe(false);
    expect(screenHolds('/routines', 'routine-editor', at({ routineId: 'r-1' }))).toBe(false);
    expect(screenHolds('/routines/r-1', 'routine-editor', at({ routineId: 'r-1' }))).toBe(true);
    expect(screenHolds('/routines/autre', 'routine-editor', at({ routineId: 'r-1' }))).toBe(false);
  });

  /*
   * Le sélecteur d'exercices était compté comme faisant partie de l'éditeur,
   * parce que l'étape qui l'ouvrait s'y serait sinon fait renvoyer en arrière.
   * Il a désormais son propre écran, et c'est `movesForward` qui empêche le
   * retour : une consigne n'a plus à être lue devant un écran qui ne la
   * contient pas pour que le geste demandé reste possible.
   */
  it('sépare le sélecteur d’exercices de l’éditeur qui l’ouvre', () => {
    expect(screenHolds('/routines/r-1/add', 'routine-editor', at({ routineId: 'r-1' }))).toBe(
      false,
    );
    expect(screenHolds('/routines/r-1/add', 'routine-picker', at({ routineId: 'r-1' }))).toBe(true);
    expect(screenHolds('/routines/r-1', 'routine-picker', at({ routineId: 'r-1' }))).toBe(false);
    expect(movesForward('/routines/r-1/add', '/routines/r-1')).toBe(false);
    // La séance et son ajout d'exercice restent un seul écran : l'ajout n'a pas
    // d'étape à lui, et la barre de séance vit sur les deux.
    expect(screenHolds('/workout/add', 'workout', NOWHERE)).toBe(true);
  });

  it('distingue création, détail et édition d’un bloc', () => {
    expect(screenHolds('/programs', 'programs', NOWHERE)).toBe(true);
    expect(screenHolds('/programs/new', 'programs', NOWHERE)).toBe(false);
    expect(screenHolds('/programs/new', 'program-editor', NOWHERE)).toBe(true);
    expect(screenHolds('/programs/p-1', 'program-editor', at({ programId: 'p-1' }))).toBe(false);
    expect(screenHolds('/programs/p-1/edit', 'program-editor', at({ programId: 'p-1' }))).toBe(
      true,
    );
    expect(screenHolds('/programs/p-1', 'program-detail', at({ programId: 'p-1' }))).toBe(true);
    expect(screenHolds('/programs/p-1/edit', 'program-detail', at({ programId: 'p-1' }))).toBe(
      false,
    );
    expect(screenHolds('/programs/autre', 'program-detail', at({ programId: 'p-1' }))).toBe(false);
  });

  it('ne prend pas une sous-page pour la page dont l’étape parle', () => {
    expect(screenHolds('/settings', 'settings', NOWHERE)).toBe(true);
    expect(screenHolds('/settings/debug', 'settings', NOWHERE)).toBe(false);
    expect(screenHolds('/history/import', 'history', NOWHERE)).toBe(false);
    expect(screenHolds('/analytics/records', 'analytics', NOWHERE)).toBe(false);
  });

  it('sait où emmener, et se tait quand la routine est inconnue', () => {
    expect(pathForScreen('routine-editor', NOWHERE)).toBeNull();
    expect(pathForScreen('routine-picker', NOWHERE)).toBeNull();
    expect(pathForScreen('program-detail', NOWHERE)).toBeNull();
    expect(pathForScreen('anywhere', at({ routineId: 'r-1' }))).toBeNull();
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
   * `routine-created` — dans l'éditeur, une fois la routine écrite en base.
   * Entre les deux, l'étape désigne encore la liste : sans cette règle, la
   * visite renvoyait à la liste quelqu'un qui venait de créer la routine
   * demandée.
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
    expect(
      contextualMissionsForPath('/routines', knownRoutine, NO_WORKOUT).map((m) => m.id),
    ).toEqual(['TUT-ROU-01', 'TUT-ROU-02', 'TUT-ROU-03', 'TUT-ROU-04']);
  });
});
