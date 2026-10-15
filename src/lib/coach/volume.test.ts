import { describe, expect, it } from 'vitest';
import type { MuscleGroup } from '@/data/types';
import {
  VOLUME_MIN_WEEKS_WORKED,
  VOLUME_REFERENCE_WEEKS,
  completeWeeks,
  effectiveCeiling,
  muscleVolumeContext,
  normalizeVolumeBounds,
  rollingWeekSets,
  volumeLowMuscles,
  volumeOverview,
  type VolumeEntry,
} from './volume';

/** Un jeudi à midi, en jour local : la semaine en cours commence le lundi 12 octobre. */
const NOW = new Date(2026, 9, 15, 12).getTime();
const MONDAY = new Date(2026, 9, 12).getTime();

/** Midi, `daysAgo` jours avant `NOW`. */
const daysAgo = (days: number): number => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  return date.getTime();
};

/** Mercredi de la semaine complète numéro `weeksAgo` avant la semaine en cours (1 = la dernière). */
const inWeek = (weeksAgo: number): number => {
  const date = new Date(MONDAY);
  date.setDate(date.getDate() - weeksAgo * 7 + 2);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
};

const entry = (at: number, muscle: MuscleGroup | undefined, sets: number): VolumeEntry => ({
  at,
  muscle,
  sets,
});

/** Un volume par semaine complète, de la plus ancienne à la dernière (six valeurs). */
function weeklyHistory(muscle: MuscleGroup, perWeek: readonly number[]): VolumeEntry[] {
  return perWeek.flatMap((sets, index) =>
    sets === 0 ? [] : [entry(inWeek(perWeek.length - index), muscle, sets)],
  );
}

describe('la semaine glissante', () => {
  it('compte les séries directes du muscle sur les sept derniers jours', () => {
    const entries = [
      entry(daysAgo(0), 'chest', 4),
      entry(daysAgo(3), 'chest', 3),
      entry(daysAgo(6), 'chest', 2),
      entry(daysAgo(3), 'lats', 9),
    ];

    expect(rollingWeekSets(entries, 'chest', NOW)).toBe(9);
    expect(rollingWeekSets(entries, 'lats', NOW)).toBe(9);
    expect(rollingWeekSets(entries, 'quads', NOW)).toBe(0);
  });

  it('laisse sortir la séance d’il y a sept jours : la fenêtre est ouverte du côté du passé', () => {
    const entries = [entry(NOW - 7 * 86_400_000, 'chest', 5), entry(NOW - 7 * 86_400_000 + 1, 'chest', 3)];

    expect(rollingWeekSets(entries, 'chest', NOW)).toBe(3);
  });

  it('ne lit pas l’avenir', () => {
    expect(rollingWeekSets([entry(NOW + 60_000, 'chest', 6)], 'chest', NOW)).toBe(0);
  });
});

describe('les semaines complètes', () => {
  it('sont les six lundis qui précèdent la semaine en cours, de la plus ancienne à la dernière', () => {
    const weeks = completeWeeks(NOW);

    expect(weeks).toHaveLength(VOLUME_REFERENCE_WEEKS);
    expect(weeks[VOLUME_REFERENCE_WEEKS - 1]!.end).toBe(MONDAY);
    for (const week of weeks) {
      expect(new Date(week.start).getDay()).toBe(1);
      expect(new Date(week.start).getHours()).toBe(0);
    }
  });

  it('se suivent sans trou ni recouvrement, y compris au changement d’heure', () => {
    // Le 25 octobre 2026, la France repasse à l'heure d'hiver : une semaine de 169 heures.
    const weeks = completeWeeks(new Date(2026, 10, 12, 12).getTime());

    weeks.slice(1).forEach((week, index) => expect(week.start).toBe(weeks[index]!.end));
  });
});

describe('le volume d’un muscle sur six semaines', () => {
  it('résume les semaines où il est travaillé : nombre, médiane, maximum', () => {
    const entries = weeklyHistory('chest', [0, 8, 9, 0, 10, 8]);

    expect(volumeOverview(entries, 'chest', NOW)).toMatchObject({
      weeks: [0, 8, 9, 0, 10, 8],
      weeksWorked: 4,
      median: 8.5,
      max: 10,
    });
  });

  it('prend la médiane des semaines travaillées, pas des six : le repos ne fait pas le plancher', () => {
    const entries = weeklyHistory('hamstrings', [0, 0, 0, 8, 9, 10]);

    expect(volumeOverview(entries, 'hamstrings', NOW).median).toBe(9);
  });

  it('additionne plusieurs séances de la même semaine', () => {
    const entries = [
      entry(inWeek(2), 'chest', 4),
      entry(inWeek(2) + 86_400_000, 'chest', 3),
      entry(inWeek(2) + 2 * 86_400_000, 'chest', 3),
    ];

    expect(volumeOverview(entries, 'chest', NOW).weeks[VOLUME_REFERENCE_WEEKS - 2]).toBe(10);
  });

  it('ne compte pas la semaine en cours dans la référence, mais la rend comme volume courant', () => {
    const entries = [...weeklyHistory('chest', [8, 8, 8, 8, 8, 8]), entry(daysAgo(1), 'chest', 12)];

    const overview = volumeOverview(entries, 'chest', NOW);

    expect(overview.max).toBe(8);
    expect(overview.rollingSets).toBe(12);
  });

  it('ne rend ni médiane ni maximum d’un muscle jamais travaillé', () => {
    const overview = volumeOverview(weeklyHistory('chest', [8, 8, 8, 8, 8, 8]), 'quads', NOW);

    expect(overview).toMatchObject({ weeksWorked: 0, rollingSets: 0 });
    expect(overview.median).toBeUndefined();
    expect(overview.max).toBeUndefined();
  });

  it('ignore ce qui est plus vieux que six semaines', () => {
    const entries = [entry(inWeek(7), 'chest', 30), ...weeklyHistory('chest', [0, 0, 0, 5, 5, 5])];

    expect(volumeOverview(entries, 'chest', NOW).max).toBe(5);
  });
});

describe('le plafond', () => {
  it('par défaut, c’est le plus haut volume que la personne a déjà tenu', () => {
    const overview = volumeOverview(weeklyHistory('chest', [8, 9, 10, 8, 9, 8]), 'chest', NOW);

    expect(effectiveCeiling(overview)).toBe(10);
  });

  it(`se tait sous ${VOLUME_MIN_WEEKS_WORKED} semaines travaillées : la donnée absente n’est pas une donnée`, () => {
    const overview = volumeOverview(weeklyHistory('chest', [0, 0, 0, 0, 9, 10]), 'chest', NOW);

    expect(overview.weeksWorked).toBe(2);
    expect(effectiveCeiling(overview)).toBeUndefined();
  });

  it('parle dès la troisième semaine travaillée, même non consécutive', () => {
    const overview = volumeOverview(weeklyHistory('chest', [7, 0, 9, 0, 0, 8]), 'chest', NOW);

    expect(effectiveCeiling(overview)).toBe(9);
  });

  it('cède à celui que la personne a posé, avec ou sans historique', () => {
    const rich = volumeOverview(weeklyHistory('chest', [8, 9, 10, 8, 9, 8]), 'chest', NOW);
    const thin = volumeOverview([], 'chest', NOW);

    expect(effectiveCeiling(rich, { ceiling: 14 })).toBe(14);
    expect(effectiveCeiling(thin, { ceiling: 14 })).toBe(14);
    // Un plancher seul ne pose pas de plafond.
    expect(effectiveCeiling(thin, { floor: 8 })).toBeUndefined();
  });
});

describe('le contexte que le moteur lit', () => {
  const steady = weeklyHistory('chest', [10, 10, 10, 10, 10, 10]);

  it('rend le volume courant et le plafond d’un muscle qui a un historique', () => {
    const entries = [...steady, entry(daysAgo(2), 'chest', 6)];

    expect(muscleVolumeContext(entries, 'chest', undefined, NOW)).toEqual({
      rollingSets: 6,
      ceiling: 10,
      userSet: false,
    });
  });

  it('ne rend rien sans plafond : moins de trois semaines, aucun effet', () => {
    expect(muscleVolumeContext(weeklyHistory('chest', [0, 0, 0, 0, 10, 10]), 'chest', undefined, NOW)).toBeUndefined();
  });

  it('prend le plafond posé par la personne', () => {
    const entries = [...steady, entry(daysAgo(2), 'chest', 12)];

    // `userSet` : la carte ne dit pas « le plus que tu aies tenu » d'un plafond que la personne a posé.
    expect(muscleVolumeContext(entries, 'chest', { chest: { ceiling: 16 } }, NOW)).toEqual({
      rollingSets: 12,
      ceiling: 16,
      userSet: true,
    });
  });

  it('ne parle pas d’un groupe qui n’est pas une région du corps', () => {
    const entries = weeklyHistory('cardio', [3, 3, 3, 3, 3, 3]);

    expect(muscleVolumeContext(entries, 'cardio', { cardio: { ceiling: 2 } }, NOW)).toBeUndefined();
  });
});

describe('le volume bas', () => {
  /** Une séance de dos par semaine, pour que les semaines comptent comme travaillées. */
  const training = weeklyHistory('lats', [6, 6, 6, 6, 6, 6]);

  it('sans plancher posé, ne se déclenche jamais — même à deux séries par semaine', () => {
    const entries = [...training, ...weeklyHistory('hamstrings', [0, 0, 0, 0, 2, 2])];

    expect(volumeLowMuscles(entries, {}, NOW)).toEqual([]);
    expect(volumeLowMuscles(entries, { hamstrings: {} }, NOW)).toEqual([]);
  });

  it('se déclenche sous un plancher posé deux semaines de suite', () => {
    const entries = [...training, ...weeklyHistory('hamstrings', [0, 0, 0, 0, 6, 6])];

    expect(volumeLowMuscles(entries, { hamstrings: { floor: 8 } }, NOW)).toEqual([
      { muscle: 'hamstrings', floor: 8, weeks: [6, 6] },
    ]);
  });

  it('attend la deuxième semaine : une seule semaine sous le plancher ne dit rien', () => {
    const entries = [...training, ...weeklyHistory('hamstrings', [0, 0, 0, 0, 9, 6])];

    expect(volumeLowMuscles(entries, { hamstrings: { floor: 8 } }, NOW)).toEqual([]);
  });

  it('se tait une fois le plancher tenu : être au plancher, ce n’est pas être dessous', () => {
    const entries = [...training, ...weeklyHistory('hamstrings', [0, 0, 0, 0, 6, 8])];

    expect(volumeLowMuscles(entries, { hamstrings: { floor: 8 } }, NOW)).toEqual([]);
  });

  it('compte un muscle jamais travaillé comme zéro série, tant que la personne s’entraîne', () => {
    expect(volumeLowMuscles(training, { quads: { floor: 6 } }, NOW)).toEqual([
      { muscle: 'quads', floor: 6, weeks: [0, 0] },
    ]);
  });

  it('une semaine sans aucune séance n’est pas un volume bas : ce sont des vacances', () => {
    const holiday = [
      ...weeklyHistory('lats', [6, 6, 6, 6, 0, 0]),
      ...weeklyHistory('hamstrings', [8, 8, 8, 8, 0, 0]),
    ];

    expect(volumeLowMuscles(holiday, { hamstrings: { floor: 8 } }, NOW)).toEqual([]);
  });

  it('une seule des deux semaines sans séance suffit à se taire', () => {
    const entries = weeklyHistory('lats', [6, 6, 6, 6, 6, 0]);

    expect(volumeLowMuscles(entries, { hamstrings: { floor: 8 } }, NOW)).toEqual([]);
  });

  it('ignore un plancher nul, et un groupe qui n’est pas une région', () => {
    expect(
      volumeLowMuscles(training, { quads: { floor: 0 }, cardio: { floor: 5 } }, NOW),
    ).toEqual([]);
  });

  it('range les muscles dans l’ordre du corps, pas celui des réglages', () => {
    const lows = volumeLowMuscles(
      training,
      { calves: { floor: 4 }, chest: { floor: 4 }, quads: { floor: 4 } },
      NOW,
    );

    expect(lows.map((low) => low.muscle)).toEqual(['chest', 'quads', 'calves']);
  });

  it('lit une séance sans muscle résolu comme une séance : elle fait une semaine active', () => {
    const entries = [
      entry(inWeek(2), undefined, 5),
      entry(inWeek(1), undefined, 5),
    ];

    expect(volumeLowMuscles(entries, { chest: { floor: 4 } }, NOW)).toEqual([
      { muscle: 'chest', floor: 4, weeks: [0, 0] },
    ]);
  });
});

describe('les bornes relues d’un réglage', () => {
  it('garde un plancher et un plafond entiers, par muscle', () => {
    expect(
      normalizeVolumeBounds({
        hamstrings: { floor: 8 },
        chest: { floor: 6, ceiling: 16 },
        quads: { ceiling: 12 },
      }),
    ).toEqual({
      hamstrings: { floor: 8 },
      chest: { floor: 6, ceiling: 16 },
      quads: { ceiling: 12 },
    });
  });

  it.each([null, undefined, 3, 'chest', [], [{ chest: { floor: 8 } }], true])(
    'rend des bornes vides pour %j : une sauvegarde abîmée ne casse rien',
    (value) => {
      expect(normalizeVolumeBounds(value)).toEqual({});
    },
  );

  it('écarte ce qui n’est pas une borne : décimaux, négatifs, nuls, textes, trop grands', () => {
    expect(
      normalizeVolumeBounds({
        chest: { floor: 8.5, ceiling: 'seize' },
        lats: { floor: 0, ceiling: -4 },
        quads: { floor: 100, ceiling: Number.NaN },
        calves: { floor: 4, ceiling: Number.POSITIVE_INFINITY },
      }),
    ).toEqual({ calves: { floor: 4 } });
  });

  it('écarte un muscle qui n’existe pas, et un groupe qui n’est pas une région', () => {
    expect(
      normalizeVolumeBounds({
        wings: { floor: 4 },
        cardio: { floor: 4 },
        full_body: { ceiling: 9 },
        glutes: { floor: 4 },
      }),
    ).toEqual({ glutes: { floor: 4 } });
  });

  it('écarte un muscle dont rien n’a survécu, et ce qui n’est pas un objet', () => {
    expect(
      normalizeVolumeBounds({ chest: {}, lats: 8, quads: null, calves: { floor: 'x' } }),
    ).toEqual({});
  });
});
