import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import * as backupRepository from '@/data/repositories/backup';
import { createCustomExercise } from '@/data/repositories/exercises';
import { createRoutine } from '@/data/repositories/routines';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import { t } from '@/i18n/fr';
import { serializeBackup } from '@/lib/backup';
import type { SaveOutcome } from '@/platform/saveFile';
import { resetDb } from '@/test/resetDb';
import { BackupActions } from './BackupActions';

const { saveTextFileMock } = vi.hoisted(() => ({ saveTextFileMock: vi.fn() }));
vi.mock('@/platform/saveFile', () => ({ saveTextFile: saveTextFileMock }));

function jsonFile(
  text: string,
  name = 'fittrack-sauvegarde.json',
  readText: () => Promise<string> = () => Promise.resolve(text),
): File {
  const file = new File([text], name, { type: 'application/json' });
  // jsdom's File has no `text()` before Node 20's Blob lands on it in every
  // environment; the component only ever calls that one method.
  Object.defineProperty(file, 'text', { value: readText });
  return file;
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>, file: File) {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('champ fichier absent');
  await user.upload(input, file);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function renderBackupActions(report = vi.fn(), reload = vi.fn()) {
  return render(
    <TutorialContext.Provider
      value={{
        openHelp: vi.fn(),
        startMission: vi.fn(),
        offerMission: vi.fn(),
        report,
      }}
    >
      <BackupActions reload={reload} />
    </TutorialContext.Provider>,
  );
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
    renderBackupActions();

    await user.click(screen.getByRole('button', { name: /Exporter tout le compte/ }));

    await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledTimes(1));
    const payload = saveTextFileMock.mock.calls[0]?.[0] as { name: string; text: string };
    expect(payload.name).toMatch(/^fittrack-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(payload.text).tables.routines).toHaveLength(1);
  });

  it('refuse un fichier qui n’est pas une sauvegarde, sans rien toucher', async () => {
    await createRoutine('Poussée');
    const user = userEvent.setup();
    renderBackupActions();

    await chooseFile(user, jsonFile('title,reps\r\nLOWER A,12', 'historique.csv'));

    expect(await screen.findByRole('status')).toHaveTextContent(t('settings.restoreErrorNotJson'));
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
    const text = serializeBackup(await backupRepository.buildBackup());

    await resetDb();
    await createRoutine('Une routine de cet appareil');

    const reload = vi.fn();
    const user = userEvent.setup();
    renderBackupActions(vi.fn(), reload);

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
    const text = serializeBackup(await backupRepository.buildBackup());
    await resetDb();
    await createRoutine('Une routine de cet appareil');

    const user = userEvent.setup();
    renderBackupActions();
    await chooseFile(user, jsonFile(text));

    await screen.findByText(/routines : 1/);
    await user.click(screen.getAllByRole('button', { name: t('common.close') })[0]!);

    const routines = await db.routines.toArray();
    expect(routines.map((routine) => routine.name)).toEqual(['Une routine de cet appareil']);
  });

  it.each(['shared', 'downloaded'] satisfies SaveOutcome[])(
    'signale l’export %s seulement après la sauvegarde effective',
    async (outcome) => {
      const pendingSave = deferred<SaveOutcome>();
      const report = vi.fn();
      saveTextFileMock.mockReturnValueOnce(pendingSave.promise);
      const user = userEvent.setup();
      renderBackupActions(report);

      await user.click(screen.getByRole('button', { name: /Exporter tout le compte/ }));
      await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledOnce());
      expect(report).not.toHaveBeenCalled();

      pendingSave.resolve(outcome);

      await waitFor(() => expect(report).toHaveBeenCalledOnce());
      expect(report).toHaveBeenLastCalledWith({ type: 'backup-exported', outcome });
    },
  );

  it.each(['failed', 'cancelled'] satisfies SaveOutcome[])(
    'ne signale pas un export %s',
    async (outcome) => {
      const pendingSave = deferred<SaveOutcome>();
      const report = vi.fn();
      saveTextFileMock.mockReturnValueOnce(pendingSave.promise);
      const user = userEvent.setup();
      renderBackupActions(report);

      await user.click(screen.getByRole('button', { name: /Exporter tout le compte/ }));
      await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledOnce());
      expect(report).not.toHaveBeenCalled();

      pendingSave.resolve(outcome);
      if (outcome === 'failed') {
        expect(await screen.findByRole('status')).toHaveTextContent(/n.a pas pu/i);
      } else {
        await waitFor(() => expect(screen.getByRole('button', { name: /Exporter/ })).toBeEnabled());
      }
      expect(report).not.toHaveBeenCalled();
    },
  );

  it('signale la confirmation d’une restauration valide sans restaurer', async () => {
    await createRoutine('Poussée');
    const text = serializeBackup(await backupRepository.buildBackup());
    const pendingText = deferred<string>();
    const readText = vi.fn(() => pendingText.promise);
    const restoreSpy = vi.spyOn(backupRepository, 'restoreBackup');
    const report = vi.fn();
    const user = userEvent.setup();
    renderBackupActions(report);

    await chooseFile(user, jsonFile(text, 'fittrack-sauvegarde.json', readText));

    await waitFor(() => expect(readText).toHaveBeenCalledOnce());
    expect(report).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    pendingText.resolve(text);

    expect(await screen.findByRole('dialog', { name: /Restaurer cette sauvegarde/ })).toBeVisible();
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenLastCalledWith({ type: 'restore-confirmation-opened' });
    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('ne signale pas les fichiers invalides, vides ou d’une version future', async () => {
    await createRoutine('Poussée');
    const valid = JSON.parse(serializeBackup(await backupRepository.buildBackup())) as Record<
      string,
      unknown
    >;
    const empty = structuredClone(valid);
    empty.preferences = {};
    for (const table of Object.keys(empty.tables as Record<string, unknown>)) {
      (empty.tables as Record<string, unknown>)[table] = [];
    }
    const future = structuredClone(valid);
    future.version = Number.MAX_SAFE_INTEGER;
    const report = vi.fn();
    const user = userEvent.setup();
    renderBackupActions(report);

    const cases = [
      ['pas du json', t('settings.restoreErrorNotJson')],
      [JSON.stringify({ format: 'pas-une-sauvegarde' }), t('settings.restoreErrorNotBackup')],
      [JSON.stringify(empty), t('settings.restoreErrorEmpty')],
      [JSON.stringify(future), t('settings.restoreErrorVersion')],
    ] as const;

    for (const [text, expectedMessage] of cases) {
      await chooseFile(user, jsonFile(text));
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(expectedMessage));
      expect(report).not.toHaveBeenCalled();
    }
  });

  it('expose les ancres exactes des actions de sauvegarde', () => {
    renderBackupActions();

    expect(screen.getByRole('button', { name: /Exporter tout le compte/ })).toHaveAttribute(
      'data-tutorial-id',
      'backup-export',
    );
    expect(screen.getByRole('button', { name: /Restaurer une sauvegarde/ })).toHaveAttribute(
      'data-tutorial-id',
      'backup-restore',
    );
  });
});
