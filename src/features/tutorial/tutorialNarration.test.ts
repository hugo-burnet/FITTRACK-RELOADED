import { afterEach, describe, expect, it } from 'vitest';
import { ANNOUNCER_STORAGE_KEY, applyAnnouncerMode } from '@/stores/announcer';
import { playTutorialNarration } from './tutorialNarration';

/**
 * Le point où le mode Silence est réellement tenu pour la narration.
 *
 * Les annonces de séance sont filtrées par `planCue` ; ce chemin-là ne passe pas
 * par lui, et c'est écrit dans le module. Le silence y est donc décidé à la
 * première ligne — avant même de chercher un bus audio, ce qui est aussi ce qui
 * rend ce test possible sans en fabriquer un.
 *
 * Il compte double depuis que les missions guidées parlent : le coach demande
 * maintenant la narration à chaque étape, y compris en Silence, et plus aucun
 * appelant ne vérifie le mode à sa place.
 */
describe('playTutorialNarration', () => {
  afterEach(() => {
    applyAnnouncerMode('voice');
    localStorage.removeItem(ANNOUNCER_STORAGE_KEY);
  });

  it('ne joue rien en mode Silence, et le dit à son appelant', async () => {
    applyAnnouncerMode('silence');

    await expect(playTutorialNarration('mission-activation-1', () => undefined)).resolves.toBe(
      false,
    );
  });
});
