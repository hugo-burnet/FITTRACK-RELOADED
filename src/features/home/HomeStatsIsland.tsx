import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLatestBodyWeight } from '@/data/repositories/bodyMeasurements';
import { t } from '@/i18n/fr';
import type { WeeklyRegularity } from '@/lib/history';
import { Card } from '@/ui';
import { formatNumber } from '@/ui/numberField';
import { HomeBodyWeightSheet } from './HomeBodyWeightSheet';

/**
 * Les deux chiffres personnels de l'accueil, sur une seule bande.
 *
 * Ils tenaient deux cartes et près de trois cents pixels — un compteur de
 * semaine sur deux colonnes, une saisie de poids avec ses ± de 48 px — au-dessus
 * de tout le reste. Ce ne sont pourtant pas des actions : ce sont deux valeurs
 * qu'on lit d'un coup d'œil, et qu'on modifie rarement. Une tuile chacune, sous
 * la séance à lancer.
 *
 * Chaque tuile reste une cible entière : la semaine ouvre l'écran Rythme, le
 * poids ouvre sa feuille de saisie. Le libellé est en bas et en petit, la valeur
 * en haut et en grand — l'œil descend sur la ligne des chiffres, pas sur celle
 * des mots.
 */
export function HomeStatsIsland({ regularity }: { regularity: WeeklyRegularity }) {
  const navigate = useNavigate();
  const latest = useLiveQuery(async () => (await getLatestBodyWeight()) ?? null);
  const [weightOpen, setWeightOpen] = useState(false);

  const { currentCompleted, currentGoal } = regularity;

  return (
    <section>
      <Card>
        <div className="grid grid-cols-2">
          <Tile
            label={t('home.islandWeek')}
            value={
              currentGoal === null ? String(currentCompleted) : `${currentCompleted} / ${currentGoal}`
            }
            ariaLabel={t('home.weekLink')}
            onClick={() => void navigate('/analytics/weekly')}
          />
          <Tile
            label={t('home.islandWeight')}
            /* Rien plutôt qu'un tiret tant que la lecture n'est pas revenue : la
               tuile ne doit pas afficher « aucune pesée » une frame avant
               d'afficher 82,4. */
            value={latest === undefined ? ' ' : latest === null ? '—' : formatNumber(latest.valueKg)}
            suffix={latest == null ? undefined : t('units.kg')}
            ariaLabel={t('home.weightLink')}
            onClick={() => setWeightOpen(true)}
            divided
          />
        </div>
      </Card>

      <HomeBodyWeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
    </section>
  );
}

interface TileProps {
  label: string;
  value: string;
  suffix?: string;
  ariaLabel: string;
  onClick: () => void;
  /** La seule séparation entre deux tuiles — la carte n'en porte aucune. */
  divided?: boolean;
}

function Tile({ label, value, suffix, ariaLabel, onClick, divided }: TileProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex min-h-20 flex-col justify-between p-4 text-left
        transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]
        ${divided ? 'border-l border-[var(--border)]' : ''}`}
    >
      <span className="metric truncate text-2xl leading-none font-semibold text-[var(--text-1)]">
        {value}
        {suffix !== undefined && (
          <span className="ml-1 text-sm font-semibold text-[var(--text-2)]">{suffix}</span>
        )}
      </span>
      <span className="label-xs mt-2 truncate font-semibold text-[var(--text-2)]">{label}</span>
    </button>
  );
}
