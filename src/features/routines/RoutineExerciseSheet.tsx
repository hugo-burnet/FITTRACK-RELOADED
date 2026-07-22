import { useState } from 'react';
import type { RoutineExerciseDetail } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import { Button, ConfirmAction, NumberInput, Sheet, Textarea } from '@/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  line: RoutineExerciseDetail | null;
  /** False on the first exercise: there is nothing above to group with. */
  canGroup: boolean;
  onWrite: (changes: { restSeconds?: number; notes?: string }) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onRemove: () => void;
};

/**
 * Everything about one exercise *inside this routine* — its rest, its notes, its
 * place in a superset, and the way out of the routine.
 *
 * One sheet and one entry point rather than a menu that opens further menus:
 * rest and notes are settings, grouping and removing are actions, but they all
 * answer the same question ("what about this line?") and splitting them across
 * two openers would only make the user guess which one they need.
 */
export function RoutineExerciseSheet({
  open,
  onClose,
  line,
  canGroup,
  onWrite,
  onGroup,
  onUngroup,
  onRemove,
}: Props) {
  const [draft, setDraft] = useState<{ rest?: number; notes: string }>({ notes: '' });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Adjusted during render rather than in an effect, per the Lot 1 note: an
  // effect would paint one frame carrying the previous exercise's notes.
  const key = open && line !== null ? line.row.id : null;
  if (loadedFor !== key) {
    setLoadedFor(key);
    setDraft({
      // 0 is the schema's "no override", which is an empty field, not a zero.
      rest: line !== null && line.row.restSeconds > 0 ? line.row.restSeconds : undefined,
      notes: line?.row.notes ?? '',
    });
  }

  const grouped = (line?.row.supersetGroup ?? 0) !== 0;
  const exerciseRest = line?.exercise?.defaultRestSeconds ?? 0;

  return (
    <Sheet open={open} onClose={onClose} title={t('routine.exerciseSheetTitle')}>
      <div className="flex flex-col gap-6 pb-2">
        <div>
          <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
            {t('routine.restLabel')}
          </p>
          <NumberInput
            value={draft.rest}
            onChange={(rest) => {
              setDraft({ ...draft, rest });
              // 0 is the schema's "use the exercise default" (§4.2), so an empty
              // field and a zero mean the same thing and store the same thing.
              onWrite({ restSeconds: rest ?? 0 });
            }}
            step={15}
            max={900}
            // The exercise's own rest, shown in the empty field: without it an
            // empty box looked like the rest set back in the library was lost.
            placeholder={exerciseRest > 0 ? String(exerciseRest) : undefined}
            suffix={t('units.seconds')}
            aria-label={t('routine.restLabel')}
          />
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
            {exerciseRest > 0
              ? t('routine.restFromExercise', { seconds: exerciseRest })
              : t('routine.restNoDefault')}
          </p>
        </div>

        <Textarea
          label={t('routine.notesLabel')}
          placeholder={t('routine.notesPlaceholder')}
          value={draft.notes}
          onChange={(event) => {
            setDraft({ ...draft, notes: event.target.value });
            onWrite({ notes: event.target.value });
          }}
        />

        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-6">
          {grouped ? (
            <>
              <Button
                fullWidth
                size="lg"
                onClick={() => {
                  onUngroup();
                  onClose();
                }}
              >
                {t('routine.ungroup')}
              </Button>
              <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">
                {t('routine.ungroupHint')}
              </p>
            </>
          ) : (
            <>
              <Button
                fullWidth
                size="lg"
                disabled={!canGroup}
                onClick={() => {
                  onGroup();
                  onClose();
                }}
              >
                {t('routine.groupWithPrevious')}
              </Button>
              <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">
                {t('routine.groupHint')}
              </p>
            </>
          )}
        </div>

        {/* Arms in place: removing the line destroys the sets you typed on it,
            even though the exercise itself stays in the library. */}
        <div className="-mx-4 border-t border-[var(--border)]">
          <ConfirmAction
            label={t('routine.remove')}
            hint={t('routine.removeHint')}
            confirmLabel={t('routine.removeConfirm')}
            danger
            onConfirm={() => {
              onRemove();
              onClose();
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}
