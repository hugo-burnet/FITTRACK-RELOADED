import { eventIs, MANUAL, onEvent, type TutorialMission } from './kit';

/**
 * Retrouver une séance, par la voie qu'on préfère.
 *
 * Trois entrées mènent à la même séance — la vue calendrier, un jour, un
 * exercice — et l'écran ne dit nulle part qu'elles se combinent. La mission les
 * fait toutes les trois, puis ouvre le résultat.
 */
export const HISTORY_FIND: TutorialMission = {
  id: 'TUT-HIS-01',
  routePrefix: '/history',
  titleKey: 'tutorial.history.find.title',
  guard: 'requires-history',
  steps: [
    {
      id: 'calendar-view',
      screen: 'history',
      reach: 'navigate',
      targetId: 'history-view-calendar',
      instructionKey: 'tutorial.history.calendarView.instruction',
      detailKey: 'tutorial.history.calendarView.detail',
      advance: onEvent(
        (event) => event.type === 'history-view-changed' && event.view === 'calendar',
      ),
    },
    {
      id: 'pick-day',
      screen: 'history',
      reach: 'navigate',
      targetId: 'history-calendar-grid',
      instructionKey: 'tutorial.history.pickDay.instruction',
      detailKey: 'tutorial.history.pickDay.detail',
      advance: onEvent(eventIs('history-day-selected')),
    },
    {
      id: 'filter-exercise',
      screen: 'history',
      reach: 'navigate',
      targetId: 'history-exercise-filter',
      instructionKey: 'tutorial.history.filterExercise.instruction',
      detailKey: 'tutorial.history.filterExercise.detail',
      advance: onEvent(
        (event) => event.type === 'history-exercise-filter-changed' && event.exerciseId !== null,
      ),
    },
    {
      id: 'open-workout',
      screen: 'history',
      reach: 'navigate',
      targetId: 'history-first-workout',
      instructionKey: 'tutorial.history.openWorkout.instruction',
      detailKey: 'tutorial.history.openWorkout.detail',
      advance: onEvent(eventIs('history-workout-opened')),
      // La séance ouverte devient celle dont les deux missions suivantes
      // parlent : sans elle, `/history/:id` n'est pas une adresse.
      remember: (state, event) =>
        event.type === 'history-workout-opened'
          ? { ...state, missionWorkoutId: event.workoutId }
          : state,
    },
  ],
  nextMissionId: null,
};

/**
 * Corriger une séance déjà enregistrée.
 *
 * L'édition rétroactive écrase : les séries absentes du brouillon sont
 * supprimées à l'enregistrement. La mission le dit avant de faire enregistrer,
 * pas après.
 */
export const HISTORY_EDIT: TutorialMission = {
  id: 'TUT-HIS-02',
  routePrefix: '/history',
  titleKey: 'tutorial.history.edit.title',
  guard: 'requires-history',
  steps: [
    {
      id: 'open-actions',
      screen: 'history-detail',
      reach: 'navigate',
      targetId: 'history-detail-actions',
      instructionKey: 'tutorial.history.openActions.instruction',
      detailKey: 'tutorial.history.openActions.detail',
      advance: onEvent(eventIs('history-actions-opened')),
    },
    {
      id: 'open-edit',
      screen: 'history-detail',
      reach: 'navigate',
      targetId: 'history-edit',
      instructionKey: 'tutorial.history.openEdit.instruction',
      detailKey: 'tutorial.history.openEdit.detail',
      advance: onEvent(eventIs('history-edit-opened')),
    },
    {
      id: 'save-edit',
      screen: 'history-edit',
      reach: 'navigate',
      targetId: 'history-edit-save',
      instructionKey: 'tutorial.history.saveEdit.instruction',
      detailKey: 'tutorial.history.saveEdit.detail',
      advance: onEvent(eventIs('history-edit-saved')),
    },
  ],
  nextMissionId: null,
};

/**
 * Sortir une séance de l'application.
 *
 * La même feuille porte « Supprimer ». La mission s'arrête sur une étape qui le
 * nomme et n'y touche pas : montrer où vit un geste irréversible fait partie de
 * la leçon, le déclencher non.
 */
export const HISTORY_SHARE: TutorialMission = {
  id: 'TUT-HIS-03',
  routePrefix: '/history',
  titleKey: 'tutorial.history.share.title',
  guard: 'requires-history',
  steps: [
    {
      id: 'open-actions',
      screen: 'history-detail',
      reach: 'navigate',
      targetId: 'history-detail-actions',
      instructionKey: 'tutorial.history.shareActions.instruction',
      detailKey: 'tutorial.history.shareActions.detail',
      advance: onEvent(eventIs('history-actions-opened')),
    },
    {
      id: 'share',
      screen: 'history-detail',
      reach: 'navigate',
      targetId: 'history-share',
      instructionKey: 'tutorial.history.shareAction.instruction',
      detailKey: 'tutorial.history.shareAction.detail',
      advance: onEvent(eventIs('history-share-opened')),
    },
    {
      id: 'delete-lives-here',
      screen: 'history-detail',
      reach: 'navigate',
      targetId: 'history-detail-actions',
      instructionKey: 'tutorial.history.deleteLivesHere.instruction',
      detailKey: 'tutorial.history.deleteLivesHere.detail',
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
};

/**
 * Reprendre un historique Hevy.
 *
 * La mission s'arrête sur la revue. « Importer » écrit des centaines de séances
 * d'un coup : c'est le geste le plus lourd de l'application, et il appartient à
 * celui qui a relu ce qu'il s'apprête à écrire.
 */
export const HEVY_IMPORT: TutorialMission = {
  id: 'TUT-IMP-01',
  routePrefix: '/history',
  titleKey: 'tutorial.history.import.title',
  guard: 'always',
  steps: [
    {
      id: 'open-import',
      screen: 'history',
      reach: 'navigate',
      targetId: 'history-import',
      instructionKey: 'tutorial.history.openImport.instruction',
      detailKey: 'tutorial.history.openImport.detail',
      advance: onEvent(eventIs('hevy-import-opened')),
    },
    {
      id: 'choose-file',
      screen: 'history-import',
      reach: 'navigate',
      targetId: 'hevy-choose-file',
      instructionKey: 'tutorial.history.chooseFile.instruction',
      detailKey: 'tutorial.history.chooseFile.detail',
      advance: onEvent(eventIs('hevy-file-parsed')),
    },
    {
      id: 'review',
      screen: 'history-import',
      reach: 'navigate',
      targetId: 'hevy-continue',
      instructionKey: 'tutorial.history.review.instruction',
      detailKey: 'tutorial.history.review.detail',
      advance: onEvent(eventIs('hevy-review-opened')),
    },
    {
      id: 'yours-to-press',
      screen: 'history-import',
      reach: 'navigate',
      targetId: 'hevy-submit',
      instructionKey: 'tutorial.history.yoursToPress.instruction',
      detailKey: 'tutorial.history.yoursToPress.detail',
      advance: MANUAL,
    },
  ],
  nextMissionId: null,
};
