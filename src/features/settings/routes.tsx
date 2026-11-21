import { lazyRoute } from '@/app/lazyRoute';

/**
 * The screens behind the settings, loaded on demand.
 *
 * None is on a daily path: the five pages are set once, the debug screen counts rows and empties
 * the database, the credits list licences. `SettingsScreen` itself (the summary) stays eager —
 * it is one tap from the header of every screen.
 */

export const DebugRoute = lazyRoute(() => import('./DebugScreen'), 'DebugScreen');

export const CreditsRoute = lazyRoute(() => import('./CreditsScreen'), 'CreditsScreen');

export const AppearanceRoute = lazyRoute(
  () => import('./AppearanceSettingsScreen'),
  'AppearanceSettingsScreen',
);

export const SessionRoute = lazyRoute(
  () => import('./SessionSettingsScreen'),
  'SessionSettingsScreen',
);

export const CoachSettingsRoute = lazyRoute(
  () => import('./CoachSettingsScreen'),
  'CoachSettingsScreen',
);

export const BackupRoute = lazyRoute(() => import('./BackupSettingsScreen'), 'BackupSettingsScreen');

export const AppRoute = lazyRoute(() => import('./AppSettingsScreen'), 'AppSettingsScreen');

export const VolumeRoute = lazyRoute(() => import('./VolumeScreen'), 'VolumeScreen');
