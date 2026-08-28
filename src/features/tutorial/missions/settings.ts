import { onEvent, type TutorialMission } from './kit';

/**
 * Régler ce que l'application dit à voix haute.
 *
 * Le mode d'abord, l'écho ensuite, et pas l'inverse : la ligne d'écho n'est
 * rendue que si quelque chose est audible. L'étape refuse donc le Silence —
 * l'accepter aurait envoyé l'étape suivante chercher une commande que le choix
 * précédent venait de retirer de la page. La consigne le dit avant, pas après.
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
      advance: onEvent(
        (event) => event.type === 'announcer-mode-changed' && event.mode !== 'silence',
      ),
    },
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
