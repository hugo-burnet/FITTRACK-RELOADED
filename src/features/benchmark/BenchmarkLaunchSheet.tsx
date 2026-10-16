import { useState } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { startBenchmarkFromRoutine } from '@/data/repositories/benchmark';
import type { BenchmarkGoal, Routine } from '@/data/types';
import { t } from '@/i18n/fr';
import { BENCHMARK_GOALS, BENCHMARK_GOAL_TEST_REPS } from '@/lib/benchmarkModel';
import { Button, ChoiceChip, Sheet } from '@/ui';
import { goalName } from './benchmarkText';

/** Un style, ou « comme ma routine » : la fourchette de chaque exercice, lue dans la routine. */
type Choice = BenchmarkGoal | 'routine';

/**
 * La feuille qui précède un benchmark : ce qu'il demande, dit avant de lancer — et le style qu'on y vise.
 *
 * **Le style est un choix, pas une obligation.** « Comme ma routine » reste choisi d'office : c'est le
 * benchmark d'avant, qui lit la fourchette que la routine écrit sur chaque exercice. Léger, classique et lourd
 * disent à la place la fourchette qu'on veut travailler — au départ d'un programme, la routine n'en a souvent
 * pas encore qui vaille — et le nombre de répétitions à viser dans l'essai.
 *
 * Partagée par les portes — le menu d'une routine dans la liste, la ligne de son éditeur, l'écran d'un
 * programme — pour qu'elles ne puissent pas dire deux choses différentes ni lancer deux séances différentes.
 * Même garde que « Démarrer » côté appelant (rien ne tourne), même sortie : la séance en direct. Aucun rapport
 * au tutoriel : lancer un benchmark n'est pas l'étape qu'il attend.
 *
 * Le dernier choix reste choisi tant que l'écran vit : on en refait un dans la foulée, du même style.
 */
export function BenchmarkLaunchSheet({
  routine,
  onClose,
}: {
  /** `null` : fermée. */
  routine: Pick<Routine, 'id' | 'name'> | null;
  onClose: () => void;
}) {
  const navigate = useAppNavigate();
  const [choice, setChoice] = useState<Choice>('routine');

  const launch = () => {
    if (routine === null) return;
    const goal = choice === 'routine' ? undefined : choice;
    void startBenchmarkFromRoutine(
      routine.id,
      goal === undefined
        ? t('benchmark.workoutName', { name: routine.name })
        : t('benchmark.workoutNameGoal', { style: goalName(goal), name: routine.name }),
      goal,
    )
      .then(() => navigate('/workout'))
      .catch(() => undefined);
    onClose();
  };

  return (
    <Sheet open={routine !== null} onClose={onClose} title={routine?.name ?? ''}>
      <p className="mb-4 whitespace-pre-line text-base leading-relaxed text-[var(--text-2)]">
        {t('benchmark.launchBody')}
      </p>
      <div role="group" aria-label={t('benchmark.goalLabel')} className="mb-3 flex flex-col gap-2">
        <ChoiceChip
          fill
          quietActive
          label={t('benchmark.goalRoutine')}
          active={choice === 'routine'}
          onClick={() => setChoice('routine')}
        />
        {BENCHMARK_GOALS.map((goal) => (
          <ChoiceChip
            key={goal}
            fill
            label={t(`benchmark.goalChoice.${goal}`)}
            active={choice === goal}
            onClick={() => setChoice(goal)}
          />
        ))}
      </div>
      <p className="mb-6 text-sm leading-relaxed text-[var(--text-2)]">
        {choice === 'routine'
          ? t('benchmark.goalRoutineHint')
          : t('benchmark.goalHint', { reps: BENCHMARK_GOAL_TEST_REPS[choice] })}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={onClose} fullWidth>
          {t('exercise.cancel')}
        </Button>
        <Button size="lg" onClick={launch} fullWidth>
          {t('benchmark.launchConfirm')}
        </Button>
      </div>
    </Sheet>
  );
}
