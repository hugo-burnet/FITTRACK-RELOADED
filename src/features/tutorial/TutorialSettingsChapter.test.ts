import { describe, expect, it } from 'vitest';
import { advanceMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';

const EMPTY_APP = { hasActiveWorkout: false, hasHistory: false, hasEffortPrompt: true, hasRepPacing: true, hasAudibleGuidance: true };

describe('missions des Réglages', () => {
  it('se termine sur le choix d’un mode, quel qu’il soit', () => {
    let state = startMission(createTutorialState(), 'TUT-SET-01');
    state = advanceMission(state, { type: 'announcer-mode-changed', mode: 'voice-only' });

    expect(state.missions['TUT-SET-01']).toBe('completed');
  });

  /*
   * Le Silence est une réponse. L'étape le refusait pour protéger l'étape
   * d'écho qui la suivait — et bloquait net celui qui venait couper le son.
   */
  it('accepte le Silence sans bloquer', () => {
    let state = startMission(createTutorialState(), 'TUT-SET-01');
    state = advanceMission(state, { type: 'announcer-mode-changed', mode: 'silence' });

    expect(state.missions['TUT-SET-01']).toBe('completed');
    expect(state.activeMissionId).toBeNull();
  });

  it('règle l’écho dans sa propre mission', () => {
    let state = startMission(createTutorialState(), 'TUT-SET-03');
    state = advanceMission(state, { type: 'announcer-echo-changed', enabled: false });

    expect(state.missions['TUT-SET-03']).toBe('completed');
  });

  /*
   * En Silence, `AnnouncerSettings` ne rend pas la ligne d'écho du tout : la
   * proposer désignerait une commande absente de la page.
   */
  it('ne propose l’écho que si quelque chose est audible', () => {
    const state = createTutorialState();
    const offered = (hasAudibleGuidance: boolean) =>
      contextualMissionsForPath('/settings', state, { ...EMPTY_APP, hasAudibleGuidance }).map(
        (mission) => mission.id,
      );

    expect(offered(true)).toContain('TUT-SET-03');
    expect(offered(false)).not.toContain('TUT-SET-03');
    // Le choix du mode, lui, reste proposé : c'est lui qui rallume le son.
    expect(offered(false)).toContain('TUT-SET-01');
  });

  it('fait allumer les rappels, puis choisir leurs jours', () => {
    let state = startMission(createTutorialState(), 'TUT-SET-02');
    state = advanceMission(state, {
      type: 'notification-preference-changed',
      key: 'reminders',
      enabled: true,
    });
    state = advanceMission(state, { type: 'notification-days-changed', days: 3 });

    expect(state.missions['TUT-SET-02']).toBe('completed');
  });

  /*
   * Éteindre les rappels replie la semaine et l'heure. L'étape demande de les
   * allumer, et les deux gestes émettent le même événement.
   */
  it('ne prend pas l’extinction des rappels pour leur allumage', () => {
    const state = startMission(createTutorialState(), 'TUT-SET-02');

    expect(
      advanceMission(state, {
        type: 'notification-preference-changed',
        key: 'reminders',
        enabled: false,
      }),
    ).toBe(state);
  });

  /*
   * Une autre bascule de la même section écrit aussi, mais ne révèle pas la
   * semaine : elle ne peut pas valider l'étape qui la demande.
   */
  it('n’accepte pas une autre bascule de notifications', () => {
    const state = startMission(createTutorialState(), 'TUT-SET-02');

    expect(
      advanceMission(state, {
        type: 'notification-preference-changed',
        key: 'records',
        enabled: true,
      }),
    ).toBe(state);
  });

  it('propose les missions des Réglages sur les Réglages', () => {
    const state = createTutorialState();
    const offered = contextualMissionsForPath('/settings', state, EMPTY_APP).map((m) => m.id);

    expect(offered).toContain('TUT-SET-01');
    expect(offered).toContain('TUT-SET-02');
    expect(offered).toContain('TUT-SET-03');
  });
});
