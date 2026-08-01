import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getHomeDashboard, type HomeDashboardData } from '@/data/repositories/home';
import { calculateWeeklyRegularity, type WeeklyRegularity } from '@/lib/history';

export type HomeDashboardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: HomeDashboardData; regularity: WeeklyRegularity };

/**
 * Ce que l'accueil lit, et rien d'autre.
 *
 * L'erreur est **attrapée ici** plutôt que laissée remonter : une lecture
 * IndexedDB qui échoue (base bloquée par un autre onglet, quota, navigation
 * privée) ferait sauter la limite d'erreur et effacerait tout l'écran, y compris
 * le bouton « séance libre » qui, lui, n'a besoin de rien de ce qui a échoué.
 *
 * La régularité est calculée ici avec la fonction de l'Historique, à partir des
 * mêmes dates et du même historique d'objectifs : une seule implémentation de la
 * série hebdomadaire dans l'app, deux écrans qui l'affichent.
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

  if (result === undefined) return { status: 'loading' };
  if (result.data === null) return { status: 'error' };

  return {
    status: 'ready',
    data: result.data,
    regularity: calculateWeeklyRegularity(
      result.data.completedWorkoutTimestamps,
      result.data.weeklyGoalHistory,
      openedAt,
    ),
  };
}
