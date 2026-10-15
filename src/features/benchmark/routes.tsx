import { lazyRoute } from '@/app/lazyRoute';

/**
 * Le bilan d'un benchmark, chargé à la demande : la séance en direct ne doit pas
 * payer son JavaScript, cf. `features/measurements/routes.tsx`.
 */
export const BenchmarkRoute = lazyRoute(() => import('./BenchmarkScreen'), 'BenchmarkScreen');
