import { createHashRouter } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { ExercisesScreen } from './features/exercises/ExercisesScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { RoutinesScreen } from './features/routines/RoutinesScreen';
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
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);
