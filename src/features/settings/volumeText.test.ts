import { describe, expect, it } from 'vitest';
import type { MuscleVolumeRow } from '@/data/repositories/coachVolume';
import { VOLUME_MIN_WEEKS_WORKED, type VolumeOverview } from '@/lib/coach/volume';
import { volumeBoundsReading, volumeLowLine, volumeReading } from './volumeText';

const overview = (over: Partial<VolumeOverview> = {}): VolumeOverview => ({
  rollingSets: 8,
  weeks: [0, 0, 8, 9, 10, 8],
  weeksWorked: 4,
  median: 8.5,
  max: 10,
  ...over,
});

const row = (over: Partial<MuscleVolumeRow> = {}): MuscleVolumeRow => ({
  muscle: 'chest',
  overview: overview(),
  bounds: {},
  ceiling: 10,
  ceilingUserSet: false,
  ...over,
});

describe('la ligne d’un muscle', () => {
  it('dit la semaine, la médiane et le maximum quand l’historique en dit assez', () => {
    expect(volumeReading(overview())).toBe('Semaine : 8 · médiane 8,5 · max 10');
  });

  it(`dit combien de semaines ont été travaillées sous ${VOLUME_MIN_WEEKS_WORKED}, sans chiffres qui n’en sont pas`, () => {
    expect(volumeReading(overview({ weeksWorked: 2, median: 9, max: 10 }))).toBe(
      'Semaine : 8 · travaillé 2 semaines sur 6',
    );
    expect(volumeReading(overview({ weeksWorked: 1, median: 9, max: 9 }))).toBe(
      'Semaine : 8 · travaillé 1 semaine sur 6',
    );
  });

  it('dit qu’un muscle n’a pas été travaillé en six semaines', () => {
    const never = overview({ rollingSets: 0, weeksWorked: 0, weeks: [0, 0, 0, 0, 0, 0] });
    delete never.median;
    delete never.max;

    expect(volumeReading(never)).toBe('Semaine : 0 · pas travaillé ces six semaines');
  });
});

describe('les bornes d’un muscle', () => {
  it('n’affiche rien de posé tant que rien ne l’est, et un plafond automatique comme tel', () => {
    expect(volumeBoundsReading(row())).toEqual({
      floor: 'Plancher —',
      ceiling: 'Plafond 10 (auto)',
    });
  });

  it('affiche ce que la personne a posé, sans « auto »', () => {
    expect(
      volumeBoundsReading(
        row({ bounds: { floor: 6, ceiling: 14 }, ceiling: 14, ceilingUserSet: true }),
      ),
    ).toEqual({ floor: 'Plancher 6', ceiling: 'Plafond 14' });
  });

  it('n’invente pas de plafond sans historique ni réglage', () => {
    const { ceiling, ...without } = row();
    void ceiling;

    expect(volumeBoundsReading(without).ceiling).toBe('Plafond —');
  });
});

describe('la ligne du volume bas', () => {
  it('nomme le muscle, les deux semaines et le plancher', () => {
    expect(volumeLowLine({ muscle: 'hamstrings', floor: 8, weeks: [3, 4] })).toBe(
      'Ischio-jambiers : 3 puis 4 séries — ton plancher est 8.',
    );
  });
});
