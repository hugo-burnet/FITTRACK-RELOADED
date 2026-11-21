import type { WeeklyRegularity } from '@/lib/history';
import { t } from '@/i18n/fr';
import { Tile, TileGrid } from '@/ui';

interface Props {
  regularity: WeeklyRegularity;
  onEditGoal: () => void;
}

/**
 * « Régularité » en tuiles, comme l'accueil et le détail de séance (DESIGN.md › « Tuile ou ligne »).
 * Sans objectif, la série n'existe pas (elle vaut 0 par construction) : une seule tuile `L` qui invite à
 * le choisir, plutôt qu'un mot posé à la taille d'un chiffre et une `S` seule étirée sur la rangée.
 */
export function HistorySummaryCard({ regularity, onEditGoal }: Props) {
  const { currentCompleted, currentGoal, streak } = regularity;

  return (
    <TileGrid title={t('history.regularity')}>
      {currentGoal === null ? (
        <Tile
          key="goal"
          size="L"
          label={t('history.weeklyGoal')}
          value={null}
          detail={t('history.goalPrompt')}
          hint={t('history.goalHint')}
          onClick={onEditGoal}
        />
      ) : (
        <Tile
          key="streak"
          size="S"
          label={t(streak === 1 ? 'history.streakOne' : 'history.streak')}
          value={{ value: String(streak) }}
        />
      )}
      {currentGoal !== null && (
        <Tile
          key="goal"
          size="S"
          label={t('history.weeklyGoal')}
          value={{
            value: `${currentCompleted} / ${currentGoal}`,
            spoken: t('history.goalSpoken', { done: currentCompleted, goal: currentGoal }),
          }}
          hint={t('history.goalHint')}
          onClick={onEditGoal}
        />
      )}
    </TileGrid>
  );
}
