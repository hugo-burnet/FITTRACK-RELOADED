import type { TranslationKey } from '@/i18n/fr';
import { pathForScreen, type TutorialRouteContext, type TutorialScreen } from './tutorialScreens';
import type {
  TutorialAdvance,
  TutorialEvent,
  TutorialMissionId,
  TutorialStateV3,
} from './tutorialTypes';

export interface TutorialMissionStep {
  id: string;
  /**
   * L'écran qui porte l'ancre `targetId`. C'est lui qui décide de la
   * navigation, et non plus le `routePrefix` de la mission : celui-ci répond à
   * « de quel onglet cette mission parle-t-elle », pas à « où est le bouton ».
   */
  screen: TutorialScreen;
  /**
   * `wait` pour une étape qu'on n'a pas le droit d'atteindre à la place de
   * l'utilisateur : le bilan s'ouvre parce qu'il a fini sa séance, et les
   * Réglages ne sont pas un endroit où le jeter à la seconde où il vient
   * d'enregistrer sa première séance. Le coach attend alors qu'il y arrive.
   */
  reach: 'navigate' | 'wait';
  /**
   * L'ancre encadrée, ou `null` quand l'étape parle de l'écran entier.
   *
   * Une étape sans cible n'attend rien pour parler : c'est le seul cas, et il
   * est explicite. Toutes les autres se taisent tant que leur commande n'est
   * pas là.
   */
  targetId: string | null;
  instructionKey: TranslationKey;
  detailKey: TranslationKey;
  /**
   * Le clip enregistré, quand il existe.
   *
   * Absent pour les consignes écrites dans ce chantier : leur texte se relit et
   * se corrige à l'écran, l'enregistrer coûte une génération payante, et la
   * phase voix vient après validation des textes en navigateur. Le panneau
   * porte alors la consigne en entier — c'est déjà ce qui se passe en Silence.
   */
  clipId?: string;
  advance: TutorialAdvance;
  /** Ce que l'étape retient de l'événement qui l'a fait passer. */
  remember?: (state: TutorialStateV3, event: TutorialEvent) => TutorialStateV3;
}

export interface TutorialMission {
  id: TutorialMissionId;
  /** La zone de l'application dont la mission parle — pour l'aide de la page. */
  routePrefix: '/routines' | '/workout' | '/settings' | '/programs' | '/';
  titleKey: TranslationKey;
  guard: 'always' | 'requires-active-workout' | 'requires-no-active-workout' | 'external';
  steps: readonly TutorialMissionStep[];
  nextMissionId: TutorialMissionId | null;
  /** L'état de campagne que la dernière étape laisse derrière elle. */
  completes?: (state: TutorialStateV3) => TutorialStateV3;
}

export interface TutorialMissionFacts {
  hasActiveWorkout: boolean | null;
}

/** Une étape que seul un geste métier fait avancer — le cas courant. */
const onEvent = (
  accepts: (event: TutorialEvent, state: TutorialStateV3) => boolean,
): TutorialAdvance => ({
  kind: 'event',
  accepts,
});

/** Une étape qui n'a rien à faire faire : elle montre, et attend « Continuer ». */
const MANUAL: TutorialAdvance = { kind: 'manual' };

const eventIs =
  <T extends TutorialEvent['type']>(type: T) =>
  (event: TutorialEvent): boolean =>
    event.type === type;

const positiveRest = (event: TutorialEvent): boolean =>
  event.type === 'routine-rest-updated' && event.seconds > 0;

const recordableSet = (event: TutorialEvent): boolean =>
  event.type === 'workout-set-written' && event.recordable;

/** L'exercice de découverte : bilatéral, donc une ligne et une validation. */
export const CAMPAIGN_EXERCISE_SLUG = 'dumbbell-curl';

/**
 * Le même geste, mais sur **la** routine de la campagne.
 *
 * Sans cette vérification, préparer une autre routine dans un autre onglet
 * faisait avancer la découverte : le tutoriel déclarait acquis un geste fait
 * ailleurs, sur des données qu'il n'a jamais montrées.
 */
const forCampaignRoutine =
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
const looksLikeCurl = (query: string): boolean => query.toLowerCase().includes('curl');

export function isMissionAvailable(mission: TutorialMission, facts: TutorialMissionFacts): boolean {
  if (mission.guard === 'requires-active-workout') return facts.hasActiveWorkout === true;
  if (mission.guard === 'requires-no-active-workout') return facts.hasActiveWorkout === false;
  return mission.guard === 'always';
}

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
const CAMPAIGN_PREPARE: TutorialMission = {
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
const CAMPAIGN_WORKOUT: TutorialMission = {
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

const RECOVER: TutorialMission = {
  id: 'TUT-REC-01',
  routePrefix: '/',
  titleKey: 'tutorial.mission.recovery.title',
  guard: 'external',
  steps: [
    {
      id: 'recover',
      screen: 'anywhere',
      reach: 'navigate',
      targetId: 'active-workout-bar',
      instructionKey: 'tutorial.mission.recovery.instruction',
      clipId: 'mission-recovery-1',
      detailKey: 'tutorial.mission.recovery.detail',
      advance: onEvent(eventIs('stale-workout-choice')),
    },
  ],
  nextMissionId: null,
};

const ROUTINE_CREATE: TutorialMission = {
  id: 'TUT-ROU-01',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineCreate.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'create',
      screen: 'routines',
      reach: 'navigate',
      targetId: 'routine-create',
      instructionKey: 'tutorial.mission.routineCreate.instruction',
      clipId: 'mission-routine-create-1',
      detailKey: 'tutorial.mission.routineCreate.detail',
      advance: onEvent(eventIs('routine-created')),
    },
  ],
  nextMissionId: 'TUT-ROU-02',
};

const ROUTINE_EXERCISE: TutorialMission = {
  id: 'TUT-ROU-02',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineExercise.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'add-exercise',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-add-exercise',
      instructionKey: 'tutorial.mission.routineExercise.instruction',
      clipId: 'mission-routine-exercise-1',
      detailKey: 'tutorial.mission.routineExercise.detail',
      advance: onEvent(
        (event) => event.type === 'routine-exercise-added' && event.exerciseSlugs.length > 0,
      ),
    },
    {
      id: 'add-set',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-add-set',
      instructionKey: 'tutorial.mission.routineSet.instruction',
      clipId: 'mission-routine-set-1',
      detailKey: 'tutorial.mission.routineSet.detail',
      advance: onEvent(eventIs('routine-set-added')),
    },
  ],
  nextMissionId: 'TUT-ROU-03',
};

const ROUTINE_TARGETS: TutorialMission = {
  id: 'TUT-ROU-03',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineTargets.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'set-target',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-first-set',
      instructionKey: 'tutorial.mission.routineTargets.instruction',
      clipId: 'mission-routine-targets-1',
      detailKey: 'tutorial.mission.routineTargets.detail',
      advance: onEvent(eventIs('routine-target-updated')),
    },
    {
      id: 'set-rest',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-exercise-menu',
      instructionKey: 'tutorial.mission.routineRest.instruction',
      clipId: 'mission-routine-rest-1',
      detailKey: 'tutorial.mission.routineRest.detail',
      advance: onEvent(positiveRest),
    },
  ],
  nextMissionId: 'TUT-ROU-04',
};

const ROUTINE_START: TutorialMission = {
  id: 'TUT-ROU-04',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineStart.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'start',
      screen: 'routine-editor',
      reach: 'navigate',
      targetId: 'routine-start',
      instructionKey: 'tutorial.mission.routineStart.instruction',
      clipId: 'mission-routine-start-1',
      detailKey: 'tutorial.mission.routineStart.detail',
      advance: onEvent(eventIs('workout-started')),
    },
  ],
  nextMissionId: 'TUT-WRK-01',
};

const WORKOUT_INPUT: TutorialMission = {
  id: 'TUT-WRK-01',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setInput.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'write',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set',
      instructionKey: 'tutorial.mission.setInput.instruction',
      clipId: 'mission-set-input-1',
      detailKey: 'tutorial.mission.setInput.detail',
      advance: onEvent(recordableSet),
    },
  ],
  nextMissionId: 'TUT-WRK-02',
};

const WORKOUT_VALIDATE: TutorialMission = {
  id: 'TUT-WRK-02',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setValidate.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'complete',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-first-set-complete',
      instructionKey: 'tutorial.mission.setValidate.instruction',
      clipId: 'mission-set-validate-1',
      detailKey: 'tutorial.mission.setValidate.detail',
      advance: onEvent(eventIs('workout-set-completed')),
    },
  ],
  nextMissionId: 'TUT-WRK-03',
};

const WORKOUT_REST: TutorialMission = {
  id: 'TUT-WRK-03',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.rest.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'rest',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-rest',
      instructionKey: 'tutorial.mission.rest.instruction',
      clipId: 'mission-rest-1',
      detailKey: 'tutorial.mission.rest.detail',
      advance: onEvent(eventIs('rest-finished')),
    },
  ],
  nextMissionId: 'TUT-WRK-04',
};

const WORKOUT_FINISH: TutorialMission = {
  id: 'TUT-WRK-04',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.workoutFinish.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-finish',
      screen: 'workout',
      reach: 'navigate',
      targetId: 'workout-finish',
      instructionKey: 'tutorial.mission.workoutFinish.instruction',
      clipId: 'mission-workout-finish-1',
      detailKey: 'tutorial.mission.workoutFinish.detail',
      advance: onEvent(eventIs('workout-finish-opened')),
    },
    {
      id: 'save',
      screen: 'workout-finish',
      reach: 'wait',
      targetId: 'workout-save',
      instructionKey: 'tutorial.mission.workoutSave.instruction',
      clipId: 'mission-workout-save-1',
      detailKey: 'tutorial.mission.workoutSave.detail',
      advance: onEvent(eventIs('workout-saved')),
    },
  ],
  nextMissionId: 'TUT-DAT-01',
};

const BACKUP_EXPORT: TutorialMission = {
  id: 'TUT-DAT-01',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupExport.title',
  guard: 'always',
  steps: [
    {
      id: 'export',
      screen: 'settings',
      reach: 'wait',
      targetId: 'backup-export',
      instructionKey: 'tutorial.mission.backupExport.instruction',
      clipId: 'mission-backup-export-1',
      detailKey: 'tutorial.mission.backupExport.detail',
      advance: onEvent(eventIs('backup-exported')),
    },
  ],
  nextMissionId: 'TUT-DAT-02',
};

const BACKUP_RESTORE: TutorialMission = {
  id: 'TUT-DAT-02',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupRestore.title',
  guard: 'always',
  steps: [
    {
      id: 'restore',
      screen: 'settings',
      reach: 'wait',
      targetId: 'backup-restore',
      instructionKey: 'tutorial.mission.backupRestore.instruction',
      clipId: 'mission-backup-restore-1',
      detailKey: 'tutorial.mission.backupRestore.detail',
      advance: onEvent(eventIs('restore-confirmation-opened')),
    },
  ],
  nextMissionId: null,
};

export const P1_MISSIONS: readonly TutorialMission[] = [
  CAMPAIGN_PREPARE,
  CAMPAIGN_WORKOUT,
  RECOVER,
  ROUTINE_CREATE,
  ROUTINE_EXERCISE,
  ROUTINE_TARGETS,
  ROUTINE_START,
  WORKOUT_INPUT,
  WORKOUT_VALIDATE,
  WORKOUT_REST,
  WORKOUT_FINISH,
  BACKUP_EXPORT,
  BACKUP_RESTORE,
];

export function missionFor(id: TutorialMissionId): TutorialMission {
  const mission = P1_MISSIONS.find((candidate) => candidate.id === id);
  if (mission === undefined) throw new Error(`Unknown tutorial mission: ${id}`);
  return mission;
}

/**
 * L'étape en cours, ou `null` quand la mission est finie ou absente.
 *
 * L'index vit dans l'état et le catalogue peut changer entre deux versions :
 * la lecture est donc faite ici, une fois, plutôt que ré-indexée sur place par
 * chaque appelant.
 */
export function stepOf(
  mission: TutorialMission | null,
  stepIndex: number,
): TutorialMissionStep | null {
  return mission?.steps[stepIndex] ?? null;
}

/**
 * Peut-on seulement jouer cette mission depuis ici ?
 *
 * L'aide de la page proposait « Ajouter un exercice » depuis la **liste** des
 * routines : la mission démarrait, le coach parlait, et sa cible vivait dans un
 * éditeur qu'aucune routine retenue ne permettait d'ouvrir. Une mission dont on
 * ne sait pas rejoindre la première étape n'est pas proposée du tout.
 */
export function isMissionReachable(
  mission: TutorialMission,
  context: TutorialRouteContext,
): boolean {
  const first = mission.steps[0];
  if (first === undefined) return false;
  return first.screen === 'anywhere' || pathForScreen(first.screen, context) !== null;
}

/** Ce que la progression sait des adresses dynamiques, sous la forme attendue. */
export function routeContextOf(state: TutorialStateV3): TutorialRouteContext {
  return { routineId: state.missionRoutineId, programId: state.missionProgramId };
}

export function contextualMissionsForPath(
  pathname: string,
  state: TutorialStateV3,
  facts: TutorialMissionFacts,
): readonly TutorialMission[] {
  const context = routeContextOf(state);
  return P1_MISSIONS.filter(
    (mission) =>
      mission.id !== 'TUT-CAM-01' &&
      mission.id !== 'TUT-CAM-02' &&
      mission.id !== 'TUT-REC-01' &&
      pathname.startsWith(mission.routePrefix) &&
      isMissionAvailable(mission, facts) &&
      state.missions[mission.id] !== 'completed' &&
      isMissionReachable(mission, context),
  );
}
