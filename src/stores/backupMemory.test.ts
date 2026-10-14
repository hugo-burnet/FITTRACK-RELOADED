import { describe, expect, it, vi } from 'vitest';
import {
  LAST_BACKUP_KEY,
  NUDGE_SNOOZE_KEY,
  readBackupMemory,
  rememberBackup,
  snoozeBackupNudge,
  subscribeBackupMemory,
} from './backupMemory';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const failing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('backupMemory', () => {
  it('vit hors sauvegarde : le préfixe est « fittrack. » et non « fittrack: »', () => {
    // `readPreferences` ne sauvegarde que les clés « fittrack: » ; une date de
    // sauvegarde dans la sauvegarde dirait toujours la précédente.
    expect(LAST_BACKUP_KEY.startsWith('fittrack.')).toBe(true);
    expect(NUDGE_SNOOZE_KEY.startsWith('fittrack.')).toBe(true);
  });

  it('ne sait rien d’un appareil neuf', () => {
    expect(readBackupMemory(fakeStorage())).toEqual({
      lastBackupAt: undefined,
      snoozedUntil: undefined,
    });
  });

  it('retient l’instant de la sauvegarde', () => {
    const storage = fakeStorage();
    rememberBackup(storage, 1_785_000_000_000);
    expect(readBackupMemory(storage).lastBackupAt).toBe(1_785_000_000_000);
  });

  it('retient « Plus tard », et une sauvegarde fraîche y met fin', () => {
    const storage = fakeStorage();
    snoozeBackupNudge(storage, 1_786_000_000_000);
    expect(readBackupMemory(storage).snoozedUntil).toBe(1_786_000_000_000);

    rememberBackup(storage, 1_785_500_000_000);
    expect(readBackupMemory(storage).snoozedUntil).toBeUndefined();
  });

  it('lit une valeur illisible comme une absence', () => {
    const storage = fakeStorage({ [LAST_BACKUP_KEY]: 'hier', [NUDGE_SNOOZE_KEY]: '-5' });
    expect(readBackupMemory(storage)).toEqual({ lastBackupAt: undefined, snoozedUntil: undefined });
  });

  it('n’écrit pas un instant qui n’en est pas un', () => {
    const storage = fakeStorage();
    rememberBackup(storage, Number.NaN);
    rememberBackup(storage, 0);
    rememberBackup(storage, -1);
    expect(storage.data.size).toBe(0);
  });

  it('ne lève jamais quand le stockage est bloqué ou absent', () => {
    expect(() => rememberBackup(failing, 1_785_000_000_000)).not.toThrow();
    expect(() => snoozeBackupNudge(failing, 1_786_000_000_000)).not.toThrow();
    expect(readBackupMemory(failing)).toEqual({ lastBackupAt: undefined, snoozedUntil: undefined });
    expect(() => rememberBackup(null, 1_785_000_000_000)).not.toThrow();
    expect(readBackupMemory(null)).toEqual({ lastBackupAt: undefined, snoozedUntil: undefined });
  });

  describe('abonnement', () => {
    it('prévient les écrans quand une date change', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeBackupMemory(listener);
      const storage = fakeStorage();

      rememberBackup(storage, 1_785_000_000_000);
      snoozeBackupNudge(storage, 1_786_000_000_000);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      rememberBackup(storage, 1_785_100_000_000);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
