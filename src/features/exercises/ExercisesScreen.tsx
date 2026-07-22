import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/data/types';
import { t } from '@/i18n/fr';
import { HeaderAction } from '@/ui';
import { PlusIcon } from '@/ui/icons';
import { ExerciseBrowser } from './ExerciseBrowser';
import type { BrowserQuery } from './ExerciseBrowser';

/** Reads a URL parameter back into its union, without a cast and without trusting it. */
function pickFrom<T extends string>(values: readonly T[], raw: string | null): T | undefined {
  return values.find((value) => value === raw);
}

/**
 * The library. All the browsing lives in `ExerciseBrowser`, which the routine
 * picker of Lot 4 shares; what is left here is the one thing that is this
 * screen's own — keeping the query in the URL.
 */
export function ExercisesScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // The URL is the source of truth for the search and the two filters: opening
  // an exercise and coming back must land on the list you left, not on 168 rows
  // from the top. `replace` keeps one history entry for the screen, so the back
  // button does not have to walk back through every keystroke.
  const query: BrowserQuery = {
    search: params.get('q') ?? '',
    muscle: pickFrom(MUSCLE_GROUPS, params.get('muscle')),
    equipment: pickFrom(EQUIPMENT, params.get('equipment')),
  };

  const setQuery = (next: BrowserQuery) => {
    const written = new URLSearchParams();
    if (next.search !== '') written.set('q', next.search);
    if (next.muscle !== undefined) written.set('muscle', next.muscle);
    if (next.equipment !== undefined) written.set('equipment', next.equipment);
    setParams(written, { replace: true });
  };

  return (
    <Screen
      title={t('exercises.title')}
      action={
        <HeaderAction
          label={t('exercises.create')}
          onClick={() => void navigate('/exercises/new')}
        >
          <PlusIcon />
        </HeaderAction>
      }
    >
      <ExerciseBrowser
        query={query}
        onQueryChange={setQuery}
        onPick={(exercise) => void navigate(`/exercises/${exercise.id}`)}
        onCreate={(name) => void navigate(`/exercises/new?name=${encodeURIComponent(name)}`)}
      />
    </Screen>
  );
}
