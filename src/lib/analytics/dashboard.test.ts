import { describe, expect, it } from 'vitest';
import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';
import {
  heldWeeksStreak,
  programEndDate,
  splitReading,
  weekSessions,
  weekTonnage,
  weightChange,
} from './dashboard';
import type { WeeklyVolumeBucket } from './volume';
import type { WeekBucket } from './weeks';

const first = startOfLocalWeek(new Date(2026, 0, 5, 12).getTime());
const weekAt = (index: number): number => addLocalWeeks(first, index);

const tonnages = (values: number[]): WeeklyVolumeBucket[] =>
  values.map((tonnage, index) => ({ weekStart: weekAt(index), tonnage, durationSeconds: 0 }));

const counts = (rows: Array<[number, number | null]>): WeekBucket[] =>
  rows.map(([sessions, goal], index) => ({ weekStart: weekAt(index), sessions, goal }));

describe('weekTonnage', () => {
  it('rend rien sans aucune semaine connue', () => {
    expect(weekTonnage([])).toBeNull();
  });

  it('lit la semaine en cours dans le dernier seau et trace les huit dernières semaines', () => {
    const reading = weekTonnage(tonnages([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(reading?.current).toBe(10);
    expect(reading?.series).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('moyenne les douze dernières semaines, semaine en cours comprise, comme l’écran Volume', () => {
    const values = Array.from({ length: 14 }, (_, index) => (index + 1) * 100);
    // Les douze dernières : 300 … 1 400.
    expect(weekTonnage(tonnages(values))?.average).toBe((300 + 1_400) / 2);
  });

  it('ne moyenne que les semaines connues quand l’histoire est plus courte', () => {
    const reading = weekTonnage(tonnages([100, 300]));
    expect(reading?.series).toEqual([100, 300]);
    expect(reading?.average).toBe(200);
  });

  it('dit le nombre de semaines que la moyenne porte, pas toujours douze', () => {
    expect(weekTonnage(tonnages([100, 300, 200]))?.averageWeeks).toBe(3);
    expect(weekTonnage(tonnages(Array.from({ length: 30 }, () => 100)))?.averageWeeks).toBe(12);
  });
});

describe('heldWeeksStreak', () => {
  it('compte les semaines tenues d’affilée jusqu’à la semaine en cours si elle est tenue', () => {
    expect(heldWeeksStreak(counts([[1, 3], [3, 3], [4, 3], [3, 3]]))).toBe(3);
  });

  it('ne casse pas la série pour une semaine en cours pas encore tenue', () => {
    expect(heldWeeksStreak(counts([[3, 3], [3, 3], [1, 3]]))).toBe(2);
  });

  it('s’arrête à la première semaine manquée ou sans objectif', () => {
    expect(heldWeeksStreak(counts([[3, 3], [2, 3], [3, 3], [3, 3]]))).toBe(2);
    expect(heldWeeksStreak(counts([[3, null], [3, 3]]))).toBe(1);
  });

  it('vaut zéro sans objectif ni semaine', () => {
    expect(heldWeeksStreak([])).toBe(0);
    expect(heldWeeksStreak(counts([[2, null]]))).toBe(0);
  });
});

describe('weekSessions', () => {
  it('rend rien sans semaine connue', () => {
    expect(weekSessions([])).toBeNull();
  });

  it('lit la semaine en cours, son objectif et la série', () => {
    expect(weekSessions(counts([[3, 3], [2, 3]]))).toEqual({ done: 2, goal: 3, streak: 1 });
  });

  it('garde un objectif absent à null', () => {
    expect(weekSessions(counts([[2, null]]))).toEqual({ done: 2, goal: null, streak: 0 });
  });
});

describe('weightChange', () => {
  it('rend rien sans pesée précédente', () => {
    expect(weightChange(82.4, undefined)).toBeUndefined();
  });

  it('écarte le bruit des flottants', () => {
    expect(weightChange(82.4, 84.1)).toBe(-1.7);
    expect(weightChange(84.1, 82.4)).toBe(1.7);
    expect(weightChange(82.3, 82.3)).toBe(0);
  });
});

describe('programEndDate', () => {
  it('tombe sur le dernier jour de la dernière semaine', () => {
    const startsAt = new Date(2026, 10, 2).getTime(); // lundi 2 nov. 2026
    expect(programEndDate(startsAt, 6)).toBe(new Date(2026, 11, 13).getTime());
  });

  it('reste sur la date civile à travers un changement d’heure', () => {
    const startsAt = new Date(2026, 9, 12).getTime();
    expect(new Date(programEndDate(startsAt, 4)).getDate()).toBe(8);
  });
});

describe('splitReading', () => {
  it('sépare le chiffre de son unité', () => {
    expect(splitReading('85 kg')).toEqual({ value: '85', unit: 'kg' });
    expect(splitReading('13 560 kg')).toEqual({ value: '13 560', unit: 'kg' });
  });

  it('laisse tel quel ce qui n’a pas d’unité', () => {
    expect(splitReading('27')).toEqual({ value: '27' });
    expect(splitReading('1 h 05')).toEqual({ value: '1 h 05' });
  });
});
