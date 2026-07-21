import { createHashRouter } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { ExerciseDetailScreen } from './features/exercises/ExerciseDetailScreen';
import { ExerciseFormScreen } from './features/exercises/ExerciseFormScreen';
import { ExercisesScreen } from './features/exercises/ExercisesScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { RoutinesScreen } from './features/routines/RoutinesScreen';
import { DebugScreen } from './features/settings/DebugScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';

// createHashRouter, not createBrowserRouter (ADR-003): GitHub Pages 404s on any
// deep URL, and the Capacitor WebView is not served over https either.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'routines', element: <RoutinesScreen /> },
      { path: 'history', element: <HistoryScreen /> },
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
