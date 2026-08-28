import { describe, expect, it } from 'vitest';
import { advanceMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath, missionFor } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';

const EMPTY_APP = { hasActiveWorkout: false, hasHistory: false };

describe('missions de la bibliothèque d’exercices', () => {
  it('fait chercher, puis filtrer sur les deux axes', () => {
    let state = startMission(createTutorialState(), 'TUT-EXE-01');
    state = advanceMission(state, { type: 'exercise-query-changed', query: 'curl' });
    state = advanceMission(state, { type: 'exercise-muscle-filter-changed', muscle: 'biceps' });
    state = advanceMission(state, {
      type: 'exercise-equipment-filter-changed',
      equipment: 'dumbbell',
    });

    expect(state.missions['TUT-EXE-01']).toBe('completed');
  });

  /*
   * Le champ publie à chaque frappe, effacement compris. Sans la garde, vider
   * la recherche validait l'étape qui demande de chercher — et l'espace seul
   * est un champ vide qui ne filtre rien : `normalizeSearch` le coupe.
   */
  it('ne prend pas une recherche effacée pour une recherche', () => {
    const state = startMission(createTutorialState(), 'TUT-EXE-01');

    expect(advanceMission(state, { type: 'exercise-query-changed', query: '' })).toBe(state);
    expect(advanceMission(state, { type: 'exercise-query-changed', query: '   ' })).toBe(state);
  });

  /*
   * « Tous les muscles » émet le même événement qu'un muscle choisi. Retirer un
   * filtre n'est pas le poser — même défaut que sur le filtre par exercice de
   * l'historique.
   */
  it('ne prend pas le retrait d’un filtre pour un filtrage', () => {
    let state = startMission(createTutorialState(), 'TUT-EXE-01');
    state = advanceMission(state, { type: 'exercise-query-changed', query: 'curl' });

    expect(advanceMission(state, { type: 'exercise-muscle-filter-changed', muscle: null })).toBe(
      state,
    );
  });

  it('mène la création jusqu’à l’écriture, sans l’écrire', () => {
    let state = startMission(createTutorialState(), 'TUT-EXE-02');
    state = advanceMission(state, { type: 'exercise-create-opened' });
    state = advanceMission(state, { type: 'exercise-named', name: 'Presse à cuisses inclinée' });
    state = advanceMission(state, {
      type: 'exercise-measurement-set',
      measurementType: 'weight_reps',
    });
    state = advanceMission(state, { type: 'exercise-unilateral-set', isUnilateral: 1 });
    state = advanceMission(state, { type: 'exercise-created', exerciseId: 'x-1' });

    expect(state.missions['TUT-EXE-02']).toBe('completed');
  });

  /*
   * « Créer l'exercice » est désactivé tant que le nom est vide. Une mission qui
   * sauterait le nom amènerait l'utilisateur devant un bouton mort en lui
   * demandant de l'appuyer.
   */
  it('fait nommer l’exercice avant de désigner Créer', () => {
    const mission = missionFor('TUT-EXE-02');
    const targets = mission.steps.map((step) => step.targetId);

    expect(targets.indexOf('exercise-name')).toBeLessThan(targets.indexOf('exercise-save'));

    const state = advanceMission(startMission(createTutorialState(), 'TUT-EXE-02'), {
      type: 'exercise-create-opened',
    });
    expect(advanceMission(state, { type: 'exercise-named', name: '  ' })).toBe(state);
  });

  /*
   * La dernière étape attend `exercise-created` : c'est l'utilisateur qui appuie
   * et le repository qui répond. Une étape manuelle ici laisserait croire la
   * mission finie devant un formulaire jamais enregistré.
   */
  it('finit sur l’écriture réelle du nouvel exercice', () => {
    const mission = missionFor('TUT-EXE-02');
    const last = mission.steps[mission.steps.length - 1];

    expect(last?.targetId).toBe('exercise-save');
    expect(last?.advance.kind).toBe('event');
  });

  /*
   * La bibliothèque est complète dès l'installation : ces deux missions ne
   * demandent ni séance, ni historique, ni routine.
   */
  it('propose les deux missions sur une application vide', () => {
    const state = createTutorialState();

    expect(contextualMissionsForPath('/exercises', state, EMPTY_APP).map((m) => m.id)).toEqual([
      'TUT-EXE-01',
      'TUT-EXE-02',
    ]);
  });
});
