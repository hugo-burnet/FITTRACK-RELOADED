export type BackDecision =
  { kind: 'history' } | { kind: 'navigate'; to: string } | { kind: 'exit' };

const EXACT_PARENTS = new Map<string, string>([
  ['/workout/add', '/workout'],
  ['/workout/finish', '/workout'],
  ['/workout', '/'],
  ['/history/import', '/history'],
  ['/exercises/new', '/exercises'],
  ['/settings/debug', '/settings'],
  ['/settings', '/'],
]);

const ROOT_ROUTES = new Set(['/', '/routines', '/history', '/analytics', '/exercises']);

export function androidBackDecision(pathname: string, canGoBack: boolean): BackDecision {
  if (canGoBack) return { kind: 'history' };

  const exactParent = EXACT_PARENTS.get(pathname);
  if (exactParent) return { kind: 'navigate', to: exactParent };
  if (ROOT_ROUTES.has(pathname)) return { kind: 'exit' };

  const routineAdd = pathname.match(/^\/routines\/([^/]+)\/add$/);
  if (routineAdd) return { kind: 'navigate', to: `/routines/${routineAdd[1]}` };
  if (/^\/routines\/[^/]+$/.test(pathname)) return { kind: 'navigate', to: '/routines' };
  if (/^\/history\/[^/]+(?:\/edit)?$/.test(pathname)) {
    return { kind: 'navigate', to: '/history' };
  }
  if (pathname.startsWith('/analytics/')) return { kind: 'navigate', to: '/analytics' };
  if (/^\/exercises\/[^/]+(?:\/edit)?$/.test(pathname)) {
    return { kind: 'navigate', to: '/exercises' };
  }

  const depth = pathname.split('/').filter(Boolean).length;
  return depth > 1 ? { kind: 'navigate', to: '/' } : { kind: 'exit' };
}
