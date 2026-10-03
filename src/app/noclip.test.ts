import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { listMilestones, listUnacknowledgedMilestones } from '@/data/repositories/milestones';
import { resetDb } from '@/test/resetDb';
import { TTY1_UNLOCK_KEY } from '@/stores/skinUnlock';
import { grantNoclipIfUnlocked } from './noclip';

function memoryStorage(initial: string | null = null) {
  let value = initial;

  return {
    getItem: vi.fn((key: string) => (key === TTY1_UNLOCK_KEY ? value : null)),
    setItem: vi.fn((key: string, next: string) => {
      if (key === TTY1_UNLOCK_KEY) value = next;
    }),
  };
}

const UNLOCKED = '1';

describe('grantNoclipIfUnlocked', () => {
  beforeEach(resetDb);

  it('n’accorde rien tant que TTY1 est verrouillé, et ne laisse rien deviner', async () => {
    await grantNoclipIfUnlocked(memoryStorage(), { celebrate: true });

    expect(await listMilestones()).toEqual([]);
  });

  it('accorde noclip dès que TTY1 est débloqué', async () => {
    await grantNoclipIfUnlocked(memoryStorage(UNLOCKED), { celebrate: false });

    expect((await listMilestones()).map((row) => row.definitionId)).toEqual(['noclip']);
  });

  it('le célèbre quand la console vient de débloquer TTY1', async () => {
    await grantNoclipIfUnlocked(memoryStorage(UNLOCKED), { celebrate: true });

    expect((await listUnacknowledgedMilestones()).map((row) => row.definitionId)).toEqual([
      'noclip',
    ]);
  });

  it('le range sans bruit pour qui avait déjà TTY1', async () => {
    await grantNoclipIfUnlocked(memoryStorage(UNLOCKED), { celebrate: false });

    expect(await listUnacknowledgedMilestones()).toEqual([]);
    expect(await listMilestones()).toHaveLength(1);
  });

  it('est sans effet la seconde fois : ni doublon, ni nouvelle célébration', async () => {
    const storage = memoryStorage(UNLOCKED);
    await grantNoclipIfUnlocked(storage, { celebrate: false });
    await grantNoclipIfUnlocked(storage, { celebrate: true });

    expect(await listMilestones()).toHaveLength(1);
    expect(await listUnacknowledgedMilestones()).toEqual([]);
  });

  it('ne fait rien sans stockage, ou avec un stockage qui lève', async () => {
    const hostile = {
      getItem: vi.fn(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
      setItem: vi.fn(),
    };

    await expect(grantNoclipIfUnlocked(null, { celebrate: true })).resolves.toBeUndefined();
    await expect(grantNoclipIfUnlocked(hostile, { celebrate: true })).resolves.toBeUndefined();
    expect(await listMilestones()).toEqual([]);
  });

  it('ne laisse jamais une base qui échoue empêcher l’app de s’ouvrir', async () => {
    const failure = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('base fermée'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      grantNoclipIfUnlocked(memoryStorage(UNLOCKED), { celebrate: true }),
    ).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalled();
    failure.mockRestore();
    logged.mockRestore();
  });
});
