import { lazyRoute } from '@/app/lazyRoute';

// The evidence corpus weighs much more than an ordinary screen. Keep it out of
// the daily workout path and load it only when the user opens the navigator.
export const KnowledgeRoute = lazyRoute(() => import('./KnowledgeScreen'), 'KnowledgeScreen');

// Une section est une page de lecture : elle ne sert que si on vient du
// sommaire ou d'un résultat, donc elle se charge à la demande comme l'écran
// qui la précède.
export const WikiSectionRoute = lazyRoute(
  () => import('./WikiSectionScreen'),
  'WikiSectionScreen',
);

export const WikiQuestionsRoute = lazyRoute(
  () => import('./WikiQuestionsScreen'),
  'WikiQuestionsScreen',
);

export const WikiProgrammingRoute = lazyRoute(
  () => import('./WikiProgrammingScreen'),
  'WikiProgrammingScreen',
);
