import { onEvent, type TutorialMission } from './kit';

/**
 * L'étape d'entrée, partagée par les deux missions de la zone.
 *
 * Le hub liste cinq analyses, mais « Records » n'a ni filtre de période ni
 * export : c'est « Séances par semaine » qui porte les deux commandes dont ce
 * chapitre parle. Les deux missions y entrent donc par la même porte, comme les
 * deux missions de fiche d'historique passent par le même menu Actions.
 */
const OPEN_WEEKLY = {
  screen: 'analytics',
  reach: 'navigate',
  targetId: 'analytics-weekly',
  advance: onEvent((event) => event.type === 'analytics-view-opened' && event.view === 'weekly'),
} as const;

/**
 * Cadrer une analyse sur la bonne durée.
 *
 * Douze semaines par défaut, et rien à l'écran ne dit que c'est un défaut : un
 * lecteur qui ne trouve pas sa séance d'il y a huit mois conclut qu'elle a été
 * perdue. La mission ouvre le filtre pour que la fenêtre devienne visible.
 */
export const ANALYTICS_READ: TutorialMission = {
  id: 'TUT-ANA-01',
  routePrefix: '/analytics',
  titleKey: 'tutorial.analytics.read.title',
  guard: 'requires-history',
  steps: [
    {
      ...OPEN_WEEKLY,
      id: 'open-weekly',
      instructionKey: 'tutorial.analytics.openWeekly.instruction',
      detailKey: 'tutorial.analytics.openWeekly.detail',
    },
    {
      id: 'change-period',
      screen: 'analytics-weekly',
      reach: 'navigate',
      targetId: 'analytics-period',
      instructionKey: 'tutorial.analytics.period.instruction',
      detailKey: 'tutorial.analytics.period.detail',
      // Quatre écrans portent ce filtre : sans l'identité de l'analyse,
      // celui d'un autre validerait cette étape à distance.
      advance: onEvent(
        (event) => event.type === 'analytics-period-changed' && event.view === 'weekly',
      ),
    },
  ],
  nextMissionId: null,
};

/**
 * Sortir un graphique de l'application.
 *
 * La seule mission de ce chantier qui va jusqu'au bout de son geste. Exporter
 * fabrique une image et la confie au système : rien n'est écrit, rien n'est
 * supprimé, donc rien n'oblige à s'arrêter devant — contrairement à
 * « Supprimer » ou à « Importer », que leurs missions nomment sans les toucher.
 */
export const ANALYTICS_SHARE: TutorialMission = {
  id: 'TUT-ANA-02',
  routePrefix: '/analytics',
  titleKey: 'tutorial.analytics.share.title',
  guard: 'requires-history',
  steps: [
    {
      ...OPEN_WEEKLY,
      id: 'open-weekly',
      instructionKey: 'tutorial.analytics.openWeeklyForShare.instruction',
      detailKey: 'tutorial.analytics.openWeeklyForShare.detail',
    },
    {
      id: 'share',
      screen: 'analytics-weekly',
      reach: 'navigate',
      targetId: 'analytics-share',
      instructionKey: 'tutorial.analytics.exportImage.instruction',
      detailKey: 'tutorial.analytics.exportImage.detail',
      advance: onEvent((event) => event.type === 'chart-share-opened' && event.chart === 'seances'),
    },
  ],
  nextMissionId: null,
};
