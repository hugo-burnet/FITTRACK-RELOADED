import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { resetDb } from '@/test/resetDb';
import {
  getAvailablePlateWeightsKg,
  getWeeklyTrainingGoalHistory,
  setAvailablePlateWeightsKg,
  setWeeklyTrainingGoal,
} from './settings';

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

describe('weekly training goal history setting', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  const july25 = new Date(2026, 6, 25, 12).getTime();
  const august4 = new Date(2026, 7, 4, 12).getTime();
  const august8 = new Date(2026, 7, 8, 20).getTime();
  const augustMonday = new Date(2026, 7, 3).getTime();

  it('rend un historique vide tant que l’utilisateur n’a rien choisi', async () => {
    expect(await getWeeklyTrainingGoalHistory()).toEqual([]);
  });

  it('enregistre le premier objectif comme base rétroactive', async () => {
    await setWeeklyTrainingGoal(4, july25);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
    ]);
  });

  it('ajoute un changement au lundi de sa semaine', async () => {
    await setWeeklyTrainingGoal(4, july25);
    await setWeeklyTrainingGoal(3, august4);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
      { effectiveFromWeek: augustMonday, sessions: 3 },
    ]);
  });

  it('remplace un changement refait dans la même semaine', async () => {
    await setWeeklyTrainingGoal(4, july25);
    await setWeeklyTrainingGoal(5, august4);
    await setWeeklyTrainingGoal(3, august8);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
      { effectiveFromWeek: augustMonday, sessions: 3 },
    ]);
  });

  it('ne pose aucun plafond artificiel', async () => {
    await setWeeklyTrainingGoal(12, july25);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 12 },
    ]);
  });

  it.each([0, -1, 2.5, Number.NaN])(
    'refuse une valeur qui n’est pas un entier strictement positif : %s',
    async (sessions) => {
      await expect(setWeeklyTrainingGoal(sessions, july25)).rejects.toThrow(RangeError);
      expect(await db.settings.get('weeklyTrainingGoalHistory')).toBeUndefined();
    },
  );

  it('normalise défensivement une valeur IndexedDB corrompue', async () => {
    await db.settings.put({
      key: 'weeklyTrainingGoalHistory',
      value: [
        { effectiveFromWeek: augustMonday, sessions: 5 },
        null,
        { effectiveFromWeek: -1, sessions: 6 },
        { effectiveFromWeek: 0, sessions: 4 },
        { effectiveFromWeek: augustMonday, sessions: 3 },
        { effectiveFromWeek: augustMonday + 1, sessions: 2.5 },
      ],
      updatedAt: 1,
    });

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
      { effectiveFromWeek: augustMonday, sessions: 3 },
    ]);
  });
});
