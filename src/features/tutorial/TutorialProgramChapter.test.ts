import { describe, expect, it } from 'vitest';
import { advanceMission, continueMission, startMission } from './tutorialMissionMachine';
import { missionFor } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';
import type { TutorialStateV3 } from './tutorialTypes';

/** Les dix-huit étapes, dans l'ordre, avec les gestes que l'écran produit. */
function walkProgramChapter(programId: string): TutorialStateV3 {
  let state = startMission(createTutorialState(), 'TUT-PRG-01');
  state = continueMission(state);
  state = advanceMission(state, { type: 'program-create-opened' });
  state = advanceMission(state, { type: 'program-basics-named', name: 'Force · automne' });
  state = advanceMission(state, { type: 'program-basics-dated', startsAt: 1_767_398_400_000 });
  state = advanceMission(state, { type: 'program-basics-duration-set', weeks: 8 });
  state = advanceMission(state, { type: 'program-draft-created', programId });
  state = advanceMission(state, { type: 'program-split-day-set', index: 0, dayOfWeek: 1 });
  state = advanceMission(state, { type: 'program-split-routine-set', index: 0, routineId: 'r1' });
  state = continueMission(state);
  state = advanceMission(state, { type: 'program-split-saved', programId, entries: 1 });
  state = advanceMission(state, { type: 'program-recipe-applied', recipe: 'strength' });
  state = advanceMission(state, { type: 'program-week-opened', weekIndex: 0 });
  state = advanceMission(state, { type: 'program-activated', programId });
  state = continueMission(state);
  state = advanceMission(state, { type: 'program-session-selected', programId, entryId: 'e1' });
  state = continueMission(state);
  return advanceMission(state, { type: 'program-actions-opened', programId });
}

describe('chapitre Programmes', () => {
  it('mène de la création du bloc jusqu’à son suivi', () => {
    const state = walkProgramChapter('p1');

    // Reste la dernière étape : celle qui montre « Démarrer » sans l'appuyer.
    const mission = missionFor('TUT-PRG-01');
    expect(mission.steps[state.activeStepIndex]?.id).toBe('before-start');
    expect(state.activeMissionId).toBe('TUT-PRG-01');
    expect(state.missionProgramId).toBe('p1');
  });

  /*
   * Le brouillon n'entre dans l'URL qu'à l'activation. Sans la prise sur son
   * identifiant, les étapes suivantes parleraient de n'importe quel bloc — et
   * l'activation d'un autre brouillon, ouvert dans un second temps, validerait
   * celle-ci.
   */
  it('retient le brouillon créé et refuse l’activation d’un autre', () => {
    let state = startMission(createTutorialState(), 'TUT-PRG-01');
    for (const step of ['what-is-a-block'] as const) {
      expect(missionFor('TUT-PRG-01').steps[0]?.id).toBe(step);
    }
    state = continueMission(state);
    state = advanceMission(state, { type: 'program-create-opened' });
    state = advanceMission(state, { type: 'program-basics-named', name: 'Bloc' });
    state = advanceMission(state, { type: 'program-basics-dated', startsAt: 1_767_398_400_000 });
    state = advanceMission(state, { type: 'program-basics-duration-set', weeks: 4 });
    state = advanceMission(state, { type: 'program-draft-created', programId: 'p1' });
    expect(state.missionProgramId).toBe('p1');

    state = advanceMission(state, { type: 'program-split-day-set', index: 0, dayOfWeek: 3 });
    state = advanceMission(state, { type: 'program-split-routine-set', index: 0, routineId: 'r1' });
    state = continueMission(state);
    state = advanceMission(state, { type: 'program-split-saved', programId: 'p1', entries: 2 });
    state = advanceMission(state, { type: 'program-recipe-applied', recipe: 'return' });
    state = advanceMission(state, { type: 'program-week-opened', weekIndex: 0 });

    const other = advanceMission(state, { type: 'program-activated', programId: 'p2' });
    expect(other).toBe(state);

    const own = advanceMission(state, { type: 'program-activated', programId: 'p1' });
    expect(missionFor('TUT-PRG-01').steps[own.activeStepIndex]?.id).toBe('read-week');
  });

  it('n’avance pas sur une routine de split laissée vide', () => {
    let state = startMission(createTutorialState(), 'TUT-PRG-01');
    state = continueMission(state);
    state = advanceMission(state, { type: 'program-create-opened' });
    state = advanceMission(state, { type: 'program-basics-named', name: 'Bloc' });
    state = advanceMission(state, { type: 'program-basics-dated', startsAt: 1_767_398_400_000 });
    state = advanceMission(state, { type: 'program-basics-duration-set', weeks: 4 });
    state = advanceMission(state, { type: 'program-draft-created', programId: 'p1' });
    state = advanceMission(state, { type: 'program-split-day-set', index: 0, dayOfWeek: 1 });

    // Le sélecteur émet aussi quand on revient à « Choisir une routine ».
    const cleared = advanceMission(state, {
      type: 'program-split-routine-set',
      index: 0,
      routineId: '',
    });
    expect(cleared).toBe(state);
  });

  it('n’accepte pas un nom de bloc vide', () => {
    let state = startMission(createTutorialState(), 'TUT-PRG-01');
    state = continueMission(state);
    state = advanceMission(state, { type: 'program-create-opened' });

    expect(advanceMission(state, { type: 'program-basics-named', name: '   ' })).toBe(state);
  });

  /*
   * Le chapitre montre le menu qui contient Décaler, Terminer et Supprimer. Il
   * ne demande aucun de ces gestes : une leçon qui fait supprimer pour montrer
   * comment supprimer a détruit quelque chose de vrai.
   */
  it('s’arrête avant « Démarrer » et n’ouvre aucune confirmation destructive', () => {
    const mission = missionFor('TUT-PRG-01');
    const last = mission.steps[mission.steps.length - 1];

    expect(last?.id).toBe('before-start');
    expect(last?.targetId).toBe('program-start');
    expect(last?.advance.kind).toBe('manual');
    expect(mission.nextMissionId).toBeNull();

    const finished = continueMission({
      ...createTutorialState(),
      activeMissionId: 'TUT-PRG-01',
      activeStepIndex: mission.steps.length - 1,
    });
    expect(finished.missions['TUT-PRG-01']).toBe('completed');
    expect(finished.activeMissionId).toBeNull();
  });

  it('parle des blocs, et depuis leur écran', () => {
    const mission = missionFor('TUT-PRG-01');

    expect(mission.routePrefix).toBe('/programs');
    // Les trois étapes de l'assistant partagent l'adresse `/programs/new` : le
    // pas de l'assistant n'est pas dans l'URL, et l'écran non plus.
    const wizard = mission.steps.filter((step) => step.screen === 'program-editor');
    expect(wizard.map((step) => step.id)).toContain('save-basics');
    expect(wizard.map((step) => step.id)).toContain('activate');
    expect(mission.steps.every((step) => step.targetId !== null)).toBe(true);
  });
});
