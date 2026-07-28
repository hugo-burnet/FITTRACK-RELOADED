import { createHashRouter } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import {
  AnalyticsRoute,
  ExerciseAnalyticsRoute,
  MuscleBalanceRoute,
  WeeklySessionsRoute,
  WeeklyVolumeRoute,
} from './features/analytics/routes';
import { ExerciseDetailScreen } from './features/exercises/ExerciseDetailScreen';
import { ExerciseFormScreen } from './features/exercises/ExerciseFormScreen';
import { ExercisesScreen } from './features/exercises/ExercisesScreen';
import { HistoryDetailScreen } from './features/history/HistoryDetailScreen';
import { HistoryEditScreen } from './features/history/HistoryEditScreen';
import { HevyImportScreen } from './features/history/HevyImportScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { ExercisePickerScreen } from './features/routines/ExercisePickerScreen';
import { RoutineEditorScreen } from './features/routines/RoutineEditorScreen';
import { RoutinesScreen } from './features/routines/RoutinesScreen';
import { DebugScreen } from './features/settings/DebugScreen';
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
      // A routine's screen is its editor: everything is written as it is typed,
      // so there is no read-only view to separate from it.
      { path: 'routines/:id', element: <RoutineEditorScreen /> },
      { path: 'routines/:id/add', element: <ExercisePickerScreen /> },
      // No id in the path: the active session *is* the query, which is what
      // makes resuming after a kill free (RF-25). Reading a past session is
      // Lot 7, and it will have its own route.
      { path: 'workout', element: <WorkoutScreen /> },
      { path: 'workout/add', element: <WorkoutAddExerciseScreen /> },
      { path: 'workout/finish', element: <WorkoutFinishScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'history/import', element: <HevyImportScreen /> },
      { path: 'history/:workoutId/edit', element: <HistoryEditScreen /> },
      { path: 'history/:workoutId', element: <HistoryDetailScreen /> },
      // Pas de sixième onglet (§12.1) : la barre en compte cinq depuis le Lot 1.
      // On entre par l'Historique et par la fiche d'un exercice.
      { path: 'analytics', element: <AnalyticsRoute /> },
      { path: 'analytics/weekly', element: <WeeklySessionsRoute /> },
      { path: 'analytics/volume', element: <WeeklyVolumeRoute /> },
      { path: 'analytics/muscles', element: <MuscleBalanceRoute /> },
      { path: 'analytics/exercises/:exerciseId', element: <ExerciseAnalyticsRoute /> },
      { path: 'exercises', element: <ExercisesScreen /> },
      // Static before dynamic. React Router ranks them that way on its own, but
      // reading `new` as an exercise id would be a very confusing bug.
      { path: 'exercises/new', element: <ExerciseFormScreen /> },
      { path: 'exercises/:id', element: <ExerciseDetailScreen /> },
      { path: 'exercises/:id/edit', element: <ExerciseFormScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'settings/debug', element: <DebugScreen /> },
    ],
  },
]);
