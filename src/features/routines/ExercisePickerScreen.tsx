import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { addExercisesToRoutine } from '@/data/repositories/routines';
import { ExerciseBrowser } from '@/features/exercises/ExerciseBrowser';
import type { BrowserQuery } from '@/features/exercises/ExerciseBrowser';
import { t } from '@/i18n/fr';
import { Button } from '@/ui';

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
  const navigate = useNavigate();

  const [query, setQuery] = useState<BrowserQuery>({ search: '' });
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (exerciseId: string) =>
    setSelected((current) =>
      current.includes(exerciseId)
        ? current.filter((row) => row !== exerciseId)
        : [...current, exerciseId],
    );

  const add = () => {
    // Added in the order they were tapped, which is the order they were meant.
    void addExercisesToRoutine(id, selected).then(() => navigate(-1));
  };

  return (
    <Screen
      title={t('picker.title')}
      onBack={() => void navigate(-1)}
      /* Pinned in the thumb zone, and only once there is something to add: an
         always-present disabled button is a target that teaches you nothing. */
      footer={
        selected.length > 0 ? (
          <Button variant="primary" size="lg" fullWidth onClick={add}>
            {selected.length === 1
              ? t('picker.addOne')
              : t('picker.add', { count: selected.length })}
          </Button>
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
