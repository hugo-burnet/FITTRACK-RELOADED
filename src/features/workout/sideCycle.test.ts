import { describe, expect, it } from 'vitest';
import {
  IDLE_SIDE_CYCLE,
  SIDE_CHANGE_LEAD_SECONDS,
  openSideCycle,
  sideCycleWithoutSet,
  sideStageAt,
  turnSide,
  type SideCycle,
} from './sideCycle';

describe('openSideCycle', () => {
  it('n’ouvre rien sur un exercice bilatéral', () => {
    expect(openSideCycle('s1', false)).toEqual(IDLE_SIDE_CYCLE);
  });

  it('ouvre sur le premier côté d’un exercice unilatéral', () => {
    expect(openSideCycle('s1', true)).toEqual({ kind: 'first', setId: 's1' });
  });
});

describe('sideStageAt', () => {
  it('ne dit rien pour une série qui n’est pas dans le cycle', () => {
    expect(sideStageAt(openSideCycle('s1', true), 'autre', 0)).toBeNull();
    expect(sideStageAt(IDLE_SIDE_CYCLE, 's1', 0)).toBeNull();
  });

  // Trois stades visibles, deux stockés : `transition` est `second` avant son
  // instant de reprise. Dérivé d'un instant absolu, comme toutes les horloges de
  // l'écran — pas avancé par un minuteur de plus.
  it('dérive la transition de l’instant de reprise', () => {
    const cycle: SideCycle = { kind: 'second', setId: 's1', resumesAt: 10_000 };

    expect(sideStageAt(cycle, 's1', 0)).toBe('transition');
    expect(sideStageAt(cycle, 's1', 9_999)).toBe('transition');
    expect(sideStageAt(cycle, 's1', 10_000)).toBe('second');
    expect(sideStageAt(cycle, 's1', 30_000)).toBe('second');
  });
});

describe('turnSide', () => {
  it('passe au second côté, dix secondes plus tard', () => {
    expect(SIDE_CHANGE_LEAD_SECONDS).toBe(10);
    expect(turnSide(openSideCycle('s1', true), 's1', 1_000)).toEqual({
      kind: 'change',
      cycle: { kind: 'second', setId: 's1', resumesAt: 11_000 },
    });
  });

  // La série n'est terminée qu'après le second côté.
  it('termine la série à la fin du second côté', () => {
    const second: SideCycle = { kind: 'second', setId: 's1', resumesAt: 0 };

    expect(turnSide(second, 's1', 30_000)).toEqual({ kind: 'complete' });
  });

  // Pendant les dix secondes, le second côté n'a pas commencé : le compter
  // terminerait la série sur un côté qui n'a pas eu lieu.
  it('ignore un tour pendant la transition', () => {
    const second: SideCycle = { kind: 'second', setId: 's1', resumesAt: 10_000 };

    expect(turnSide(second, 's1', 5_000)).toEqual({ kind: 'ignore' });
  });

  it('ignore une série hors cycle', () => {
    expect(turnSide(IDLE_SIDE_CYCLE, 's1', 0)).toEqual({ kind: 'ignore' });
    expect(turnSide(openSideCycle('s1', true), 'autre', 0)).toEqual({ kind: 'ignore' });
  });
});

describe('sideCycleWithoutSet', () => {
  it('referme le cycle de cette série, et laisse les autres', () => {
    const cycle = openSideCycle('s1', true);

    expect(sideCycleWithoutSet(cycle, 's1')).toEqual(IDLE_SIDE_CYCLE);
    expect(sideCycleWithoutSet(cycle, 'autre')).toEqual(cycle);
    expect(sideCycleWithoutSet(cycle)).toEqual(IDLE_SIDE_CYCLE);
    expect(sideCycleWithoutSet(IDLE_SIDE_CYCLE, 's1')).toEqual(IDLE_SIDE_CYCLE);
  });
});
