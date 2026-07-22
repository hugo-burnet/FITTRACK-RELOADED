import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { addWorkoutExercise, getActiveWorkout } from '@/data/repositories/workouts';
import { ExerciseBrowser } from '@/features/exercises/ExerciseBrowser';
import type { BrowserQuery } from '@/features/exercises/ExerciseBrowser';
import { t } from '@/i18n/fr';
import { ActionBand } from '@/ui';

/**
 * RF-21 — an exercise you did not plan, added mid-session.
 *
 * The same Lot 3 library in "choose" mode as the routine picker, and a full
 * screen for the same three reasons: 168 rows would nest a scroll area inside a
 * sheet, the sticky letter headings are drawn against the page background, and
 * the Android back button of Lot 10 behaves correctly for free.
 */
export function WorkoutAddExerciseScreen() {
  const navigate = useNavigate();
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);

  const [query, setQuery] = useState<BrowserQuery>({ search: '' });
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (exerciseId: string) =>
    setSelected((current) =>
      current.includes(exerciseId)
        ? current.filter((row) => row !== exerciseId)
        : [...current, exerciseId],
    );

  const add = async () => {
    if (active == null) return;
    // Sequentially, and in the order they were tapped: each call reads the
    // current count to place its row, so a Promise.all would hand them all the
    // same rank.
    for (const exerciseId of selected) await addWorkoutExercise(active.id, exerciseId);
    void navigate(-1);
  };

  return (
    <Screen
      title={t('picker.title')}
      onBack={() => void navigate(-1)}
      footer={
        selected.length > 0 ? (
          <ActionBand
            label={
              selected.length === 1
                ? t('picker.addOne')
                : t('picker.add', { count: selected.length })
            }
            onClick={() => void add()}
          />
        ) : undefined
      }
    >
      <ExerciseBrowser
        query={query}
        onQueryChange={setQuery}
        onPick={(exercise) => toggle(exercise.id)}
        selectedIds={new Set(selected)}
      />
    </Screen>
  );
}
