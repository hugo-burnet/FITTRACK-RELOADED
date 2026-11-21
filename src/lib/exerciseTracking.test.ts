import { describe, expect, it } from 'vitest';
import type { HistoricalSet, HistoricalWorkout } from '@/lib/historyProjection';
import { exerciseSessions, lastTimeSummary, progressTrend, splitReading } from './exerciseTracking';

const set = (
  weight: number,
  reps: number,
  setType: HistoricalSet['setType'] = 'normal',
): HistoricalSet => ({
  setType,
  side: 'both',
  weight,
  reps,
});

const workout = (
  workoutId: string,
  startedAt: number,
  blocks: HistoricalSet[][],
): HistoricalWorkout => ({
  workoutId,
  name: 'Poussée',
  startedAt,
  durationSeconds: 3600,
  exercises: blocks.map((sets) => ({ exerciseId: 'bench', sets })),
});

describe('exerciseSessions', () => {
  it('une ligne par séance terminée, la plus récente d’abord', () => {
    const sessions = exerciseSessions([
      workout('old', 1_000, [[set(75, 8)]]),
      workout('new', 2_000, [[set(80, 8)]]),
    ]);
    expect(sessions.map((s) => s.workoutId)).toEqual(['new', 'old']);
    expect(sessions[0]?.startedAt).toBe(2_000);
  });

  it('fusionne les blocs d’un exercice fait deux fois dans la même séance', () => {
    const [session] = exerciseSessions([workout('w', 1_000, [[set(80, 8)], [set(70, 10)]])]);
    expect(session?.sets).toHaveLength(2);
  });

  it('ignore une séance sans aucune série', () => {
    expect(exerciseSessions([workout('w', 1_000, [[]])])).toEqual([]);
  });
});

describe('lastTimeSummary', () => {
  it('donne la charge et la suite des reps quand toutes les séries de travail pèsent pareil', () => {
    const summary = lastTimeSummary([set(50, 8, 'warmup'), set(85, 6), set(85, 5), set(85, 5)]);
    expect(summary).toEqual({ setCount: 3, weight: 85, reps: [6, 5, 5] });
  });

  it('ne donne pas de charge unique quand elle varie', () => {
    const summary = lastTimeSummary([set(80, 8), set(70, 10)]);
    expect(summary.setCount).toBe(2);
    expect(summary.weight).toBeUndefined();
  });

  it('compte zéro série de travail quand il n’y a que des échauffements', () => {
    expect(lastTimeSummary([set(40, 10, 'warmup')]).setCount).toBe(0);
  });
});

describe('progressTrend', () => {
  const point = (timestamp: number, value: number) => ({
    workoutId: `w${timestamp}`,
    timestamp,
    value,
  });

  it('garde les dernières séances et calcule l’écart depuis la première', () => {
    const trend = progressTrend([point(1, 75), point(2, 80), point(3, 85)], 2);
    expect(trend?.window.map((p) => p.value)).toEqual([80, 85]);
    expect(trend?.delta).toBe(5);
    expect(trend?.since).toBe(2);
    expect(trend?.last.value).toBe(85);
  });

  it('un seul point : pas d’écart', () => {
    const trend = progressTrend([point(1, 75)], 12);
    expect(trend?.delta).toBeUndefined();
    expect(trend?.last.value).toBe(75);
  });

  it('aucun point : rien', () => {
    expect(progressTrend([], 12)).toBeUndefined();
  });
});

describe('splitReading', () => {
  it('sépare le chiffre de son unité usuelle', () => {
    expect(splitReading('122,5 kg')).toEqual({ value: '122,5', unit: 'kg' });
    expect(splitReading('12 reps')).toEqual({ value: '12', unit: 'reps' });
    expect(splitReading('1\u202f240 kg')).toEqual({ value: '1\u202f240', unit: 'kg' });
  });

  it('laisse entière une lecture qui n’est pas un chiffre et son unité', () => {
    expect(splitReading('1 h 12')).toEqual({ value: '1 h 12' });
    expect(splitReading('0:45')).toEqual({ value: '0:45' });
    expect(splitReading('80 kg × 8')).toEqual({ value: '80 kg × 8' });
  });
});
