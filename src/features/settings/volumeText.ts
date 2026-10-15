import type { MuscleVolumeRow } from '@/data/repositories/coachVolume';
import { t } from '@/i18n/fr';
import { muscleLabel } from '@/i18n/labels';
import { VOLUME_MIN_WEEKS_WORKED, type VolumeLow, type VolumeOverview } from '@/lib/coach/volume';
import { formatNumber } from '@/ui/numberField';

/**
 * Les phrases du volume par muscle : des chiffres de `lib/coach/volume` mis en français. Séparées de
 * l'écran pour se tester sans lui (même place que `backupText`).
 */

/**
 * La semaine en cours et ce que six semaines en disent. Sous `VOLUME_MIN_WEEKS_WORKED` semaines
 * travaillées, la médiane et le maximum ne sont pas écrits : ce ne sont pas des chiffres sur lesquels
 * la règle se fie, et l'écran ne les présente pas comme tels.
 */
export function volumeReading(overview: VolumeOverview): string {
  const current = overview.rollingSets;
  if (overview.weeksWorked === 0) return t('muscleVolume.readingNever', { current });
  if (overview.weeksWorked < VOLUME_MIN_WEEKS_WORKED) {
    return overview.weeksWorked === 1
      ? t('muscleVolume.readingOneWeek', { current })
      : t('muscleVolume.readingFewWeeks', { current, weeks: overview.weeksWorked });
  }
  return t('muscleVolume.reading', {
    current,
    median: formatNumber(overview.median),
    max: formatNumber(overview.max),
  });
}

/** Ce qui est posé pour le muscle : le plancher, et le plafond — « auto » s'il vient de l'historique. */
export function volumeBoundsReading(row: MuscleVolumeRow): { floor: string; ceiling: string } {
  const { floor } = row.bounds;
  return {
    floor: floor === undefined ? t('muscleVolume.floorNone') : t('muscleVolume.floorValue', { sets: floor }),
    ceiling:
      row.ceiling === undefined
        ? t('muscleVolume.ceilingNone')
        : t(row.ceilingUserSet ? 'muscleVolume.ceilingValue' : 'muscleVolume.ceilingAuto', {
            sets: row.ceiling,
          }),
  };
}

/** « Ischio-jambiers : 3 puis 4 séries — ton plancher est 8. » */
export function volumeLowLine(low: VolumeLow): string {
  const [first = 0, second = 0] = low.weeks;
  return t('muscleVolume.lowLine', {
    muscle: muscleLabel(low.muscle),
    first,
    second,
    floor: low.floor,
  });
}
