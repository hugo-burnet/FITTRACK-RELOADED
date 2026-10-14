import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Workout } from '@/data/types';
import { t } from '@/i18n/fr';
import type { SaveOutcome } from '@/platform/saveFile';
import { LAST_BACKUP_KEY, NUDGE_SNOOZE_KEY } from '@/stores/backupMemory';
import { resetDb } from '@/test/resetDb';
import { HomeBackupNudge } from './HomeBackupNudge';

const { saveTextFileMock } = vi.hoisted(() => ({ saveTextFileMock: vi.fn() }));
vi.mock('@/platform/saveFile', () => ({ saveTextFile: saveTextFileMock }));

const DAY = 86_400_000;

function finishedWorkout(endedAt: number): Workout {
  return {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Séance',
      status: 'completed',
      startedAt: endedAt - 3_600_000,
      endedAt,
      durationSeconds: 3600,
    }),
    createdAt: endedAt - 3_600_000,
  };
}

async function seedWorkouts(count: number, firstEndedAt = Date.now() - 10 * DAY) {
  await db.workouts.bulkAdd(
    Array.from({ length: count }, (_, index) => finishedWorkout(firstEndedAt + index * DAY)),
  );
}

const title = () => screen.queryByText(t('home.backupTitle'));

describe('HomeBackupNudge', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
    saveTextFileMock.mockReset();
  });

  it('ne dit rien quand il n’y a rien à protéger', async () => {
    const { container } = render(<HomeBackupNudge />);
    await waitFor(() => expect(db.workouts.count()).resolves.toBe(0));
    expect(title()).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('laisse tranquille celui qui débute : deux séances, aucune sauvegarde', async () => {
    await seedWorkouts(2);
    const { container } = render(<HomeBackupNudge />);
    await waitFor(() => expect(db.workouts.count()).resolves.toBe(2));
    expect(container).toBeEmptyDOMElement();
  });

  it('prévient, chiffres à l’appui, quand trois séances ne vivent que dans le téléphone', async () => {
    await seedWorkouts(3);
    render(<HomeBackupNudge />);

    expect(await screen.findByText(t('home.backupTitle'))).toBeInTheDocument();
    expect(screen.getByText(t('home.backupNever', { count: 3 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('home.backupAction') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('home.backupLater') })).toBeInTheDocument();
  });

  it('dit depuis quand quand une sauvegarde existe', async () => {
    await seedWorkouts(4, Date.now() - 6 * DAY);
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now() - 8 * DAY));
    render(<HomeBackupNudge />);

    expect(
      await screen.findByText(
        t('home.backupSince', {
          ago: t('settings.backupAgoDays', { count: 8 }),
          sessions: t('home.backupSessionsMany', { count: 4 }),
        }),
      ),
    ).toBeInTheDocument();
  });

  it('cible tactile de 48 px minimum sur les deux boutons', async () => {
    await seedWorkouts(3);
    render(<HomeBackupNudge />);
    await screen.findByText(t('home.backupTitle'));
    for (const name of [t('home.backupAction'), t('home.backupLater')]) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-12');
    }
  });

  describe('« Sauvegarder »', () => {
    it('sort le fichier, retient l’instant et éteint le rappel', async () => {
      saveTextFileMock.mockResolvedValue('shared' satisfies SaveOutcome);
      await seedWorkouts(3);
      const user = userEvent.setup();
      render(<HomeBackupNudge />);

      await user.click(await screen.findByRole('button', { name: t('home.backupAction') }));

      await waitFor(() => expect(title()).toBeNull());
      expect(saveTextFileMock).toHaveBeenCalledTimes(1);
      const call = saveTextFileMock.mock.calls[0]![0] as { name: string; text: string };
      expect(call.name).toMatch(/\.json$/);
      expect(JSON.parse(call.text).tables.workouts).toHaveLength(3);
      expect(Number(localStorage.getItem(LAST_BACKUP_KEY))).toBeGreaterThan(0);
    });

    it('ne retient rien et garde le rappel quand la feuille de partage est fermée', async () => {
      saveTextFileMock.mockResolvedValue('cancelled' satisfies SaveOutcome);
      await seedWorkouts(3);
      const user = userEvent.setup();
      render(<HomeBackupNudge />);

      await user.click(await screen.findByRole('button', { name: t('home.backupAction') }));

      await waitFor(() => expect(saveTextFileMock).toHaveBeenCalled());
      expect(title()).toBeInTheDocument();
      expect(localStorage.getItem(LAST_BACKUP_KEY)).toBeNull();
      expect(screen.queryByText(t('home.backupFailed'))).toBeNull();
    });

    it('dit l’échec et garde le rappel quand le fichier n’a pas pu être écrit', async () => {
      saveTextFileMock.mockResolvedValue('failed' satisfies SaveOutcome);
      await seedWorkouts(3);
      const user = userEvent.setup();
      render(<HomeBackupNudge />);

      await user.click(await screen.findByRole('button', { name: t('home.backupAction') }));

      expect(await screen.findByText(t('home.backupFailed'))).toBeInTheDocument();
      expect(title()).toBeInTheDocument();
      expect(localStorage.getItem(LAST_BACKUP_KEY)).toBeNull();
    });

    it('ne part qu’une fois, même touché deux fois', async () => {
      let finish!: (outcome: SaveOutcome) => void;
      saveTextFileMock.mockReturnValue(
        new Promise<SaveOutcome>((resolve) => {
          finish = resolve;
        }),
      );
      await seedWorkouts(3);
      const user = userEvent.setup();
      render(<HomeBackupNudge />);

      const button = await screen.findByRole('button', { name: t('home.backupAction') });
      await user.click(button);
      await user.click(button);
      finish('shared');

      await waitFor(() => expect(title()).toBeNull());
      expect(saveTextFileMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('« Plus tard »', () => {
    it('fait taire le rappel une semaine, sans rien sauvegarder', async () => {
      await seedWorkouts(3);
      const user = userEvent.setup();
      render(<HomeBackupNudge />);

      await user.click(await screen.findByRole('button', { name: t('home.backupLater') }));

      await waitFor(() => expect(title()).toBeNull());
      expect(saveTextFileMock).not.toHaveBeenCalled();
      expect(localStorage.getItem(LAST_BACKUP_KEY)).toBeNull();
      const until = Number(localStorage.getItem(NUDGE_SNOOZE_KEY));
      expect(until).toBeGreaterThan(Date.now() + 6 * DAY);
      expect(until).toBeLessThan(Date.now() + 8 * DAY);
    });

    it('reste silencieux tant que le délai court, au prochain affichage de l’accueil', async () => {
      await seedWorkouts(3);
      localStorage.setItem(NUDGE_SNOOZE_KEY, String(Date.now() + 3 * DAY));
      const { container } = render(<HomeBackupNudge />);
      await waitFor(() => expect(db.workouts.count()).resolves.toBe(3));
      expect(container).toBeEmptyDOMElement();
    });
  });
});
