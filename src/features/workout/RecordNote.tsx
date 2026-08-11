import { t } from '@/i18n/fr';
import { recordGain, recordLabel, recordValue } from '@/i18n/labels';
import { StarIcon } from '@/ui/icons';
import type { WorkoutRecordNotice } from './WorkoutExerciseCard';

/**
 * RF-23 — « Record · Charge max », under the set that just took it.
 *
 * **In the card, never in a toast.** A strip at the foot of the screen cannot say
 * *which* of twenty lines beat *what*, and by the time you have found the line it
 * is gone — the reasoning `UndoRow` already carries from Lot 5, applied to the
 * opposite emotion. Here the position *is* half the message.
 *
 * A single category keeps its value and gain in one short sentence. When one
 * set wins several categories, the same line names all of them instead of
 * silently choosing a headline and losing persisted information.
 *
 * Not in the 48 px rank slot either. That slot belongs to the set *type* since
 * task 1, and a record can perfectly well be a drop set or a set to failure —
 * two marks would have to share a target that does not hold one and a half.
 *
 * The accent is legitimate here in a way it is nowhere else: the charter reserves
 * it for validated sets **and records**, and this is both.
 */
export function RecordNote({ notice }: { notice: WorkoutRecordNotice }) {
  const [onlyType] = notice.types;
  const onlyEntry =
    notice.types.length === 1
      ? notice.entries.find(({ record }) => record.type === onlyType)
      : undefined;
  const gain =
    onlyEntry === undefined
      ? undefined
      : recordGain(onlyEntry.record, onlyEntry.previousValue);
  const reading =
    onlyEntry !== undefined && gain !== undefined
      ? t('workout.recordBeaten', {
          record: recordLabel(onlyEntry.record.type),
          value: recordValue(onlyEntry.record),
          gain,
        })
      : t('workout.recordsBeaten', {
          count: notice.types.length,
          records: new Intl.ListFormat('fr-FR', {
            style: 'long',
            type: 'conjunction',
          }).format(notice.types.map(recordLabel)),
        });

  return (
    <p
      role="status"
      // The validated surface of the row above, continued: the strip is the
      // bottom of that row, not a line of its own. 12 px in — the inset `RestRail`
      // already uses, so the two things that hang off a set line agree.
      className="label-xs flex items-center gap-1.5 bg-[var(--surface-2)] px-3 pb-2.5
        font-semibold text-[var(--accent-ink)]"
    >
      <StarIcon width={14} height={14} className="shrink-0" />
      {reading}
    </p>
  );
}
