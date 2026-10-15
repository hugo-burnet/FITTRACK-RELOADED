import { describe, expect, it, vi } from 'vitest';
import { readStoragePersistence, requestPersistentStorage } from './storagePersistence';

function manager(overrides: Partial<StorageManager> = {}): StorageManager {
  return {
    persisted: vi.fn().mockResolvedValue(false),
    persist: vi.fn().mockResolvedValue(true),
    estimate: vi.fn(),
    getDirectory: vi.fn(),
    ...overrides,
  } as StorageManager;
}

describe('requestPersistentStorage', () => {
  it('demande la protection quand elle n’est pas encore accordée', async () => {
    const storage = manager();
    await expect(requestPersistentStorage(storage)).resolves.toBe('granted');
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('ne redemande pas une protection déjà accordée', async () => {
    const storage = manager({ persisted: vi.fn().mockResolvedValue(true) });
    await expect(requestPersistentStorage(storage)).resolves.toBe('already');
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('dit quand le navigateur refuse', async () => {
    const storage = manager({ persist: vi.fn().mockResolvedValue(false) });
    await expect(requestPersistentStorage(storage)).resolves.toBe('denied');
  });

  it('ne lève jamais : un navigateur sans stockage persistant, ou qui plante, n’empêche pas de démarrer', async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBe('unsupported');
    await expect(
      requestPersistentStorage({ estimate: vi.fn() } as unknown as StorageManager),
    ).resolves.toBe('unsupported');
    await expect(
      requestPersistentStorage(manager({ persisted: vi.fn().mockRejectedValue(new Error('x')) })),
    ).resolves.toBe('denied');
    await expect(
      requestPersistentStorage(manager({ persist: vi.fn().mockRejectedValue(new Error('x')) })),
    ).resolves.toBe('denied');
  });
});

describe('readStoragePersistence', () => {
  it('lit l’état sans rien demander', async () => {
    const storage = manager({ persisted: vi.fn().mockResolvedValue(true) });
    await expect(readStoragePersistence(storage)).resolves.toBe(true);
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('répond « inconnu » quand le navigateur ne sait pas le dire', async () => {
    await expect(readStoragePersistence(undefined)).resolves.toBeNull();
    await expect(
      readStoragePersistence(manager({ persisted: vi.fn().mockRejectedValue(new Error('x')) })),
    ).resolves.toBeNull();
  });
});
