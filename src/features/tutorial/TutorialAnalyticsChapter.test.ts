import { describe, expect, it } from 'vitest';
import { advanceMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath, missionFor } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';

const WITH_HISTORY = { hasActiveWorkout: false, hasHistory: true, hasEffortPrompt: true, hasRepPacing: true };
const EMPTY_APP = { hasActiveWorkout: false, hasHistory: false, hasEffortPrompt: true, hasRepPacing: true };

describe('missions de la Progression', () => {
  it('ouvre une analyse, puis en change la période', () => {
    let state = startMission(createTutorialState(), 'TUT-ANA-01');
    state = advanceMission(state, { type: 'analytics-view-opened', view: 'weekly' });
    state = advanceMission(state, {
      type: 'analytics-period-changed',
      view: 'weekly',
      period: '52w',
    });

    expect(state.missions['TUT-ANA-01']).toBe('completed');
  });

  /*
   * Les cinq lignes du hub émettent le même événement. Sans l'identité de
   * l'analyse, ouvrir « Volume d'entraînement » validait l'étape qui demande
   * d'ouvrir « Séances par semaine », puis la mission attendait une période sur
   * un écran où l'utilisateur n'était pas.
   */
  it('n’accepte pas une autre analyse que la sienne', () => {
    const state = startMission(createTutorialState(), 'TUT-ANA-01');

    expect(advanceMission(state, { type: 'analytics-view-opened', view: 'volume' })).toBe(state);
  });

  /*
   * Quatre écrans portent un filtre de période identique. L'étape n'accepte que
   * celui de son analyse.
   */
  it('n’accepte pas la période changée sur une autre analyse', () => {
    const state = advanceMission(startMission(createTutorialState(), 'TUT-ANA-01'), {
      type: 'analytics-view-opened',
      view: 'weekly',
    });

    expect(
      advanceMission(state, {
        type: 'analytics-period-changed',
        view: 'volume',
        period: '52w',
      }),
    ).toBe(state);
  });

  it('mène le graphique jusqu’au partage', () => {
    let state = startMission(createTutorialState(), 'TUT-ANA-02');
    state = advanceMission(state, { type: 'analytics-view-opened', view: 'weekly' });
    state = advanceMission(state, { type: 'chart-share-opened', chart: 'seances' });

    expect(state.missions['TUT-ANA-02']).toBe('completed');
  });

  /*
   * `ChartExportAction` est monté par trois écrans et porte la même ancre sur
   * chacun. Le slug est ce qui distingue le graphique exporté.
   */
  it('n’accepte pas l’export d’un autre graphique', () => {
    const state = advanceMission(startMission(createTutorialState(), 'TUT-ANA-02'), {
      type: 'analytics-view-opened',
      view: 'weekly',
    });

    expect(advanceMission(state, { type: 'chart-share-opened', chart: 'volume' })).toBe(state);
  });

  /*
   * Le hub cache les quatre analyses tant qu'aucune séance n'est terminée : les
   * proposer mènerait à une consigne dont la cible n'est pas rendue.
   */
  it('ne propose rien de la Progression sur une application vide', () => {
    const state = createTutorialState();

    expect(contextualMissionsForPath('/analytics', state, EMPTY_APP)).toEqual([]);
    expect(contextualMissionsForPath('/analytics', state, WITH_HISTORY).map((m) => m.id)).toEqual([
      'TUT-ANA-01',
      'TUT-ANA-02',
    ]);
  });

  /*
   * Exporter fabrique une image et la confie au système. Rien n'est écrit, rien
   * n'est supprimé : la mission peut donc aller jusqu'au bout du geste, ce que
   * les missions d'historique n'ont pas le droit de faire.
   */
  it('va jusqu’au geste, parce qu’il ne détruit rien', () => {
    const mission = missionFor('TUT-ANA-02');
    const last = mission.steps[mission.steps.length - 1];

    expect(last?.targetId).toBe('analytics-share');
    expect(last?.advance.kind).toBe('event');
  });
});
