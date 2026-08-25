import { lazyRoute } from '@/app/lazyRoute';

// The evidence corpus weighs much more than an ordinary screen. Keep it out of
// the daily workout path and load it only when the user opens the navigator.
export const KnowledgeRoute = lazyRoute(() => import('./KnowledgeScreen'), 'KnowledgeScreen');
