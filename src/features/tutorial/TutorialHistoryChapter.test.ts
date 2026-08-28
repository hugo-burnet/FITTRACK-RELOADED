import { describe, expect, it } from 'vitest';
import { advanceMission, continueMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath, missionFor, P1_MISSIONS } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';

const WITH_HISTORY = { hasActiveWorkout: false, hasHistory: true };
const EMPTY_APP = { hasActiveWorkout: false, hasHistory: false };

describe('missions d’historique', () => {
  it('retrouve une séance par le calendrier, un jour et un exercice', () => {
    let state = startMission(createTutorialState(), 'TUT-HIS-01');
    state = advanceMission(state, { type: 'history-view-changed', view: 'calendar' });
    state = advanceMission(state, { type: 'history-day-selected', timestamp: 1_767_398_400_000 });
    state = advanceMission(state, {
      type: 'history-exercise-filter-changed',
      exerciseId: 'e-1',
    });
    state = advanceMission(state, { type: 'history-workout-opened', workoutId: 'w-1' });

    expect(state.missions['TUT-HIS-01']).toBe('completed');
    // La séance ouverte devient l'adresse des deux missions suivantes.
    expect(state.missionWorkoutId).toBe('w-1');
  });

  /*
   * Revenir à « Tous les exercices » émet le même événement que choisir un
   * exercice. Sans la garde, retirer le filtre validerait l'étape qui demande
   * de le poser.
   */
  it('ne prend pas le retrait du filtre pour un filtrage', () => {
    let state = startMission(createTutorialState(), 'TUT-HIS-01');
    state = advanceMission(state, { type: 'history-view-changed', view: 'calendar' });
    state = advanceMission(state, { type: 'history-day-selected', timestamp: 1 });

    expect(
      advanceMission(state, { type: 'history-exercise-filter-changed', exerciseId: null }),
    ).toBe(state);
  });

  it('ne passe pas en calendrier quand on revient au journal', () => {
    const state = startMission(createTutorialState(), 'TUT-HIS-01');

    expect(advanceMission(state, { type: 'history-view-changed', view: 'journal' })).toBe(state);
  });

  it('fait pratiquer la correction jusqu’à l’écriture', () => {
    let state = startMission(createTutorialState(), 'TUT-HIS-02');
    state = advanceMission(state, { type: 'history-actions-opened', workoutId: 'w-1' });
    state = advanceMission(state, { type: 'history-edit-opened', workoutId: 'w-1' });
    state = advanceMission(state, { type: 'history-edit-saved', workoutId: 'w-1' });

    expect(state.missions['TUT-HIS-02']).toBe('completed');
  });

  /*
   * Supprimer et Importer sont les deux gestes irréversibles de cette zone. Les
   * missions les montrent — l'une nomme le bouton, l'autre s'arrête devant — et
   * aucune ne les déclenche.
   */
  it('s’arrête devant les deux gestes irréversibles', () => {
    const share = missionFor('TUT-HIS-03');
    const lastShare = share.steps[share.steps.length - 1];
    expect(lastShare?.id).toBe('delete-lives-here');
    expect(lastShare?.advance.kind).toBe('manual');

    const hevy = missionFor('TUT-IMP-01');
    const lastImport = hevy.steps[hevy.steps.length - 1];
    expect(lastImport?.id).toBe('yours-to-press');
    expect(lastImport?.targetId).toBe('hevy-submit');
    expect(lastImport?.advance.kind).toBe('manual');
  });

  it('atteint la revue Hevy sans écrire', () => {
    let state = startMission(createTutorialState(), 'TUT-IMP-01');
    state = advanceMission(state, { type: 'hevy-import-opened' });
    state = advanceMission(state, { type: 'hevy-file-parsed', workoutCount: 42 });
    state = advanceMission(state, { type: 'hevy-review-opened', workoutCount: 42 });

    const mission = missionFor('TUT-IMP-01');
    expect(mission.steps[state.activeStepIndex]?.id).toBe('yours-to-press');
    expect(continueMission(state).missions['TUT-IMP-01']).toBe('completed');
  });

  it('ne propose rien d’historique tant qu’il n’y a pas de séance', () => {
    const state = { ...createTutorialState(), orientation: 'completed' as const };

    expect(contextualMissionsForPath('/history', state, EMPTY_APP).map((m) => m.id)).toEqual([
      'TUT-IMP-01',
    ]);

    /*
     * Corriger et partager commencent sur la fiche d'une séance. Tant qu'on
     * n'en a ouvert aucune, `/history/:id` n'est pas une adresse : les
     * proposer mènerait à une consigne dont la première étape est
     * injoignable — le défaut que `isMissionReachable` existe pour empêcher.
     */
    expect(contextualMissionsForPath('/history', state, WITH_HISTORY).map((m) => m.id)).toEqual([
      'TUT-HIS-01',
      'TUT-IMP-01',
    ]);

    const opened = { ...state, missionWorkoutId: 'w-1' };
    expect(contextualMissionsForPath('/history', opened, WITH_HISTORY).map((m) => m.id)).toEqual([
      'TUT-HIS-01',
      'TUT-HIS-02',
      'TUT-HIS-03',
      'TUT-IMP-01',
    ]);
  });

  /*
   * Deux étapes d'une même mission peuvent viser la même commande — rouvrir le
   * menu en fait partie — mais deux étapes *consécutives* sur la même cible
   * seraient une consigne qui ne se distingue pas de la précédente.
   */
  it('ne répète jamais la même cible deux étapes de suite', () => {
    for (const mission of P1_MISSIONS) {
      const targets = mission.steps.map((step) => `${step.screen}:${step.targetId ?? ''}`);
      for (let index = 1; index < targets.length; index += 1) {
        expect(targets[index], `${mission.id} répète ${targets[index] ?? ''}`).not.toBe(
          targets[index - 1],
        );
      }
    }
  });
});
