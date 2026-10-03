import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from './reducedMotion';

/** jsdom n'implémente pas matchMedia : chaque test pose le monde qu'il veut. */
function installMatchMedia(value: unknown) {
  Object.defineProperty(window, 'matchMedia', { value, configurable: true, writable: true });
}

describe('prefersReducedMotion', () => {
  afterEach(() => installMatchMedia(undefined));

  it('is false rather than throwing where matchMedia does not exist, which is jsdom', () => {
    expect(window.matchMedia).toBeUndefined();
    expect(prefersReducedMotion()).toBe(false);
  });

  it('asks the one question the stylesheet asks', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    installMatchMedia(matchMedia);

    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('is false when the lifter has not asked for less motion', () => {
    installMatchMedia(vi.fn().mockReturnValue({ matches: false }));

    expect(prefersReducedMotion()).toBe(false);
  });
});
