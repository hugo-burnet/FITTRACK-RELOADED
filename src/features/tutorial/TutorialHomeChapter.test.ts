import { describe, expect, it } from 'vitest';
import { advanceMission, continueMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath, missionFor } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';

const WITH_HISTORY = { hasActiveWorkout: false, hasHistory: true };
const EMPTY_APP = { hasActiveWorkout: false, hasHistory: false };

describe('missions de l’Accueil', () => {
  it('fait toucher un muscle, puis montre où mène la feuille', () => {
    let state = startMission(createTutorialState(), 'TUT-HOME-01');
    state = advanceMission(state, { type: 'home-muscle-selected', muscle: 'lats' });
    state = continueMission(state);

    expect(state.missions['TUT-HOME-01']).toBe('completed');
  });

  it('ouvre la pesée sans jamais l’enregistrer', () => {
    let state = startMission(createTutorialState(), 'TUT-HOME-02');
    state = advanceMission(state, { type: 'home-weight-opened' });

    const mission = missionFor('TUT-HOME-02');
    const last = mission.steps[mission.steps.length - 1];
    expect(last?.targetId).toBe('home-weight-save');
    expect(last?.advance.kind).toBe('manual');
    expect(continueMission(state).missions['TUT-HOME-02']).toBe('completed');
  });

  /*
   * Le dessin n'est rendu que si au moins un muscle est allumé, donc seulement
   * après des séances. La pesée, elle, ne demande rien.
   */
  it('ne propose le dessin qu’une fois qu’il y a de quoi le remplir', () => {
    const state = createTutorialState();

    expect(contextualMissionsForPath('/', state, EMPTY_APP).map((m) => m.id)).toEqual([
      'TUT-HOME-02',
    ]);
    expect(contextualMissionsForPath('/', state, WITH_HISTORY).map((m) => m.id)).toEqual([
      'TUT-HOME-01',
      'TUT-HOME-02',
    ]);
  });

  /*
   * `/` est un préfixe de toutes les adresses de l'application. Avec la
   * comparaison par préfixe, l'aide de l'Accueil se proposait sur l'Historique,
   * sur les Réglages, partout — et l'aide d'une page finissait par offrir des
   * missions qui parlent d'un autre écran.
   */
  it('ne suit l’Accueil sur aucune autre adresse', () => {
    const state = createTutorialState();

    for (const path of ['/history', '/settings', '/exercises', '/analytics/weekly']) {
      const offered = contextualMissionsForPath(path, state, WITH_HISTORY).map((m) => m.id);
      expect(offered, `${path} propose une mission d’Accueil`).not.toContain('TUT-HOME-01');
      expect(offered, `${path} propose une mission d’Accueil`).not.toContain('TUT-HOME-02');
    }
  });

  /*
   * L'inverse du même défaut : un préfixe ne doit pas non plus attraper une
   * adresse qui commence par les mêmes lettres sans être dessous.
   */
  it('ne confond pas une adresse voisine avec sa zone', () => {
    const state = createTutorialState();

    expect(contextualMissionsForPath('/historyx', state, WITH_HISTORY)).toEqual([]);
  });
});
