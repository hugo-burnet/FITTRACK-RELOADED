import { lazyRoute } from '@/app/lazyRoute';

/**
 * The programme screens, loaded on demand.
 *
 * A block is set up once and then followed from the home screen and the session
 * — nothing in the daily loop opens the editor, and the tab bar has no sixth
 * tab pointing here (§12.1). The three screens and their editor model are
 * therefore paid for by whoever actually walks into them.
 */

export const ProgramListRoute = lazyRoute(
  () => import('./ProgramListScreen'),
  'ProgramListScreen',
);

export const ProgramDetailRoute = lazyRoute(
  () => import('./ProgramDetailScreen'),
  'ProgramDetailScreen',
);

export const ProgramEditorRoute = lazyRoute(
  () => import('./ProgramEditorScreen'),
  'ProgramEditorScreen',
);
