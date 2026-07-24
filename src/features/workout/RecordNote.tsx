import type { RecordKind } from '@/lib/records';
import { t } from '@/i18n/fr';
import { recordLabel } from '@/i18n/labels';
import { StarIcon } from '@/ui/icons';

/**
 * RF-23 — « Record · Charge max », under the set that just took it.
 *
 * **In the card, never in a toast.** A strip at the foot of the screen cannot say
 * *which* of twenty lines beat *what*, and by the time you have found the line it
 * is gone — the reasoning `UndoRow` already carries from Lot 5, applied to the
 * opposite emotion. Here the position *is* half the message.
 *
 * It does not repeat the figures it beat: the "précédent" cell of that very row
 * already shows last session's, two centimetres up, and the row itself shows what
 * was just lifted. What was missing was the verdict.
 *
 * Not in the 48 px rank slot either. That slot belongs to the set *type* since
 * task 1, and a record can perfectly well be a drop set or a set to failure —
 * two marks would have to share a target that does not hold one and a half.
 *
 * The accent is legitimate here in a way it is nowhere else: the charter reserves
 * it for validated sets **and records**, and this is both.
 */
export function RecordNote({ kind }: { kind: RecordKind }) {
  return (
    <p
      // The validated surface of the row above, continued: the strip is the
      // bottom of that row, not a line of its own. 12 px in — the inset `RestRail`
      // already uses, so the two things that hang off a set line agree.
      className="label-xs flex items-center gap-1.5 bg-[var(--surface-2)] px-3 pb-2.5
        font-semibold text-[var(--accent-ink)]"
    >
      <StarIcon width={14} height={14} className="shrink-0" />
      {t('workout.recordBeaten', { record: recordLabel(kind) })}
    </p>
  );
}
