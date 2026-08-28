import type { TutorialEvent, TutorialStateV3 } from '../tutorialTypes';
import { eventIs, MANUAL, onEvent, recordableSet, type TutorialMission } from './kit';

/** L'exercice de découverte : bilatéral, donc une ligne et une validation. */
export const CAMPAIGN_EXERCISE_SLUG = 'dumbbell-curl';

/**
 * Le même geste, mais sur **la** routine de la campagne.
 *
 * Sans cette vérification, préparer une autre routine dans un autre onglet
 * faisait avancer la découverte : le tutoriel déclarait acquis un geste fait
 * ailleurs, sur des données qu'il n'a jamais montrées.
 */
export const forCampaignRoutine =
  <T extends TutorialEvent['type']>(
    type: T,
    extra?: (event: Extract<TutorialEvent, { type: T }>) => boolean,
  ) =>
  (event: TutorialEvent, state: TutorialStateV3): boolean =>
    event.type === type &&
    'routineId' in event &&
    event.routineId === state.campaignRoutineId &&
    (extra?.(event as Extract<TutorialEvent, { type: T }>) ?? true);

/** Une recherche qui amène le curl — l'utilisateur reste libre de son orthographe. */
export const looksLikeCurl = (query: string): boolean => query.toLowerCase().includes('curl');

/**
 * Acte 1 de la campagne : préparer la « Séance découverte ».
 *
 * Remplace le choix « modèle ou routine vide » de l'activation. Faire choisir
 * un point de départ à quelqu'un qui n'a encore rien vu, c'est lui demander de
 * décider avant d'avoir appris ; la campagne, elle, fait faire.
 *
 * Elle s'arrête après la préparation. Enchaîner sur la séance demanderait d'en
 * ouvrir une — c'est-à-dire d'écrire une vraie séance dans l'historique pour
 * les besoins d'une démonstration. L'acte 2 attend que l'utilisateur démarre
 * lui-même cette routine, et il peut ne jamais le faire.
 */
export const CAMPAIGN_PREPARE: TutorialMission = {
  id: 'TUT-CAM-01',
  routePrefix: '/routines',
  titleKey: 'tutorial.campaign.prepare.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'open-create',
      screen: 'routines',
      reach: 'navigate',
      targetId: 'routine-create',
      instructionKey: 'tutorial.campaign.openCreate.instruction',
      detailKey: 'tutorial.campaign.openCreate.detail',
      advance: onEvent(eventIs('routine-create-opened')),
    },
    {
      id: 'create-blank',
      screen: 'routines',
      reach: 'navigate',
      targetId: 'routine-create-blank',
      instructionKey: 'tutorial.campaign.createBlank.instruction',
      clipId: 'mission-campaign-create-1',
      detailKey: 'tutorial.campaign.createBlank.detail',
      advance: onEvent(eventIs('routine-created')),
      // La routine de la campagne est celle que ce geste vient de créer. Tout
      // ce qui suit ne parlera que d'elle.
      remember: (state, event) =>
        event.type === 'routine-created' ? { ...state, campaignRoutineId: event.routineId } : state,
    },
    {
      id: 'name-routine',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-name',
      instructionKey: 'tutorial.campaign.name.instruction',
      detailKey: 'tutorial.campaign.name.detail',
      advance: onEvent(
        forCampaignRoutine('routine-renamed', (event) => event.name.trim().length > 0),
      ),
    },
    {
      id: 'open-picker',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-add-exercise',
      instructionKey: 'tutorial.campaign.openPicker.instruction',
      detailKey: 'tutorial.campaign.openPicker.detail',
      advance: onEvent(forCampaignRoutine('routine-picker-opened')),
    },
    {
      id: 'search-curl',
      screen: 'routine-picker',
      reach: 'navigate',
      targetId: 'exercise-search',
      instructionKey: 'tutorial.campaign.search.instruction',
      detailKey: 'tutorial.campaign.search.detail',
      advance: onEvent(
        forCampaignRoutine('routine-exercise-query-changed', (event) => looksLikeCurl(event.query)),
      ),
    },
    {
      id: 'select-curl',
      screen: 'routine-picker',
      reach: 'navigate',
      targetId: `exercise-${CAMPAIGN_EXERCISE_SLUG}`,
      instructionKey: 'tutorial.campaign.curl.instruction',
      detailKey: 'tutorial.campaign.curl.detail',
      advance: onEvent(
        forCampaignRoutine(
          'routine-exercise-selected',
          (event) => event.exerciseSlug === CAMPAIGN_EXERCISE_SLUG,
        ),
      ),
    },
    {
      id: 'add-curl',
      screen: 'routine-picker',
      reach: 'navigate',
      targetId: 'routine-exercise-add-confirm',
      instructionKey: 'tutorial.campaign.add.instruction',
      detailKey: 'tutorial.campaign.add.detail',
      advance: onEvent(
        forCampaignRoutine('routine-exercise-added', (event) =>
          event.exerciseSlugs.includes(CAMPAIGN_EXERCISE_SLUG),
        ),
      ),
    },
    {
      id: 'add-second-set',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-add-set',
      instructionKey: 'tutorial.campaign.secondSet.instruction',
      detailKey: 'tutorial.campaign.secondSet.detail',
      advance: onEvent(forCampaignRoutine('routine-set-added', (event) => event.count >= 2)),
    },
    {
      id: 'set-target',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-first-set',
      instructionKey: 'tutorial.campaign.target.instruction',
      detailKey: 'tutorial.campaign.target.detail',
      advance: onEvent(forCampaignRoutine('routine-target-updated')),
    },
    {
      id: 'set-rest',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-exercise-menu',
      instructionKey: 'tutorial.campaign.rest.instruction',
      detailKey: 'tutorial.campaign.rest.detail',
      advance: onEvent(forCampaignRoutine('routine-rest-updated', (event) => event.seconds > 0)),
    },
    {
      id: 'ready',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-start',
      instructionKey: 'tutorial.campaign.ready.instruction',
      detailKey: 'tutorial.campaign.ready.detail',
      // La seule étape de l'acte qui ne demande aucun geste : tout est déjà
      // enregistré, et « Démarrer » n'est pas à nous de l'appuyer.
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
  completes: (state) => ({ ...state, campaign: 'routine-ready' }),
};

/**
 * Acte 2 : la première vraie séance, reprise là où l'utilisateur l'a lancée.
 *
 * Elle ne démarre jamais d'elle-même. `resumeCampaignForWorkout` l'ouvre sur un
 * `workout-started` portant l'identifiant de la routine découverte, et sur
 * aucun autre : commencer une séance sur une routine différente n'est pas la
 * suite de cette leçon.
 */
export const CAMPAIGN_WORKOUT: TutorialMission = {
  id: 'TUT-CAM-02',
  routePrefix: '/workout',
  titleKey: 'tutorial.campaign.workout.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'write-first-set',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set',
      instructionKey: 'tutorial.campaign.write.instruction',
      detailKey: 'tutorial.campaign.write.detail',
      advance: onEvent(recordableSet),
    },
    {
      id: 'validate-first-set',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set-complete',
      instructionKey: 'tutorial.campaign.validate.instruction',
      detailKey: 'tutorial.campaign.validate.detail',
      advance: onEvent(eventIs('workout-set-completed')),
    },
    {
      id: 'rest',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-rest',
      instructionKey: 'tutorial.campaign.restRail.instruction',
      detailKey: 'tutorial.campaign.restRail.detail',
      // La fin du décompte, et rien d'autre : ajouter ou retirer du temps n'a
      // pas encore de commande dans l'écran de séance. La spec la prévoit, et
      // l'étape l'acceptera le jour où elle existera — pas avant, sinon la
      // consigne décrirait un bouton absent.
      advance: onEvent(eventIs('rest-finished')),
    },
    {
      id: 'second-set',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-second-set',
      instructionKey: 'tutorial.campaign.secondEffort.instruction',
      detailKey: 'tutorial.campaign.secondEffort.detail',
      advance: onEvent(eventIs('workout-set-completed')),
    },
    {
      id: 'open-finish',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-finish',
      instructionKey: 'tutorial.campaign.finish.instruction',
      detailKey: 'tutorial.campaign.finish.detail',
      advance: onEvent(eventIs('workout-finish-opened')),
    },
    {
      id: 'save',
      screen: 'workout-finish',
      reach: 'wait',
      targetId: 'workout-save',
      instructionKey: 'tutorial.campaign.save.instruction',
      detailKey: 'tutorial.campaign.save.detail',
      advance: onEvent(eventIs('workout-saved')),
    },
    {
      id: 'done',
      screen: 'home',
      reach: 'wait',
      // L'accueil entier est le sujet : ce qui a changé n'est pas un bouton,
      // c'est qu'il y a désormais une séance derrière chaque écran.
      targetId: null,
      instructionKey: 'tutorial.campaign.done.instruction',
      detailKey: 'tutorial.campaign.done.detail',
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
  completes: (state) => ({ ...state, campaign: 'completed' }),
};
