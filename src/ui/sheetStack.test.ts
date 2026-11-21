import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeTopSheet, hasOpenSheet, registerSheet } from './sheetStack';

const unregister: Array<() => void> = [];
afterEach(() => {
  while (unregister.length > 0) unregister.pop()?.();
});
const add = (close: () => void) => {
  const off = registerSheet(close);
  unregister.push(off);
  return off;
};

describe('sheetStack', () => {
  it('reports no open sheet when nothing is registered', () => {
    expect(hasOpenSheet()).toBe(false);
    expect(closeTopSheet()).toBe(false);
  });

  it('closes the most recently opened sheet only', () => {
    const bottom = vi.fn();
    const top = vi.fn();
    add(bottom);
    add(top);
    expect(hasOpenSheet()).toBe(true);
    expect(closeTopSheet()).toBe(true);
    expect(top).toHaveBeenCalledOnce();
    expect(bottom).not.toHaveBeenCalled();
  });

  it('forgets a sheet once it unregisters', () => {
    const off = add(vi.fn());
    off();
    expect(hasOpenSheet()).toBe(false);
  });

  it('unregistering twice is harmless', () => {
    const off = add(vi.fn());
    off();
    off();
    expect(hasOpenSheet()).toBe(false);
  });
});
