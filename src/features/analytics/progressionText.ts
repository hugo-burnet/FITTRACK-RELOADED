import type { RecordTimelineEntry } from '@/data/repositories/recordTimeline';
import { t } from '@/i18n/fr';
import { exerciseDisplayName, recordGain, recordLabel } from '@/i18n/labels';

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/**
 * « Développé couché (barre) · Charge max, +2,5 kg le lun. 16 nov. » — la phrase de la tuile « Dernier record ».
 * Le nom passe par `exerciseDisplayName`, comme sur la frise : un record établi à une main ne s'annonce pas
 * comme un record à deux.
 */
export function latestRecordLine(entry: RecordTimelineEntry): string {
  const { record } = entry;
  const gain = recordGain(record, entry.previousValue);
  const parts = {
    exercise: exerciseDisplayName(entry.exerciseName, entry.isUnilateral),
    type: recordLabel(record.type),
    date: dayFormatter.format(record.achievedAt),
  };

  return gain === undefined
    ? t('analytics.latestRecordLineFirst', parts)
    : t('analytics.latestRecordLine', { ...parts, gain });
}
