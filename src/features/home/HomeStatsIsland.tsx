import { useState } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLatestBodyWeight } from '@/data/repositories/bodyMeasurements';
import { t } from '@/i18n/fr';
import type { WeeklyRegularity } from '@/lib/history';
import { Tile, TileGrid } from '@/ui';
import { formatNumber } from '@/ui/numberField';
import { HomeBodyWeightSheet } from './HomeBodyWeightSheet';

/**
 * Les deux chiffres personnels de l'accueil, deux tuiles côte à côte.
 *
 * Ils tenaient deux cartes et près de trois cents pixels — un compteur de
 * semaine sur deux colonnes, une saisie de poids avec ses ± de 48 px — au-dessus
 * de tout le reste. Ce ne sont pourtant pas des actions : ce sont deux valeurs
 * qu'on lit d'un coup d'œil, et qu'on modifie rarement. Une tuile chacune, sous
 * la séance à lancer.
 *
 * Chaque tuile reste une cible entière : la semaine ouvre l'écran Rythme, le
 * poids ouvre sa feuille de saisie. Ce qu'elle fait se dit dans `hint` (lu en
 * description) ; son nom accessible est ce qu'on voit, « poids du jour 82,4 kg ».
 * La grille (`TileGrid`) passe à une colonne quand la police du système grossit.
 */
export function HomeStatsIsland({ regularity }: { regularity: WeeklyRegularity }) {
  const navigate = useAppNavigate();
  const latest = useLiveQuery(async () => (await getLatestBodyWeight()) ?? null);
  const [weightOpen, setWeightOpen] = useState(false);

  const { currentCompleted, currentGoal } = regularity;

  return (
    <section>
      <TileGrid>
        <Tile
          size="S"
          label={t('home.islandWeek')}
          value={
            currentGoal === null
              ? { value: String(currentCompleted) }
              : {
                  value: `${currentCompleted} / ${currentGoal}`,
                  spoken: t('home.weekSpoken', { done: currentCompleted, goal: currentGoal }),
                }
          }
          hint={t('home.weekLink')}
          onClick={() => void navigate('/analytics/weekly')}
        />
        <Tile
          size="S"
          label={t('home.islandWeight')}
          /* `undefined` tant que la lecture n'est pas revenue : la tuile ne doit pas afficher
             « aucune mesure » une frame avant d'afficher 82,4. `null` : aucune pesée. */
          value={
            latest === undefined
              ? undefined
              : latest === null
                ? null
                : { value: formatNumber(latest.valueKg), unit: t('units.kg') }
          }
          hint={t('home.weightLink')}
          onClick={() => {
            setWeightOpen(true);
          }}
        />
      </TileGrid>

      <HomeBodyWeightSheet
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        onOpenCurve={() => void navigate('/analytics/measurements/body_weight')}
      />
    </section>
  );
}
