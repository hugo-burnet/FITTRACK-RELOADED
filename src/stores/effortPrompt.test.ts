import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyEffortPrompt, EFFORT_PROMPT_STORAGE_KEY, loadEffortPrompt } from './effortPrompt';

describe('réglage de la bande d’effort', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('demande l’effort par défaut', async () => {
    const store = await import('./effortPrompt');
    expect(store.loadEffortPrompt()).toBe(true);
  });

  it('mémorise le refus', () => {
    applyEffortPrompt(false);
    expect(localStorage.getItem(EFFORT_PROMPT_STORAGE_KEY)).toBe('off');
    expect(loadEffortPrompt()).toBe(false);
  });

  it('mémorise le retour en arrière', () => {
    applyEffortPrompt(false);
    applyEffortPrompt(true);
    expect(loadEffortPrompt()).toBe(true);
  });
});
