import { createHashRouter } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import {
  AnalyticsRoute,
  ExerciseAnalyticsRoute,
  MonthlyReportRoute,
  MuscleBalanceRoute,
  RecordsRoute,
  WeeklySessionsRoute,
  WeeklyVolumeRoute,
} from './features/analytics/routes';
import {
  HevyImportRoute,
  HistoryDetailRoute,
  HistoryEditRoute,
} from './features/history/routes';
import {
  ProgramDetailRoute,
  ProgramEditorRoute,
  ProgramListRoute,
} from './features/programs/routes';
import { CreditsRoute, DebugRoute } from './features/settings/routes';
import { ExerciseDetailRoute, ExerciseFormRoute } from './features/exercises/routes';
import { ExercisesScreen } from './features/exercises/ExercisesScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { HomeScreen } from './features/home/HomeScreen';
import {
  KnowledgeRoute,
  LearnProgrammingRoute,
  WikiArticleRoute,
  WikiProgrammingRoute,
  WikiQuestionsRoute,
  WikiSectionRoute,
} from './features/knowledge/routes';
import { MilestonesRoute } from './features/milestones/routes';
import { ExercisePickerRoute, RoutineEditorRoute } from './features/routines/routes';
import { RoutinesScreen } from './features/routines/RoutinesScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { WorkoutAddExerciseScreen } from './features/workout/WorkoutAddExerciseScreen';
import { WorkoutFinishScreen } from './features/workout/WorkoutFinishScreen';
import { WorkoutScreen } from './features/workout/WorkoutScreen';

// createHashRouter, not createBrowserRouter (ADR-003): GitHub Pages 404s on any
// deep URL, and the Capacitor WebView is not served over https either.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'routines', element: <RoutinesScreen /> },
      { path: 'programs', element: <ProgramListRoute /> },
      { path: 'programs/new', element: <ProgramEditorRoute /> },
      { path: 'programs/:id', element: <ProgramDetailRoute /> },
      { path: 'programs/:id/edit', element: <ProgramEditorRoute /> },
      // A routine's screen is its editor: everything is written as it is typed,
      // so there is no read-only view to separate from it.
      { path: 'routines/:id', element: <RoutineEditorRoute /> },
      { path: 'routines/:id/add', element: <ExercisePickerRoute /> },
      // No id in the path: the active session *is* the query, which is what
      // makes resuming after a kill free (RF-25). Reading a past session is
      // Lot 7, and it will have its own route.
      { path: 'workout', element: <WorkoutScreen /> },
      { path: 'workout/add', element: <WorkoutAddExerciseScreen /> },
      { path: 'workout/finish', element: <WorkoutFinishScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'history/import', element: <HevyImportRoute /> },
      { path: 'history/:workoutId/edit', element: <HistoryEditRoute /> },
      { path: 'history/:workoutId', element: <HistoryDetailRoute /> },
      // Pas de sixième onglet (§12.1) : la barre en compte cinq depuis le Lot 1.
      // On entre par l'Historique et par la fiche d'un exercice.
      { path: 'analytics', element: <AnalyticsRoute /> },
      { path: 'analytics/records', element: <RecordsRoute /> },
      { path: 'analytics/milestones', element: <MilestonesRoute /> },
      { path: 'analytics/weekly', element: <WeeklySessionsRoute /> },
      { path: 'analytics/volume', element: <WeeklyVolumeRoute /> },
      { path: 'analytics/muscles', element: <MuscleBalanceRoute /> },
      { path: 'analytics/months', element: <MonthlyReportRoute /> },
      { path: 'analytics/exercises/:exerciseId', element: <ExerciseAnalyticsRoute /> },
      { path: 'exercises', element: <ExercisesScreen /> },
      // Static before dynamic. React Router ranks them that way on its own, but
      // reading `new` as an exercise id would be a very confusing bug.
      { path: 'exercises/new', element: <ExerciseFormRoute /> },
      { path: 'exercises/:id', element: <ExerciseDetailRoute /> },
      { path: 'exercises/:id/edit', element: <ExerciseFormRoute /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'knowledge', element: <KnowledgeRoute /> },
      { path: 'knowledge/apprendre', element: <LearnProgrammingRoute /> },
      { path: 'knowledge/questions', element: <WikiQuestionsRoute /> },
      { path: 'knowledge/programmation', element: <WikiProgrammingRoute /> },
      { path: 'knowledge/programmation/:articleId', element: <WikiArticleRoute /> },
      { path: 'knowledge/a/:articleId', element: <WikiArticleRoute /> },
      { path: 'knowledge/s/:sectionId', element: <WikiSectionRoute /> },
      { path: 'settings/debug', element: <DebugRoute /> },
      { path: 'settings/about', element: <CreditsRoute /> },
    ],
  },
]);
