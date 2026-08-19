import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCER_STORAGE_KEY, applyAnnouncerMode, loadAnnouncerMode } from './announcer';

const setAudioVolume = vi.hoisted(() => vi.fn());

vi.mock('@/audio/context', () => ({ setAudioVolume }));

describe('réglage des annonces', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('parle par défaut', async () => {
    vi.resetModules();
    const store = await import('./announcer');
    expect(store.loadAnnouncerMode()).toBe('voice');
  });

  it('mémorise le mode choisi', () => {
    applyAnnouncerMode('sounds');
    expect(localStorage.getItem(ANNOUNCER_STORAGE_KEY)).toBe('sounds');
    expect(loadAnnouncerMode()).toBe('sounds');
  });

  it('coupe le bus en silence, le rouvre autrement', () => {
    applyAnnouncerMode('silence');
    expect(setAudioVolume).toHaveBeenLastCalledWith(0);
    applyAnnouncerMode('voice');
    expect(setAudioVolume).toHaveBeenLastCalledWith(1);
  });

  it('ignore une valeur inconnue en base', async () => {
    localStorage.setItem(ANNOUNCER_STORAGE_KEY, 'trompette');
    vi.resetModules();
    const store = await import('./announcer');
    expect(store.loadAnnouncerMode()).toBe('voice');
  });
});
