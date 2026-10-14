import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { useAppNavigate } from '@/app/navigation';
import { replaceWorkoutExercise } from '@/data/repositories/workouts';
import { ExerciseBrowser } from '@/features/exercises/ExerciseBrowser';
import type { BrowserQuery } from '@/features/exercises/ExerciseBrowser';
import { t } from '@/i18n/fr';
import { workoutExerciseNameOf, workoutLineOf } from './workoutLookups';
import { useActiveWorkout } from './useActiveWorkout';

/**
 * « La machine est prise » : l'autre exercice, choisi dans la bibliothèque, pour ce qu'il reste à
 * faire de celui-ci.
 *
 * Le même choix qu'à l'ajout d'un exercice en séance (`WorkoutAddExerciseScreen`), et pour les
 * mêmes raisons un écran entier : 168 lignes ne se logent pas dans une feuille. À une différence
 * près qui change tout le geste : on ne coche pas, on **touche** — un seul exercice, et la
 * séance est refaite dès qu'il est choisi. Entre deux séries, essoufflé, un second bouton de
 * confirmation est un appui de trop.
 *
 * Le détail de ce qui est remplacé — et de ce qui ne l'est jamais — est dans
 * `replaceWorkoutExercise`.
 */
export function WorkoutReplaceExerciseScreen() {
  const { rowId = '' } = useParams();
  const navigate = useAppNavigate();
  const { detail } = useActiveWorkout();

  const [query, setQuery] = useState<BrowserQuery>({ search: '' });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const exercises = detail?.exercises ?? [];
  const line = workoutLineOf(exercises, rowId);
  // Lu avant que la séance ait répondu, `detail` est `undefined` : on ne dit pas « disparu » à
  // quelqu'un dont la séance est simplement en train de se charger.
  const gone = detail !== undefined && line === null;

  const replace = async (exerciseId: string) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const outcome = await replaceWorkoutExercise(rowId, exerciseId);
      if (outcome === 'unknown' || outcome === 'nothing_left') {
        setFailed(true);
        return;
      }
      void navigate('/workout');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('workout.replaceExercise')} onBack={() => void navigate(-1)}>
      {/* Le nom de l'exercice remplacé dans le corps, pas dans le titre : un titre tient sur une
          ligne et « Squat (barre, nuque) » s'y coupait en « Squat (bar… » — l'information même
          qu'on cherche en arrivant ici. */}
      <p className="mb-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">
        {t('workout.replaceFor', { name: workoutExerciseNameOf(exercises, rowId) })}
      </p>
      {(failed || gone) && (
        <p role="status" className="mb-3 px-1 text-sm leading-relaxed text-[var(--danger-ink)]">
          {gone ? t('workout.replaceGone') : t('workout.replaceFailed')}
        </p>
      )}
      <ExerciseBrowser
        query={query}
        onQueryChange={setQuery}
        onPick={(exercise) => void replace(exercise.id)}
      />
    </Screen>
  );
}
