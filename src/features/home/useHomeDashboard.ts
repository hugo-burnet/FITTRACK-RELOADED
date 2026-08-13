import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getHomeDashboard, type HomeDashboardData } from '@/data/repositories/home';
import { calculateWeeklyRegularity, type WeeklyRegularity } from '@/lib/history';

export type HomeDashboardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: HomeDashboardData; regularity: WeeklyRegularity };

/**
 * Ce que l'accueil lit, et rien d'autre. La priorité éventuelle du programme
 * est déjà résolue dans `HomeDashboardData` : ce hook ne re-classe aucune
 * séance et se contente de dériver la régularité commune à l'Historique.
 *
 * L'erreur est **attrapée ici** plutôt que laissée remonter : une lecture
 * IndexedDB qui échoue (base bloquée par un autre onglet, quota, navigation
 * privée) ferait sauter la limite d'erreur et effacerait tout l'écran, y compris
 * le bouton « séance libre » qui, lui, n'a besoin de rien de ce qui a échoué.
 *
 * La régularité est calculée ici avec la fonction de l'Historique, à partir des
 * mêmes dates et du même historique d'objectifs : une seule implémentation de la
 * série hebdomadaire dans l'app, deux écrans qui l'affichent.
 *
 * Elle est **mémoïsée** : elle range tout l'historique par semaine, donc son
 * coût suit le nombre de séances, alors que ses trois entrées ne changent qu'à
 * une écriture en base. Hors mémo elle se rejouait à chaque rendu de l'accueil —
 * y compris ceux qui ne doivent rien à ces données.
 */
export function useHomeDashboard(): HomeDashboardState {
  // Figé à l'ouverture, comme l'Historique : la semaine courante ne doit pas
  // changer sous les yeux de l'utilisateur à minuit pile.
  const [openedAt] = useState(() => Date.now());

  const result = useLiveQuery(async () => {
    try {
      return { data: await getHomeDashboard() };
    } catch {
      return { data: null };
    }
  }, []);

  const data = result?.data ?? null;

  // Avant les retours anticipés : un hook ne se saute pas.
  const ready = useMemo<HomeDashboardState | null>(
    () =>
      data === null
        ? null
        : {
          status: 'ready',
          data,
          regularity: calculateWeeklyRegularity(
            data.completedWorkoutTimestamps,
            data.weeklyGoalHistory,
            openedAt,
          ),
        },
    [data, openedAt],
  );

  if (result === undefined) return { status: 'loading' };
  if (ready === null) return { status: 'error' };

  return ready;
}
