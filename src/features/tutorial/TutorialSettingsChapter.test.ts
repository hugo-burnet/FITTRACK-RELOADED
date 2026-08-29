import { describe, expect, it } from 'vitest';
import { advanceMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath } from './tutorialMissions';
import { createTutorialState } from './tutorialStore';

const EMPTY_APP = { hasActiveWorkout: false, hasHistory: false, hasEffortPrompt: true, hasRepPacing: true };

describe('missions des Réglages', () => {
  it('fait choisir un mode, puis régler l’écho', () => {
    let state = startMission(createTutorialState(), 'TUT-SET-01');
    state = advanceMission(state, { type: 'announcer-mode-changed', mode: 'voice-only' });
    state = advanceMission(state, { type: 'announcer-echo-changed', enabled: false });

    expect(state.missions['TUT-SET-01']).toBe('completed');
  });

  /*
   * La ligne d'écho n'est rendue que si quelque chose est audible. Accepter le
   * Silence aurait envoyé l'étape suivante chercher une commande que le choix
   * précédent venait de retirer de la page.
   */
  it('n’accepte pas le Silence, qui retire la commande suivante', () => {
    const state = startMission(createTutorialState(), 'TUT-SET-01');

    expect(advanceMission(state, { type: 'announcer-mode-changed', mode: 'silence' })).toBe(state);
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

  it('propose les deux missions sur les Réglages', () => {
    const state = createTutorialState();
    const offered = contextualMissionsForPath('/settings', state, EMPTY_APP).map((m) => m.id);

    expect(offered).toContain('TUT-SET-01');
    expect(offered).toContain('TUT-SET-02');
  });
});
