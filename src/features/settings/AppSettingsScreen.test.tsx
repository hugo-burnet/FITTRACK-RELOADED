import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '@/test/resetDb';
import { watchInstall } from '@/platform/install';
import { AppSettingsScreen } from './AppSettingsScreen';

function renderSettings() {
  render(
    <MemoryRouter>
      <AppSettingsScreen />
    </MemoryRouter>,
  );
}

describe('AppSettingsScreen — installation', () => {
  beforeEach(resetDb);
  // Le module garde l'événement différé dans son état de module. Le vider entre
  // deux tests par le vrai chemin — celui qu'emprunte une installation faite
  // depuis le menu du navigateur — plutôt qu'en tripotant un verrou privé.
  afterEach(() => window.dispatchEvent(new Event('appinstalled')));

  const installAction = () =>
    screen.findByRole('button', { name: /Installer sur l’écran d’accueil/ });

  /** Rejoue ce que Chrome envoie quand il juge l'app installable. */
  function offerInstall(outcome: 'accepted' | 'dismissed') {
    watchInstall();
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome }),
    });
    window.dispatchEvent(event);
  }

  it('explique le geste à faire quand le navigateur ne propose aucune invite', async () => {
    renderSettings();

    await userEvent.click(await installAction());

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Déjà installée, ou à ajouter depuis le menu du navigateur.',
    );
  });

  it('confirme une installation acceptée', async () => {
    offerInstall('accepted');
    renderSettings();

    await userEvent.click(await installAction());

    expect(await screen.findByRole('status')).toHaveTextContent('FitTrack est installée.');
  });

  it('ne traite pas un refus comme une panne', async () => {
    offerInstall('dismissed');
    renderSettings();

    await userEvent.click(await installAction());

    expect(await screen.findByRole('status')).toHaveTextContent('Installation annulée.');
  });

  it('annonce que la copie hors-ligne n’est pas encore prête', async () => {
    // jsdom n'a pas de service worker, donc `isOfflineReady` est faux : c'est
    // l'état d'un tout premier chargement, avant que le précache soit rempli.
    renderSettings();

    expect(await screen.findByText('Copie hors-ligne en cours de préparation.')).toBeVisible();
  });
});

describe('AppSettingsScreen — le reste de l’application', () => {
  beforeEach(resetDb);

  it('garde le dépannage, les crédits et la base de preuves à une ligne d’ici', async () => {
    renderSettings();

    expect(await screen.findByRole('button', { name: /Dépannage et données/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /À propos et crédits|Crédits|À propos/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Base de preuves/ })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Application' })).toBeVisible();
  });
});
