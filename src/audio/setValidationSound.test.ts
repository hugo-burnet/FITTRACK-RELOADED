import { afterEach, describe, expect, it, vi } from 'vitest';

const announce = vi.hoisted(() => vi.fn(() => true));
const playSetImpact = vi.hoisted(() => vi.fn(() => true));
vi.mock('./announce', () => ({ announce }));
vi.mock('./screenGlitch', () => ({ playSetImpact }));

const { announceSetValidation } = await import('./setValidationSound');

describe('announceSetValidation', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });

  it('announces the cue and strikes the impact, every time, in the Cyber theme', () => {
    document.documentElement.setAttribute('data-theme', 'cyber');

    announceSetValidation('exercise-cleared');
    announceSetValidation('exercise-cleared');

    expect(announce).toHaveBeenCalledTimes(2);
    expect(playSetImpact).toHaveBeenCalledTimes(2);
  });

  it('only announces in the other themes', () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    announceSetValidation('set-validated');

    expect(announce).toHaveBeenCalledWith('set-validated');
    expect(playSetImpact).not.toHaveBeenCalled();
  });
});
