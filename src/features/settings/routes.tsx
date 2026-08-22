import { lazyRoute } from '@/app/lazyRoute';

/**
 * The two screens behind the settings, loaded on demand.
 *
 * Neither is on any daily path: the debug screen counts rows and empties the
 * database, the credits list licences. `SettingsScreen` itself stays eager —
 * it is one tap from the header of every screen.
 */

export const DebugRoute = lazyRoute(() => import('./DebugScreen'), 'DebugScreen');

export const CreditsRoute = lazyRoute(() => import('./CreditsScreen'), 'CreditsScreen');
