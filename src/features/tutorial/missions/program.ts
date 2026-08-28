import { eventIs, MANUAL, onEvent, type TutorialMission } from './kit';

/**
 * Le chapitre des blocs, de la création au suivi.
 *
 * Il ne se confond plus avec Routines : une routine décrit une séance, un
 * programme organise plusieurs routines dans le temps, et l'aide de `/programs`
 * expliquait jusqu'ici la liste des routines.
 *
 * Les trois étapes de l'assistant partagent l'adresse `/programs/new` et la même
 * bande au pied de l'écran — c'est le code qui en décide, pas le tutoriel : la
 * même ancre y sert trois fois, sous trois libellés différents.
 *
 * Aucune étape n'ouvre une confirmation destructive. L'avant-dernière ouvre le
 * menu, qui *montre* Décaler, Terminer et Supprimer ; les exécuter est une
 * décision, pas une leçon.
 */
export const PROGRAM: TutorialMission = {
  id: 'TUT-PRG-01',
  routePrefix: '/programs',
  titleKey: 'tutorial.program.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'what-is-a-block',
      screen: 'programs',
      reach: 'navigate',
      targetId: 'program-create',
      instructionKey: 'tutorial.program.whatIsABlock.instruction',
      detailKey: 'tutorial.program.whatIsABlock.detail',
      advance: MANUAL,
    },
    {
      id: 'open-wizard',
      screen: 'programs',
      reach: 'navigate',
      targetId: 'program-create',
      instructionKey: 'tutorial.program.openWizard.instruction',
      detailKey: 'tutorial.program.openWizard.detail',
      advance: onEvent(eventIs('program-create-opened')),
    },
    {
      id: 'name-block',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-name',
      instructionKey: 'tutorial.program.nameBlock.instruction',
      detailKey: 'tutorial.program.nameBlock.detail',
      advance: onEvent(
        (event) => event.type === 'program-basics-named' && event.name.trim().length > 0,
      ),
    },
    {
      id: 'start-date',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-start-date',
      instructionKey: 'tutorial.program.startDate.instruction',
      detailKey: 'tutorial.program.startDate.detail',
      advance: onEvent(eventIs('program-basics-dated')),
    },
    {
      id: 'duration',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-duration',
      instructionKey: 'tutorial.program.duration.instruction',
      detailKey: 'tutorial.program.duration.detail',
      advance: onEvent(eventIs('program-basics-duration-set')),
    },
    {
      id: 'save-basics',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-step-continue',
      instructionKey: 'tutorial.program.saveBasics.instruction',
      detailKey: 'tutorial.program.saveBasics.detail',
      advance: onEvent(eventIs('program-draft-created')),
      // Le brouillon n'entre dans l'URL qu'à l'activation : sans cette prise,
      // les étapes suivantes ne sauraient pas de quel bloc elles parlent.
      remember: (state, event) =>
        event.type === 'program-draft-created'
          ? { ...state, missionProgramId: event.programId }
          : state,
    },
    {
      id: 'split-day',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-split-day',
      instructionKey: 'tutorial.program.splitDay.instruction',
      detailKey: 'tutorial.program.splitDay.detail',
      advance: onEvent(eventIs('program-split-day-set')),
    },
    {
      id: 'split-routine',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-split-routine',
      instructionKey: 'tutorial.program.splitRoutine.instruction',
      detailKey: 'tutorial.program.splitRoutine.detail',
      advance: onEvent(
        (event) => event.type === 'program-split-routine-set' && event.routineId !== '',
      ),
    },
    {
      id: 'split-more',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-split-add',
      instructionKey: 'tutorial.program.splitMore.instruction',
      detailKey: 'tutorial.program.splitMore.detail',
      // Montré, pas imposé : un bloc à une séance par semaine est un bloc.
      advance: MANUAL,
    },
    {
      id: 'save-split',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-step-continue',
      instructionKey: 'tutorial.program.saveSplit.instruction',
      detailKey: 'tutorial.program.saveSplit.detail',
      advance: onEvent((event) => event.type === 'program-split-saved' && event.entries > 0),
    },
    {
      id: 'recipe',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-recipe',
      instructionKey: 'tutorial.program.recipe.instruction',
      detailKey: 'tutorial.program.recipe.detail',
      advance: onEvent(eventIs('program-recipe-applied')),
    },
    {
      id: 'week-sheet',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-week-row',
      instructionKey: 'tutorial.program.weekSheet.instruction',
      detailKey: 'tutorial.program.weekSheet.detail',
      advance: onEvent(eventIs('program-week-opened')),
    },
    {
      id: 'activate',
      screen: 'program-editor',
      reach: 'navigate',
      targetId: 'program-step-continue',
      instructionKey: 'tutorial.program.activate.instruction',
      detailKey: 'tutorial.program.activate.detail',
      advance: onEvent(
        (event, state) =>
          event.type === 'program-activated' &&
          (state.missionProgramId === null || event.programId === state.missionProgramId),
      ),
    },
    {
      id: 'read-week',
      screen: 'program-detail',
      reach: 'navigate',
      targetId: 'program-intention',
      instructionKey: 'tutorial.program.readWeek.instruction',
      detailKey: 'tutorial.program.readWeek.detail',
      advance: MANUAL,
    },
    {
      id: 'pick-session',
      screen: 'program-detail',
      reach: 'navigate',
      targetId: 'program-session-list',
      instructionKey: 'tutorial.program.pickSession.instruction',
      detailKey: 'tutorial.program.pickSession.detail',
      advance: onEvent(eventIs('program-session-selected')),
    },
    {
      id: 'upcoming',
      screen: 'program-detail',
      reach: 'navigate',
      targetId: 'program-upcoming',
      instructionKey: 'tutorial.program.upcoming.instruction',
      detailKey: 'tutorial.program.upcoming.detail',
      advance: MANUAL,
    },
    {
      id: 'actions-menu',
      screen: 'program-detail',
      reach: 'navigate',
      targetId: 'program-actions',
      instructionKey: 'tutorial.program.actionsMenu.instruction',
      detailKey: 'tutorial.program.actionsMenu.detail',
      advance: onEvent(eventIs('program-actions-opened')),
    },
    {
      id: 'before-start',
      screen: 'program-detail',
      reach: 'navigate',
      targetId: 'program-start',
      instructionKey: 'tutorial.program.beforeStart.instruction',
      detailKey: 'tutorial.program.beforeStart.detail',
      // La dernière chose que le chapitre fait est de ne pas appuyer.
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
};
