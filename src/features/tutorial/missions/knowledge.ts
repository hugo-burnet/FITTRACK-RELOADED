import { eventIs, MANUAL, onEvent, type TutorialMission } from './kit';

/**
 * Interroger le corpus embarqué.
 *
 * La recherche est lexicale et hors ligne : elle ne trouve que les passages qui
 * portent les mots demandés, et affiche un refus plutôt que d'inventer une
 * réponse. C'est la propriété la moins évidente de l'écran et la plus
 * importante ; la mission la fait rencontrer au lieu de l'annoncer.
 */
export const KNOWLEDGE_SEARCH: TutorialMission = {
  id: 'TUT-KNW-01',
  routePrefix: '/knowledge',
  titleKey: 'tutorial.knowledge.search.title',
  guard: 'always',
  steps: [
    {
      id: 'search',
      screen: 'knowledge',
      reach: 'navigate',
      targetId: 'knowledge-search',
      instructionKey: 'tutorial.knowledge.query.instruction',
      detailKey: 'tutorial.knowledge.query.detail',
      // Une recherche sans résultat laisse l'étape en place : la suivante
      // désigne la première carte, et il n'y en a aucune.
      advance: onEvent((event) => event.type === 'knowledge-search-ran' && event.results > 0),
    },
    {
      id: 'open-result',
      screen: 'knowledge',
      reach: 'navigate',
      targetId: 'knowledge-first-result',
      instructionKey: 'tutorial.knowledge.openResult.instruction',
      detailKey: 'tutorial.knowledge.openResult.detail',
      advance: onEvent(eventIs('knowledge-result-opened')),
    },
  ],
  nextMissionId: null,
};

/**
 * Prendre le Guide dans l'ordre où il se lit.
 *
 * Quatorze étapes, et un suivi qui vit dans `localStorage` : c'est le lecteur
 * qui déclare avoir lu, personne d'autre. La mission nomme ce bouton et s'arrête
 * devant — cocher « Lu » à sa place serait une affirmation fausse sur ce qu'il
 * a fait, du même ordre qu'une fausse séance.
 *
 * Elle finit sur les Sources, parce que c'est là que le corpus se distingue
 * d'un blog : chaque affirmation porte de quoi la vérifier.
 */
export const KNOWLEDGE_LEARNING_PATH: TutorialMission = {
  id: 'TUT-KNW-02',
  routePrefix: '/knowledge',
  titleKey: 'tutorial.knowledge.learn.title',
  guard: 'always',
  steps: [
    {
      id: 'open-path',
      screen: 'knowledge',
      reach: 'navigate',
      targetId: 'knowledge-programming-path',
      instructionKey: 'tutorial.knowledge.openPath.instruction',
      detailKey: 'tutorial.knowledge.openPath.detail',
      advance: onEvent(eventIs('learning-path-opened')),
    },
    {
      id: 'progress-is-yours',
      screen: 'learning-path',
      reach: 'navigate',
      targetId: 'knowledge-step-toggle',
      instructionKey: 'tutorial.knowledge.markRead.instruction',
      detailKey: 'tutorial.knowledge.markRead.detail',
      advance: MANUAL,
    },
    {
      id: 'open-first-step',
      screen: 'learning-path',
      reach: 'navigate',
      targetId: 'knowledge-first-step',
      instructionKey: 'tutorial.knowledge.openStep.instruction',
      detailKey: 'tutorial.knowledge.openStep.detail',
      advance: onEvent(eventIs('learning-step-opened')),
    },
    {
      id: 'sources',
      screen: 'knowledge-article',
      // L'étape précédente vient d'y emmener le lecteur, et l'adresse dépend de
      // l'article qu'il a ouvert : on attend, on ne navigue pas.
      reach: 'wait',
      targetId: 'knowledge-sources',
      instructionKey: 'tutorial.knowledge.sources.instruction',
      detailKey: 'tutorial.knowledge.sources.detail',
      advance: onEvent(eventIs('article-sources-opened')),
    },
  ],
  nextMissionId: null,
};
