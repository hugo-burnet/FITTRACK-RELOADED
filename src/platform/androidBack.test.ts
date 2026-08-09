import { describe, expect, it } from 'vitest';
import { androidBackDecision } from './androidBack';

describe('androidBackDecision', () => {
  it.each([
    ['/workout/add', '/workout'],
    ['/workout/finish', '/workout'],
    ['/workout', '/'],
    ['/routines/routine-1/add', '/routines/routine-1'],
    ['/routines/routine-1', '/routines'],
    ['/history/import', '/history'],
    ['/history/workout-1/edit', '/history'],
    ['/history/workout-1', '/history'],
    ['/analytics/weekly', '/analytics'],
    ['/analytics/exercises/exercise-1', '/analytics'],
    ['/exercises/new', '/exercises'],
    ['/exercises/exercise-1/edit', '/exercises'],
    ['/exercises/exercise-1', '/exercises'],
    ['/settings/debug', '/settings'],
    ['/settings', '/'],
  ])('navigates from %s to %s without history', (pathname, to) => {
    expect(androidBackDecision(pathname, false)).toEqual({ kind: 'navigate', to });
  });

  it('uses browser history when it is available', () => {
    expect(androidBackDecision('/workout/add', true)).toEqual({ kind: 'history' });
  });

  it.each(['/', '/routines', '/history', '/analytics', '/exercises'])(
    'exits from the tab root %s without history',
    (pathname) => {
      expect(androidBackDecision(pathname, false)).toEqual({ kind: 'exit' });
    },
  );

  it('falls back home from an unknown nested route', () => {
    expect(androidBackDecision('/unknown/nested', false)).toEqual({ kind: 'navigate', to: '/' });
  });

  it('exits from an unknown root route', () => {
    expect(androidBackDecision('/unknown', false)).toEqual({ kind: 'exit' });
  });
});
