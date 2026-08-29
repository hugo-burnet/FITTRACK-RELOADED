import { describe, expect, it } from 'vitest';
import { advanceMission, continueMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath, missionFor } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';

const IN_WORKOUT = {
  hasActiveWorkout: true,
  hasHistory: true,
  hasEffortPrompt: true,
  hasRepPacing: true,
};

describe('missions avancées de séance', () => {
  it('fait allonger la séance : une série, puis un exercice', () => {
    let state = startMission(createTutorialState(), 'TUT-WRK-05');
    state = advanceMission(state, { type: 'workout-set-added', rowId: 'r1' });
    state = advanceMission(state, { type: 'workout-exercise-picker-opened' });

    expect(state.missions['TUT-WRK-05']).toBe('completed');
  });

  /*
   * « Normale » est le type que la série a déjà. Le choisir ne change rien à
   * l'écran, et l'accepter validerait une étape qui demande justement de voir
   * une série changer de nature.
   */
  it('n’accepte pas « Normale » comme changement de type', () => {
    const state = advanceMission(startMission(createTutorialState(), 'TUT-WRK-06'), {
      type: 'workout-set-menu-opened',
      setId: 's1',
    });

    expect(
      advanceMission(state, { type: 'workout-set-type-updated', setId: 's1', setType: 'normal' }),
    ).toBe(state);
    expect(
      advanceMission(state, { type: 'workout-set-type-updated', setId: 's1', setType: 'dropset' })
        .missions['TUT-WRK-06'],
    ).toBe('completed');
  });

  it('fait valider une série, puis renseigner son RPE', () => {
    let state = startMission(createTutorialState(), 'TUT-WRK-07');
    state = advanceMission(state, { type: 'workout-set-completed', workoutId: 'w1', setId: 's1' });
    state = advanceMission(state, { type: 'workout-rpe-updated', setId: 's1', rpe: 8 });

    expect(state.missions['TUT-WRK-07']).toBe('completed');
  });

  /*
   * La bande d'effort est un réglage, pas une donnée : éteinte, elle n'est
   * jamais rendue. Proposer la mission désignerait une commande absente de la
   * page — pas dans certains cas, jamais.
   */
  it('ne propose le RPE que si la bande d’effort est allumée', () => {
    const state = createTutorialState();
    const offered = (hasEffortPrompt: boolean) =>
      contextualMissionsForPath('/workout', state, { ...IN_WORKOUT, hasEffortPrompt }).map(
        (m) => m.id,
      );

    expect(offered(true)).toContain('TUT-WRK-07');
    expect(offered(false)).not.toContain('TUT-WRK-07');
  });

  /*
   * En « Voix uniquement » le métronome n'existe pas du tout — le moteur refuse
   * de l'armer. La mission qui apprend à le lancer attendrait un départ qui
   * n'arrivera jamais.
   */
  it('ne propose la cadence que si le mode l’autorise', () => {
    const state = createTutorialState();
    const offered = (hasRepPacing: boolean) =>
      contextualMissionsForPath('/workout', state, { ...IN_WORKOUT, hasRepPacing }).map(
        (m) => m.id,
      );

    expect(offered(true)).toContain('TUT-WRK-10');
    expect(offered(false)).not.toContain('TUT-WRK-10');
  });

  it('fait ouvrir les plaques, puis changer ce qui est disponible', () => {
    let state = startMission(createTutorialState(), 'TUT-WRK-08');
    state = advanceMission(state, { type: 'plate-sheet-opened', rowId: 'r1' });
    state = advanceMission(state, { type: 'plate-availability-changed', count: 8 });

    expect(state.missions['TUT-WRK-08']).toBe('completed');
  });

  /*
   * L'échauffement vit dans le menu de l'exercice, pas sur la carte : la
   * mission ouvre donc le menu avant de pouvoir le désigner.
   */
  it('passe par le menu de l’exercice pour atteindre l’échauffement', () => {
    let state = startMission(createTutorialState(), 'TUT-WRK-09');
    state = advanceMission(state, { type: 'workout-exercise-menu-opened', rowId: 'r1' });
    state = advanceMission(state, { type: 'warmup-sheet-opened', rowId: 'r1' });

    expect(
      advanceMission(state, { type: 'warmup-inserted', rowId: 'r1', count: 0 }),
      'insérer zéro série n’est pas insérer',
    ).toBe(state);

    state = advanceMission(state, { type: 'warmup-inserted', rowId: 'r1', count: 3 });
    expect(state.missions['TUT-WRK-09']).toBe('completed');
  });

  it('fait lancer puis arrêter la cadence', () => {
    let state = startMission(createTutorialState(), 'TUT-WRK-10');
    state = advanceMission(state, { type: 'pace-sheet-opened', rowId: 'r1' });
    state = advanceMission(state, { type: 'pace-started', setId: 's1' });
    state = advanceMission(state, { type: 'pace-stopped', setId: 's1' });

    expect(state.missions['TUT-WRK-10']).toBe('completed');
  });

  /*
   * Les deux côtés passent par la **même** coche, dont le libellé change. La
   * dernière étape n'a donc pas de cible propre : elle parle de l'écran, et
   * attend la validation réelle.
   */
  it('mène le maintien du premier côté au second sur la même coche', () => {
    let state = startMission(createTutorialState(), 'TUT-WRK-11');
    state = advanceMission(state, { type: 'pace-sheet-opened', rowId: 'r1' });
    state = advanceMission(state, { type: 'hold-started', setId: 's1' });
    state = advanceMission(state, { type: 'workout-side-turned', setId: 's1' });
    state = advanceMission(state, { type: 'workout-set-completed', workoutId: 'w1', setId: 's1' });

    expect(state.missions['TUT-WRK-11']).toBe('completed');

    const mission = missionFor('TUT-WRK-11');
    expect(mission.steps[mission.steps.length - 1]?.targetId).toBeNull();
  });

  /*
   * La décharge réécrit la charge de toutes les séries restantes. La mission
   * ouvre la feuille, nomme « Appliquer » et s'arrête devant — même règle que
   * « Supprimer » et « Importer ».
   */
  it('s’arrête devant l’application de la décharge', () => {
    const state = advanceMission(startMission(createTutorialState(), 'TUT-WRK-12'), {
      type: 'deload-sheet-opened',
      workoutId: 'w1',
    });

    const mission = missionFor('TUT-WRK-12');
    const last = mission.steps[mission.steps.length - 1];
    expect(last?.advance.kind).toBe('manual');
    expect(continueMission(state).missions['TUT-WRK-12']).toBe('completed');
  });

  it('ne propose aucune de ces missions hors d’une séance active', () => {
    const state = createTutorialState();
    const offered = contextualMissionsForPath('/workout', state, {
      ...IN_WORKOUT,
      hasActiveWorkout: false,
    });

    expect(offered).toEqual([]);
  });
});
