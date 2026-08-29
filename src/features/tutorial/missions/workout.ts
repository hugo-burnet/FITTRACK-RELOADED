import { eventIs, MANUAL, onEvent, type TutorialMission } from './kit';

/**
 * Les missions avancées de l'écran de séance.
 *
 * Toutes gardées par une séance active : elles parlent de commandes qui
 * n'existent que pendant une séance, et le coach n'en fabrique jamais une pour
 * se donner un terrain de jeu.
 *
 * Deux d'entre elles ont une garde de plus, et pour la même raison : leur cible
 * dépend d'un **réglage**, pas d'une donnée. La bande d'effort peut être
 * éteinte, la cadence n'existe pas en « Voix uniquement ». Sans ces gardes,
 * elles seraient proposées à quelqu'un pour qui la commande n'est pas rendue —
 * jamais, pas seulement cette fois.
 */

/** Allonger une séance en cours : une série de plus, puis un exercice de plus. */
export const WORKOUT_COMPOSE: TutorialMission = {
  id: 'TUT-WRK-05',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.compose.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'add-set',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-add-set',
      instructionKey: 'tutorial.workout.addSet.instruction',
      detailKey: 'tutorial.workout.addSet.detail',
      advance: onEvent(eventIs('workout-set-added')),
    },
    {
      id: 'add-exercise',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-add-exercise',
      instructionKey: 'tutorial.workout.addExercise.instruction',
      detailKey: 'tutorial.workout.addExercise.detail',
      advance: onEvent(eventIs('workout-exercise-picker-opened')),
    },
  ],
  nextMissionId: null,
};

/**
 * Dire ce qu'est une série.
 *
 * Le type décide si elle compte dans le volume et dans les records : c'est le
 * réglage le plus lourd de conséquences de l'écran, et il est caché derrière le
 * numéro de la ligne.
 */
export const WORKOUT_SET_TYPE: TutorialMission = {
  id: 'TUT-WRK-06',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.setType.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-menu',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set-menu',
      instructionKey: 'tutorial.workout.setMenu.instruction',
      detailKey: 'tutorial.workout.setMenu.detail',
      advance: onEvent(eventIs('workout-set-menu-opened')),
    },
    {
      id: 'choose-type',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-set-type',
      instructionKey: 'tutorial.workout.chooseType.instruction',
      detailKey: 'tutorial.workout.chooseType.detail',
      // « Normale » est le type que la série a déjà : le choisir ne change rien
      // à l'écran, et l'étape demande de voir une série changer de nature.
      advance: onEvent(
        (event) => event.type === 'workout-set-type-updated' && event.setType !== 'normal',
      ),
    },
  ],
  nextMissionId: null,
};

/** Valider une série, puis dire ce qu'elle a coûté. */
export const WORKOUT_EFFORT: TutorialMission = {
  id: 'TUT-WRK-07',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.effort.title',
  guard: 'requires-effort-prompt',
  steps: [
    {
      id: 'complete-set',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set-complete',
      instructionKey: 'tutorial.workout.completeSet.instruction',
      detailKey: 'tutorial.workout.completeSet.detail',
      advance: onEvent(eventIs('workout-set-completed')),
    },
    {
      id: 'rpe',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-rpe',
      instructionKey: 'tutorial.workout.rpe.instruction',
      detailKey: 'tutorial.workout.rpe.detail',
      advance: onEvent(eventIs('workout-rpe-updated')),
    },
  ],
  nextMissionId: null,
};

/** Ce qu'il faut réellement enfiler sur la barre. */
export const WORKOUT_PLATES: TutorialMission = {
  id: 'TUT-WRK-08',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.plates.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-plates',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-plates',
      instructionKey: 'tutorial.workout.openPlates.instruction',
      detailKey: 'tutorial.workout.openPlates.detail',
      advance: onEvent(eventIs('plate-sheet-opened')),
    },
    {
      id: 'available-plates',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-plates-available',
      instructionKey: 'tutorial.workout.availablePlates.instruction',
      detailKey: 'tutorial.workout.availablePlates.detail',
      advance: onEvent(eventIs('plate-availability-changed')),
    },
  ],
  nextMissionId: null,
};

/**
 * Monter en charge sans y penser.
 *
 * Trois étapes parce que la commande vit dans le menu de l'exercice et non sur
 * sa carte : la désigner sans ouvrir le menu aurait encadré un bouton fermé.
 */
export const WORKOUT_WARMUP: TutorialMission = {
  id: 'TUT-WRK-09',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.warmup.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-exercise-menu',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-exercise-menu',
      instructionKey: 'tutorial.workout.exerciseMenu.instruction',
      detailKey: 'tutorial.workout.exerciseMenu.detail',
      advance: onEvent(eventIs('workout-exercise-menu-opened')),
    },
    {
      id: 'open-warmup',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-warmup',
      instructionKey: 'tutorial.workout.openWarmup.instruction',
      detailKey: 'tutorial.workout.openWarmup.detail',
      advance: onEvent(eventIs('warmup-sheet-opened')),
    },
    {
      id: 'insert-warmup',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-warmup-insert',
      instructionKey: 'tutorial.workout.insertWarmup.instruction',
      detailKey: 'tutorial.workout.insertWarmup.detail',
      // Une feuille vidée de ses étapes insère zéro série : ce n'est pas
      // insérer, et l'étape ne doit pas s'en satisfaire.
      advance: onEvent((event) => event.type === 'warmup-inserted' && event.count > 0),
    },
  ],
  nextMissionId: null,
};

/** Le métronome : le lancer, et surtout savoir l'arrêter. */
export const WORKOUT_PACE: TutorialMission = {
  id: 'TUT-WRK-10',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.pace.title',
  guard: 'requires-rep-pacing',
  steps: [
    {
      id: 'open-pace',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-pace',
      instructionKey: 'tutorial.workout.openPace.instruction',
      detailKey: 'tutorial.workout.openPace.detail',
      advance: onEvent(eventIs('pace-sheet-opened')),
    },
    {
      id: 'start-pace',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-pace-start',
      instructionKey: 'tutorial.workout.startPace.instruction',
      detailKey: 'tutorial.workout.startPace.detail',
      advance: onEvent(eventIs('pace-started')),
    },
    {
      id: 'stop-pace',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-pace-stop',
      instructionKey: 'tutorial.workout.stopPace.instruction',
      detailKey: 'tutorial.workout.stopPace.detail',
      advance: onEvent(eventIs('pace-stopped')),
    },
  ],
  nextMissionId: null,
};

/**
 * Un maintien unilatéral, des deux côtés, en une seule série.
 *
 * La dernière étape n'a **pas de cible**, et c'est exact : les deux côtés
 * passent par la même coche, dont seul le libellé change. Deux étapes
 * consécutives sur la même ancre seraient une consigne qu'on ne distingue pas
 * de la précédente ; celle-ci parle de l'écran et attend la validation réelle.
 */
export const WORKOUT_HOLD_SIDES: TutorialMission = {
  id: 'TUT-WRK-11',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.holdSides.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-hold',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-pace',
      instructionKey: 'tutorial.workout.openHold.instruction',
      detailKey: 'tutorial.workout.openHold.detail',
      advance: onEvent(eventIs('pace-sheet-opened')),
    },
    {
      id: 'start-hold',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-hold-start',
      instructionKey: 'tutorial.workout.startHold.instruction',
      detailKey: 'tutorial.workout.startHold.detail',
      advance: onEvent(eventIs('hold-started')),
    },
    {
      id: 'first-side',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set-complete',
      instructionKey: 'tutorial.workout.firstSide.instruction',
      detailKey: 'tutorial.workout.firstSide.detail',
      advance: onEvent(eventIs('workout-side-turned')),
    },
    {
      id: 'second-side',
      screen: 'workout',
      reach: 'navigate',
      targetId: null,
      instructionKey: 'tutorial.workout.secondSide.instruction',
      detailKey: 'tutorial.workout.secondSide.detail',
      advance: onEvent(eventIs('workout-set-completed')),
    },
  ],
  nextMissionId: null,
};

/**
 * Alléger une séance qui ne passe pas.
 *
 * S'arrête devant « Appliquer » : la décharge réécrit la charge de toutes les
 * séries restantes. Montrer où vit ce geste fait partie de la leçon, le
 * déclencher non — même règle que « Supprimer » et « Importer ».
 */
export const WORKOUT_DELOAD: TutorialMission = {
  id: 'TUT-WRK-12',
  routePrefix: '/workout',
  titleKey: 'tutorial.workout.deload.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-deload',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-deload',
      instructionKey: 'tutorial.workout.openDeload.instruction',
      detailKey: 'tutorial.workout.openDeload.detail',
      advance: onEvent(eventIs('deload-sheet-opened')),
    },
    {
      id: 'yours-to-apply',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-deload-confirm',
      instructionKey: 'tutorial.workout.applyDeload.instruction',
      detailKey: 'tutorial.workout.applyDeload.detail',
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
};
