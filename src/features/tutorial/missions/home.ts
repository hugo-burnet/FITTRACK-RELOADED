import { MANUAL, onEvent, type TutorialMission } from './kit';

/**
 * Le dessin musculaire interroge le catalogue, il ne décore pas.
 *
 * Une ligne sous le corps dit « Touche un muscle », et c'est tout ce que
 * l'écran révèle. La mission fait faire le geste, puis nomme ce que la feuille
 * ouvre — la liste des exercices de ce muscle, et l'entrée dans le catalogue
 * filtré sur lui.
 */
export const HOME_BODY: TutorialMission = {
  id: 'TUT-HOME-01',
  routePrefix: '/',
  titleKey: 'tutorial.home.body.title',
  guard: 'requires-history',
  steps: [
    {
      id: 'muscle-map',
      screen: 'home',
      reach: 'navigate',
      targetId: 'home-muscle-map',
      instructionKey: 'tutorial.home.muscleMap.instruction',
      detailKey: 'tutorial.home.muscleMap.detail',
      advance: onEvent((event) => event.type === 'home-muscle-selected'),
    },
    {
      // La cible de cette étape vit dans la feuille que la précédente vient
      // d'ouvrir. C'est la règle de cette zone : on ne désigne jamais une
      // commande restée sous un voile.
      id: 'muscle-catalogue',
      screen: 'home',
      reach: 'navigate',
      targetId: 'muscle-sheet-catalogue',
      instructionKey: 'tutorial.home.muscleSheet.instruction',
      detailKey: 'tutorial.home.muscleSheet.detail',
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
};

/**
 * La pesée du jour, ouverte mais jamais écrite.
 *
 * Un poids de corps est une mesure réelle, pas une démonstration : le guide
 * ouvre la feuille, nomme le bouton, et s'arrête. Même règle que devant
 * « Supprimer », pour une raison différente — ici rien ne se détruit, mais ce
 * qui s'écrirait serait faux.
 */
export const HOME_WEIGHT: TutorialMission = {
  id: 'TUT-HOME-02',
  routePrefix: '/',
  titleKey: 'tutorial.home.weight.title',
  guard: 'always',
  steps: [
    {
      id: 'open-weight',
      screen: 'home',
      reach: 'navigate',
      targetId: 'home-body-weight',
      instructionKey: 'tutorial.home.openWeight.instruction',
      detailKey: 'tutorial.home.openWeight.detail',
      advance: onEvent((event) => event.type === 'home-weight-opened'),
    },
    {
      id: 'save-is-yours',
      screen: 'home',
      reach: 'navigate',
      targetId: 'home-weight-save',
      instructionKey: 'tutorial.home.saveWeight.instruction',
      detailKey: 'tutorial.home.saveWeight.detail',
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
};
