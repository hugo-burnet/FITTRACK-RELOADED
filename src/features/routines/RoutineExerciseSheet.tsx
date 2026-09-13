import { useState } from 'react';
import type { RoutineExerciseDetail } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import { DEFAULT_REST_SECONDS, formatRest } from '@/lib/rest';
import { AddRow, Button, ConfirmAction, RestPicker, Sheet, Textarea } from '@/ui';

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
  const [notesOpen, setNotesOpen] = useState(false);

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
    // Ouverte d'office quand il y a quelque chose à lire, refermée sinon —
    // recalculé ici, avec le brouillon, plutôt que dans un effet : un effet
    // peindrait une image du repli de l'exercice précédent.
    setNotesOpen((line?.row.notes ?? '') !== '');
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
          <RestPicker
            value={draft.rest}
            onChange={(rest) => {
              setDraft({ ...draft, rest });
              // 0 is the schema's "use the exercise default" (§4.2), so an empty
              // picker and a zero mean the same thing and store the same thing.
              onWrite({ restSeconds: rest ?? 0 });
            }}
            // The exercise's own rest is what an empty picker inherits: shown
            // muted in the well and stepped from, so clearing back to it never
            // looks like the rest set in the library was lost.
            baseWhenEmpty={exerciseRest > 0 ? exerciseRest : DEFAULT_REST_SECONDS}
            emptyReading={exerciseRest > 0 ? formatRest(exerciseRest) : t('rest.none')}
            clearLabel={t('routine.restInherit')}
            aria-label={t('routine.restLabel')}
          />
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
            {exerciseRest > 0
              ? t('routine.restFromExercise')
              : t('routine.restNoDefault')}
          </p>
        </div>

        {/* Repliée tant qu'il n'y a rien à lire.

            Un `<textarea rows={4}>` ouvert en permanence coûtait un tiers de la
            hauteur de la feuille à une ligne sur dix qui s'en sert, et poussait
            « Grouper » et « Retirer » sous le pli sur un écran de téléphone —
            les deux actions pour lesquelles on ouvre cette feuille le plus
            souvent. Une note déjà écrite, elle, s'ouvre d'office : la replier
            la cacherait derrière un geste, ce qui est exactement le défaut
            qu'on vient corriger côté carte.

            L'état d'ouverture est local et non persisté, volontairement : il se
            reconstruit de la note elle-même à chaque ouverture, donc il n'y a
            rien à remettre en phase quand la note change ailleurs. */}
        {notesOpen ? (
          <Textarea
            label={t('routine.notesLabel')}
            hint={t('routine.notesHint')}
            placeholder={t('routine.notesPlaceholder')}
            value={draft.notes}
            onChange={(event) => {
              setDraft({ ...draft, notes: event.target.value });
              onWrite({ notes: event.target.value });
            }}
          />
        ) : (
          // `AddRow` et pas un bouton maison : c'est le seul geste d'ajout de
          // l'app, et en inventer un deuxième ici ferait cohabiter deux langues
          // sur la même feuille — le défaut que ce composant raconte lui-même.
          <div className="-mx-4">
            <AddRow label={t('routine.notesAdd')} onClick={() => setNotesOpen(true)} />
          </div>
        )}

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
