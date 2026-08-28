import { eventIs, onEvent, type TutorialMission } from './kit';

/**
 * Trouver un exercice dans un catalogue de plusieurs centaines de lignes.
 *
 * Les trois entrées se cumulent — la recherche, le muscle, le matériel — et
 * l'écran ne le dit nulle part : il affiche « 24 sur 168 » sans expliquer d'où
 * vient le 24. La mission les pose l'une après l'autre pour que le compteur
 * bouge sous les yeux, et nomme la sortie quand le cumul ne laisse plus rien.
 */
export const EXERCISE_FIND: TutorialMission = {
  id: 'TUT-EXE-01',
  routePrefix: '/exercises',
  titleKey: 'tutorial.exercises.find.title',
  guard: 'always',
  steps: [
    {
      id: 'search',
      screen: 'exercises',
      reach: 'navigate',
      targetId: 'exercise-search',
      instructionKey: 'tutorial.exercises.search.instruction',
      detailKey: 'tutorial.exercises.search.detail',
      // Le champ publie à chaque frappe : sans le test sur la valeur, l'étape
      // se validerait aussi bien en effaçant la recherche qu'en la tapant.
      advance: onEvent(
        (event) => event.type === 'exercise-query-changed' && event.query.trim() !== '',
      ),
    },
    {
      id: 'filter-muscle',
      screen: 'exercises',
      reach: 'navigate',
      targetId: 'exercise-muscle-filter',
      instructionKey: 'tutorial.exercises.filterMuscle.instruction',
      detailKey: 'tutorial.exercises.filterMuscle.detail',
      advance: onEvent(
        (event) => event.type === 'exercise-muscle-filter-changed' && event.muscle !== null,
      ),
    },
    {
      id: 'filter-equipment',
      screen: 'exercises',
      reach: 'navigate',
      targetId: 'exercise-equipment-filter',
      instructionKey: 'tutorial.exercises.filterEquipment.instruction',
      detailKey: 'tutorial.exercises.filterEquipment.detail',
      advance: onEvent(
        (event) => event.type === 'exercise-equipment-filter-changed' && event.equipment !== null,
      ),
    },
  ],
  nextMissionId: null,
};

/**
 * Fabriquer l'exercice que le catalogue n'a pas.
 *
 * Le nom est une étape à part entière et non un préalable tacite : « Créer
 * l'exercice » reste désactivé tant que le champ est vide, donc une mission qui
 * enchaînerait la mesure sur l'ouverture du formulaire finirait par désigner un
 * bouton mort en demandant de l'appuyer.
 *
 * Elle s'arrête sur ce bouton sans le presser. Créer n'est pas destructeur,
 * mais c'est une écriture : la dernière étape attend `exercise-created`, donc
 * la réponse du repository à un geste de l'utilisateur.
 */
export const EXERCISE_CREATE: TutorialMission = {
  id: 'TUT-EXE-02',
  routePrefix: '/exercises',
  titleKey: 'tutorial.exercises.create.title',
  guard: 'always',
  steps: [
    {
      id: 'open-form',
      screen: 'exercises',
      reach: 'navigate',
      targetId: 'exercise-create',
      instructionKey: 'tutorial.exercises.openForm.instruction',
      detailKey: 'tutorial.exercises.openForm.detail',
      advance: onEvent(eventIs('exercise-create-opened')),
    },
    {
      id: 'name',
      screen: 'exercise-form',
      reach: 'navigate',
      targetId: 'exercise-name',
      instructionKey: 'tutorial.exercises.name.instruction',
      detailKey: 'tutorial.exercises.name.detail',
      // Le bouton d'enregistrement teste `name.trim()` : l'étape teste la même
      // chose, sans quoi elle laisserait passer un nom d'espaces.
      advance: onEvent((event) => event.type === 'exercise-named' && event.name.trim() !== ''),
    },
    {
      id: 'measurement',
      screen: 'exercise-form',
      reach: 'navigate',
      targetId: 'exercise-measurement',
      instructionKey: 'tutorial.exercises.measurement.instruction',
      detailKey: 'tutorial.exercises.measurement.detail',
      advance: onEvent(eventIs('exercise-measurement-set')),
    },
    {
      id: 'unilateral',
      screen: 'exercise-form',
      reach: 'navigate',
      targetId: 'exercise-unilateral',
      instructionKey: 'tutorial.exercises.unilateral.instruction',
      detailKey: 'tutorial.exercises.unilateral.detail',
      // Oui comme Non répondent à la question : l'étape demande de trancher,
      // pas de cocher Oui.
      advance: onEvent(eventIs('exercise-unilateral-set')),
    },
    {
      id: 'save',
      screen: 'exercise-form',
      reach: 'navigate',
      targetId: 'exercise-save',
      instructionKey: 'tutorial.exercises.save.instruction',
      detailKey: 'tutorial.exercises.save.detail',
      advance: onEvent(eventIs('exercise-created')),
    },
  ],
  nextMissionId: null,
};
