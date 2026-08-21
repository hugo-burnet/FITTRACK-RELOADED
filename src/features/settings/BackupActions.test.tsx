import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { buildBackup } from '@/data/repositories/backup';
import { createCustomExercise } from '@/data/repositories/exercises';
import { createRoutine } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import { serializeBackup } from '@/lib/backup';
import { resetDb } from '@/test/resetDb';
import { BackupActions } from './BackupActions';

const { saveTextFileMock } = vi.hoisted(() => ({ saveTextFileMock: vi.fn() }));
vi.mock('@/platform/saveFile', () => ({ saveTextFile: saveTextFileMock }));

function jsonFile(text: string, name = 'fittrack-sauvegarde.json'): File {
  const file = new File([text], name, { type: 'application/json' });
  // jsdom's File has no `text()` before Node 20's Blob lands on it in every
  // environment; the component only ever calls that one method.
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  return file;
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>, file: File) {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('champ fichier absent');
  await user.upload(input, file);
}

describe('BackupActions', () => {
  beforeEach(async () => {
    saveTextFileMock.mockReset();
    saveTextFileMock.mockResolvedValue('shared');
    localStorage.clear();
    await resetDb();
  });

  it('écrit un fichier qui contient le compte', async () => {
    await createRoutine('Poussée');
    const user = userEvent.setup();
    render(<BackupActions reload={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Exporter tout le compte/ }));

    await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledTimes(1));
    const payload = saveTextFileMock.mock.calls[0]?.[0] as { name: string; text: string };
    expect(payload.name).toMatch(/^fittrack-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(payload.text).tables.routines).toHaveLength(1);
  });

  it('refuse un fichier qui n’est pas une sauvegarde, sans rien toucher', async () => {
    await createRoutine('Poussée');
    const user = userEvent.setup();
    render(<BackupActions reload={vi.fn()} />);

    await chooseFile(user, jsonFile('title,reps\r\nLOWER A,12', 'historique.csv'));

    expect(await screen.findByRole('status')).toHaveTextContent(
      t('settings.restoreErrorNotJson'),
    );
    expect(await db.routines.count()).toBe(1);
  });

  it('demande confirmation avec les nombres du fichier, puis remplace tout', async () => {
    // Le contenu à restaurer, capturé avant de repartir de zéro.
    await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    await createRoutine('Poussée');
    const text = serializeBackup(await buildBackup());

    await resetDb();
    await createRoutine('Une routine de cet appareil');

    const reload = vi.fn();
    const user = userEvent.setup();
    render(<BackupActions reload={reload} />);

    await chooseFile(user, jsonFile(text));

    expect(await screen.findByText(/routines : 1/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: t('settings.restoreConfirmAction') }));

    await waitFor(async () => {
      const routines = await db.routines.toArray();
      expect(routines.map((routine) => routine.name)).toEqual(['Poussée']);
    });
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('laisse le compte intact quand on ferme la confirmation', async () => {
    await createRoutine('Poussée');
    const text = serializeBackup(await buildBackup());
    await resetDb();
    await createRoutine('Une routine de cet appareil');

    const user = userEvent.setup();
    render(<BackupActions reload={vi.fn()} />);
    await chooseFile(user, jsonFile(text));

    await screen.findByText(/routines : 1/);
    await user.click(screen.getAllByRole('button', { name: t('common.close') })[0]!);

    const routines = await db.routines.toArray();
    expect(routines.map((routine) => routine.name)).toEqual(['Une routine de cet appareil']);
  });
});
