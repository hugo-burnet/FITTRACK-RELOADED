import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import { t } from '@/i18n/fr';
import { recordLabel, recordValue } from '@/i18n/labels';

/**
 * What the notification shade says about a record that has just fallen — RF-53.
 *
 * Not what the card says. `RecordNote` is read under the set that took it, so it
 * can rely on its position and say "+2,5 kg" without naming the exercise; a line
 * in the shade is read hours later, next to a message and two updates, and has
 * to name what it is about. Hence the exercise first, always.
 *
 * Several records at once become a count and the exercises concerned rather than
 * three lines: the detail is one tap away in the session, and a shade with three
 * near-identical lines is a shade you clear without reading.
 */
export function recordNotificationCopy(
  entries: readonly RecordTimelineEntry[],
): { title: string; body: string } | undefined {
  const [first] = entries;
  if (first === undefined) return undefined;

  const title = t('androidNotification.recordTitle');

  if (entries.length === 1) {
    return {
      title,
      body: t('androidNotification.recordOne', {
        exercise: first.exerciseName,
        record: recordLabel(first.record.type),
        value: recordValue(first.record),
      }),
    };
  }

  const exercises = [...new Set(entries.map((entry) => entry.exerciseName))];

  return {
    title,
    body: t('androidNotification.recordMany', {
      count: entries.length,
      exercises: new Intl.ListFormat('fr-FR', { style: 'long', type: 'conjunction' }).format(
        exercises,
      ),
    }),
  };
}
