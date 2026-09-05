import { onEvent, type TutorialMission } from './kit';

/**
 * Choisir ce que l'application dit à voix haute — Silence compris.
 *
 * **Une étape, et une seule.** L'écho vivait ici, en seconde étape, et cela
 * forçait la première à refuser le Silence : la ligne d'écho n'est rendue que
 * si quelque chose est audible, et l'accepter aurait envoyé l'étape suivante
 * chercher une commande que le choix précédent venait de retirer de la page.
 *
 * Le prix de cette garde était payé par la seule personne à qui la leçon
 * servait vraiment : celle qui vient couper le son restait bloquée sur une
 * étape qui lui redemandait de le rallumer, sans autre issue que l'abandon.
 * Une consigne ne demande pas d'activer un mode que l'utilisateur a choisi de
 * couper. Le mode se choisit donc librement, la mission se termine là, et
 * l'écho est devenu `ANNOUNCER_ECHO` — une mission à part, proposée seulement
 * quand sa commande existe.
 */
export const ANNOUNCER_TUNE: TutorialMission = {
  id: 'TUT-SET-01',
  routePrefix: '/settings',
  titleKey: 'tutorial.settings.announcer.title',
  guard: 'always',
  steps: [
    {
      id: 'mode',
      screen: 'settings',
      reach: 'navigate',
      targetId: 'announcer-modes',
      instructionKey: 'tutorial.settings.mode.instruction',
      detailKey: 'tutorial.settings.mode.detail',
      advance: onEvent((event) => event.type === 'announcer-mode-changed'),
    },
  ],
  nextMissionId: null,
};

/**
 * L'écho de la voix — la mission qui n'existe que s'il y a une voix.
 *
 * `requires-audible-guidance` n'est pas une précaution de style : en Silence,
 * `AnnouncerSettings` ne rend pas la ligne du tout. Sans cette garde, la
 * mission serait proposée, démarrerait, et le coach attendrait indéfiniment une
 * ancre qui n'est pas dans la page. Et si le mode passe au Silence pendant la
 * mission, la garde la met en pause plutôt que de la compter refusée : elle
 * reviendra intacte le jour où le son revient.
 */
export const ANNOUNCER_ECHO: TutorialMission = {
  id: 'TUT-SET-03',
  routePrefix: '/settings',
  titleKey: 'tutorial.settings.echoTune.title',
  guard: 'requires-audible-guidance',
  steps: [
    {
      id: 'echo',
      screen: 'settings',
      reach: 'navigate',
      targetId: 'announcer-echo',
      instructionKey: 'tutorial.settings.echo.instruction',
      detailKey: 'tutorial.settings.echo.detail',
      advance: onEvent((event) => event.type === 'announcer-echo-changed'),
    },
  ],
  nextMissionId: null,
};

/**
 * Décider quand l'application a le droit de parler à un téléphone posé.
 *
 * Les rappels sont la seule des trois notifications qui sonne un jour où
 * l'application n'a pas été ouverte, et la seule qui cache un réglage : la
 * semaine et l'heure n'apparaissent qu'une fois l'interrupteur allumé. C'est ce
 * dépliage que la mission fait voir.
 *
 * Aucune étape d'enregistrement, parce qu'il n'y a pas de bouton : chaque
 * bascule écrit tout de suite.
 */
export const NOTIFICATION_TUNE: TutorialMission = {
  id: 'TUT-SET-02',
  routePrefix: '/settings',
  titleKey: 'tutorial.settings.notifications.title',
  guard: 'always',
  steps: [
    {
      id: 'reminders',
      screen: 'settings',
      reach: 'navigate',
      targetId: 'notification-reminders',
      instructionKey: 'tutorial.settings.reminders.instruction',
      detailKey: 'tutorial.settings.reminders.detail',
      // Les trois bascules écrivent avec le même événement, et éteindre replie
      // ce que l'étape suivante demande de régler.
      advance: onEvent(
        (event) =>
          event.type === 'notification-preference-changed' &&
          event.key === 'reminders' &&
          event.enabled,
      ),
    },
    {
      id: 'days',
      screen: 'settings',
      reach: 'navigate',
      targetId: 'notification-days',
      instructionKey: 'tutorial.settings.days.instruction',
      detailKey: 'tutorial.settings.days.detail',
      advance: onEvent((event) => event.type === 'notification-days-changed'),
    },
  ],
  nextMissionId: null,
};
