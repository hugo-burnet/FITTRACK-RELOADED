import { describe, expect, it } from 'vitest';
import { advanceMission, continueMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath, missionFor } from './tutorialMissions';
import { pathForScreen, screenHolds } from './tutorialScreens';
import { createTutorialState } from './tutorialStore';

const EMPTY_APP = { hasActiveWorkout: false, hasHistory: false, hasEffortPrompt: true, hasRepPacing: true };
const NO_CONTEXT = { routineId: null, programId: null, workoutId: null };

describe('missions des Connaissances', () => {
  it('fait chercher, puis ouvrir la première preuve', () => {
    let state = startMission(createTutorialState(), 'TUT-KNW-01');
    state = advanceMission(state, {
      type: 'knowledge-search-ran',
      query: 'volume hypertrophie',
      results: 8,
    });
    state = advanceMission(state, { type: 'knowledge-result-opened', rank: 1 });

    expect(state.missions['TUT-KNW-01']).toBe('completed');
  });

  /*
   * Le corpus refuse plutôt que de combler : une question sans correspondance
   * ne rend aucune carte. L'étape suivante demande d'ouvrir la première — sans
   * cette garde, elle désignerait une commande que l'écran n'a pas rendue.
   */
  it('n’avance pas sur une recherche qui n’a rien trouvé', () => {
    const state = startMission(createTutorialState(), 'TUT-KNW-01');

    expect(advanceMission(state, { type: 'knowledge-search-ran', query: 'zzzz', results: 0 })).toBe(
      state,
    );
  });

  it('mène le parcours de son entrée jusqu’aux sources d’un article', () => {
    let state = startMission(createTutorialState(), 'TUT-KNW-02');
    state = advanceMission(state, { type: 'learning-path-opened' });
    // L'étape du suivi ne fait rien faire : elle montre.
    state = continueMission(state);
    state = advanceMission(state, {
      type: 'learning-step-opened',
      articleId: 'programming-progression',
    });
    state = advanceMission(state, { type: 'article-sources-opened' });

    expect(state.missions['TUT-KNW-02']).toBe('completed');
  });

  /*
   * Cocher « Lu » est une affirmation sur ce que le lecteur a fait. Le tutoriel
   * n'a pas à la produire à sa place — pas plus qu'une fausse séance. L'étape
   * nomme le bouton et s'arrête devant, comme celle qui montre « Supprimer ».
   */
  it('ne fait jamais cocher une étape comme lue', () => {
    const mission = missionFor('TUT-KNW-02');
    const toggle = mission.steps[1];

    expect(toggle?.targetId).toBe('knowledge-step-toggle');
    expect(toggle?.advance.kind).toBe('manual');
  });

  /*
   * Un article s'atteint par deux adresses et le tutoriel ne choisit pas
   * laquelle : c'est le lecteur qui est arrivé là par l'étape précédente. La
   * dernière étape attend donc, au lieu d'inventer une destination.
   */
  it('attend le lecteur sur l’article plutôt que d’en désigner un', () => {
    const mission = missionFor('TUT-KNW-02');
    const sources = mission.steps[mission.steps.length - 1];

    expect(sources?.reach).toBe('wait');
    expect(pathForScreen('knowledge-article', NO_CONTEXT)).toBeNull();
    expect(screenHolds('/knowledge/a/clinical-red-flags', 'knowledge-article', NO_CONTEXT)).toBe(
      true,
    );
    expect(
      screenHolds('/knowledge/programmation/programming-volume', 'knowledge-article', NO_CONTEXT),
    ).toBe(true);
    // L'index du Guide n'est pas un article.
    expect(screenHolds('/knowledge/programmation', 'knowledge-article', NO_CONTEXT)).toBe(false);
  });

  /*
   * Le corpus est embarqué : ces deux missions ne demandent ni séance, ni
   * historique, ni réseau.
   */
  it('propose les deux missions sur une application vide', () => {
    const state = createTutorialState();

    expect(contextualMissionsForPath('/knowledge', state, EMPTY_APP).map((m) => m.id)).toEqual([
      'TUT-KNW-01',
      'TUT-KNW-02',
    ]);
  });
});
