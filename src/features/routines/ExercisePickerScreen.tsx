import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { addExercisesToRoutine } from '@/data/repositories/routines';
import { ExerciseBrowser } from '@/features/exercises/ExerciseBrowser';
import type { BrowserQuery } from '@/features/exercises/ExerciseBrowser';
import { t } from '@/i18n/fr';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { ActionBand } from '@/ui';

/**
 * Picking exercises for a routine — the Lot 3 library in "choose" mode.
 *
 * A full screen rather than a sheet, for three reasons that all come from the
 * list being 168 rows long: a sheet caps at 88% and would nest a scroll area
 * inside a scroll area; the library's sticky letter headings are drawn against
 * the page background and would paint over a sheet's surface; and the Android
 * back button of Lot 10 gets the right behaviour for free.
 *
 * The query is local state, not the URL: this is a step inside composing a
 * routine, not a place to come back to.
 */
export function ExercisePickerScreen() {
  const { id = '' } = useParams();
  const navigate = useAppNavigate();
  const tutorial = useTutorialControls();

  const [query, setQuery] = useState<BrowserQuery>({ search: '' });
  const [selected, setSelected] = useState<string[]>([]);
  /*
   * Le slug de chaque exercice retenu, appris au moment du choix.
   *
   * L'écran ne manipule que des identifiants, et un identifiant ne dit pas
   * *quel* exercice c'est : une mission qui demande le curl haltères ne peut
   * pas le reconnaître dans un UUID. Le slug est relevé sur la ligne touchée,
   * là où l'exercice complet est encore sous la main.
   */
  const [slugs] = useState(() => new Map<string, string>());

  const toggle = (exerciseId: string) =>
    setSelected((current) =>
      current.includes(exerciseId)
        ? current.filter((row) => row !== exerciseId)
        : [...current, exerciseId],
    );

  const add = () => {
    const picked = selected.flatMap((exerciseId) => {
      const slug = slugs.get(exerciseId);
      return slug === undefined ? [] : [slug];
    });
    // Added in the order they were tapped, which is the order they were meant.
    void addExercisesToRoutine(id, selected).then(() => {
      tutorial?.report({ type: 'routine-exercise-added', routineId: id, exerciseSlugs: picked });
      navigate(-1);
    });
  };

  return (
    <Screen
      title={t('picker.title')}
      onBack={() => void navigate(-1)}
      /* Pinned in the thumb zone, and only once there is something to add: an
         always-present disabled button is a target that teaches you nothing. */
      footer={
        selected.length > 0 ? (
          <ActionBand
            label={
              selected.length === 1
                ? t('picker.addOne')
                : t('picker.add', { count: selected.length })
            }
            tutorialId="routine-exercise-add-confirm"
            onClick={add}
          />
        ) : undefined
      }
    >
      <ExerciseBrowser
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          tutorial?.report({
            type: 'routine-exercise-query-changed',
            routineId: id,
            query: next.search,
          });
        }}
        onPick={(exercise) => {
          toggle(exercise.id);
          // Un exercice personnel n'a pas de slug : rien à retenir et rien à
          // annoncer, puisque aucune mission ne peut en désigner un qui
          // n'existe que chez cet utilisateur.
          if (exercise.slug === undefined) return;
          slugs.set(exercise.id, exercise.slug);
          tutorial?.report({
            type: 'routine-exercise-selected',
            routineId: id,
            exerciseSlug: exercise.slug,
          });
        }}
        selectedIds={new Set(selected)}
      />
    </Screen>
  );
}
