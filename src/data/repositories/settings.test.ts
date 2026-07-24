import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { resetDb } from '@/test/resetDb';
import { getAvailablePlateWeightsKg, setAvailablePlateWeightsKg } from './settings';

const WITHOUT_25_KG = DEFAULT_PLATES_KG.filter((weight) => weight !== 25);

describe('available plate weights setting', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it('retourne la liste canonique complète en absence de réglage', async () => {
    expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);
  });

  it('conserve une sélection sans plaque de 25 kg après une nouvelle lecture', async () => {
    await setAvailablePlateWeightsKg(WITHOUT_25_KG);

    expect(await getAvailablePlateWeightsKg()).toEqual(WITHOUT_25_KG);
  });

  it('conserve un inventaire explicitement vide', async () => {
    await setAvailablePlateWeightsKg([]);

    expect(await getAvailablePlateWeightsKg()).toEqual([]);
  });

  it('retire les doublons et restaure l’ordre canonique', async () => {
    await db.settings.put({
      key: 'availablePlateWeightsKg',
      value: [1, 25, 1, 2.5, 20],
      updatedAt: 1,
    });

    expect(await getAvailablePlateWeightsKg()).toEqual([25, 20, 2.5, 1]);
  });

  it('revient au défaut quand la valeur stockée n’est pas un tableau', async () => {
    await db.settings.put({
      key: 'availablePlateWeightsKg',
      value: { weight: 25 },
      updatedAt: 1,
    });

    expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);
  });

  it('revient au défaut quand un tableau non vide ne contient aucune valeur exploitable', async () => {
    await db.settings.put({
      key: 'availablePlateWeightsKg',
      value: [0, -1, 30, Number.NaN, '25'],
      updatedAt: 1,
    });

    expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);
  });

  it('renouvelle updatedAt à chaque écriture', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await setAvailablePlateWeightsKg(WITHOUT_25_KG);
    const first = await db.settings.get('availablePlateWeightsKg');

    now.mockReturnValue(2_000);
    await setAvailablePlateWeightsKg(DEFAULT_PLATES_KG);
    const second = await db.settings.get('availablePlateWeightsKg');

    expect(first?.updatedAt).toBe(1_000);
    expect(second?.updatedAt).toBe(2_000);
  });
});
