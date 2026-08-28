import { useSearchParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/data/types';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
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
  const navigate = useAppNavigate();
  const [params, setParams] = useSearchParams();
  const tutorial = useTutorialControls();

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

    // Les trois commandes passent par ce seul rappel, donc c'est la valeur qui
    // a bougé qui dit laquelle a été touchée. Sans ce tri, poser un filtre
    // validait l'étape du tutoriel qui demande de chercher — et l'inverse.
    if (next.search !== query.search) {
      tutorial?.report({ type: 'exercise-query-changed', query: next.search });
    }
    if (next.muscle !== query.muscle) {
      tutorial?.report({ type: 'exercise-muscle-filter-changed', muscle: next.muscle ?? null });
    }
    if (next.equipment !== query.equipment) {
      tutorial?.report({
        type: 'exercise-equipment-filter-changed',
        equipment: next.equipment ?? null,
      });
    }
  };

  return (
    <Screen
      title={t('exercises.title')}
      action={
        <HeaderAction
          label={t('exercises.create')}
          tutorialId="exercise-create"
          onClick={() => {
            tutorial?.report({ type: 'exercise-create-opened' });
            void navigate('/exercises/new');
          }}
        >
          <PlusIcon />
        </HeaderAction>
      }
    >
      <ExerciseBrowser
        query={query}
        onQueryChange={setQuery}
        onPick={(exercise) => void navigate(`/exercises/${exercise.id}`)}
        onCreate={(name) => {
          // Le même geste que le + de l'en-tête, avec le nom cherché déjà
          // saisi. Le taire ici laisserait une mission de création arrêtée sur
          // son étape d'ouverture devant le formulaire qu'elle demandait.
          tutorial?.report({ type: 'exercise-create-opened' });
          void navigate(`/exercises/new?name=${encodeURIComponent(name)}`);
        }}
      />
    </Screen>
  );
}
