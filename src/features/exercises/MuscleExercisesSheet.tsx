import { useAppNavigate } from '@/app/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { listExercises } from '@/data/repositories/exercises';
import { t } from '@/i18n/fr';
import { muscleLabel } from '@/i18n/labels';
import { Button, Sheet } from '@/ui';
import { groupOfMuscleId, type MuscleId } from '@/ui/muscleMap';
import { ExerciseList } from './ExerciseList';

interface Props {
  open: boolean;
  /**
   * Kept by the caller through the closing animation, so the title does not
   * change to a fallback under the thumb on the way out. `null` only before the
   * first tap of the session.
   */
  muscle: MuscleId | null;
  onClose: () => void;
}

/**
 * What a muscle of a drawn body is trained by.
 *
 * **Chez le catalogue, et pas chez l'accueil.** La feuille ne sait rien de
 * l'écran qui l'ouvre : on lui donne un muscle, elle répond avec les exercices
 * du catalogue qui le ciblent. L'accueil l'ouvre depuis les douze dernières
 * semaines, le Journal depuis une séance passée, et la réponse est la même — ce
 * qui est exactement ce qu'on attend d'un même geste sur un même dessin.
 *
 * **A sheet rather than a jump to the catalogue, and the reason is the finger.**
 * The drawing carries twenty-six muscles inside 300 pixels: the lateral deltoid
 * is twenty pixels wide, nowhere near the 48 the charte asks of a target. Some
 * taps will land next door — that is not a bug to fix but a fact to absorb. A
 * sheet names what it understood ("Épaules") and costs a swipe to dismiss; a
 * navigation would have spent the screen underneath on a mis-tap.
 *
 * **The catalogue's own vocabulary, not the drawing's.** A tap on the lateral
 * deltoid opens *Épaules*, not *deltoïde latéral* — the catalogue files
 * exercises by group and knows nothing finer. Naming the muscle would promise a
 * precision the data does not have.
 *
 * **Primary muscle only**, exactly like the library's filter behind
 * `Voir dans le catalogue`. A list that counted secondary involvement here and
 * not there would make the same muscle answer two different numbers.
 */
export function MuscleExercisesSheet({ open, muscle, onClose }: Props) {
  const navigate = useAppNavigate();
  const group = muscle === null ? null : groupOfMuscleId(muscle);

  const exercises = useLiveQuery(
    async () => (group === null ? [] : await listExercises({ muscle: group })),
    [group],
  );

  const goTo = (path: string) => {
    // Closed first: coming back from the catalogue to a screen with a sheet
    // still standing over it would be the app remembering something the user
    // has already left.
    onClose();
    void navigate(path);
  };

  const title = group === null ? t('muscleSheet.unknown') : muscleLabel(group);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {/* Le contenu d'une feuille est déjà en `px-5` : rien ici ne repose sa
          propre marge, et la liste ressort aux bords comme celle d'`OptionSheet`. */}
      {group === null ? (
        <p className="pb-4 text-sm leading-relaxed text-[var(--text-2)]">
          {t('muscleSheet.unknownBody')}
        </p>
      ) : (
        <div className="space-y-3 pb-4">
          <p className="text-sm text-[var(--text-2)]">
            {exercises === undefined
              ? ''
              : exercises.length === 0
                ? t('muscleSheet.empty')
                : exercises.length === 1
                  ? t('muscleSheet.countOne')
                  : t('muscleSheet.count', { count: exercises.length })}
          </p>

          {exercises !== undefined && exercises.length > 0 && (
            <div className="-mx-5">
              <ExerciseList
                exercises={exercises}
                // Never grouped: these lists run from three rows to about twenty,
                // and letter headings on twenty rows are furniture, not structure.
                grouped={false}
                onOpen={(exercise) => goTo(`/exercises/${exercise.id}`)}
              />
            </div>
          )}

          <Button
            variant="secondary"
            fullWidth
            tutorialId="muscle-sheet-catalogue"
            onClick={() => goTo(`/exercises?muscle=${group}`)}
          >
            {t('muscleSheet.all')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
