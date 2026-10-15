import { useAppNavigate } from '@/app/navigation';
import { startBenchmarkFromRoutine } from '@/data/repositories/benchmark';
import type { Routine } from '@/data/types';
import { t } from '@/i18n/fr';
import { ConfirmSheet } from '@/ui';

/**
 * La feuille qui précède un benchmark : ce qu'il demande, dit avant de lancer.
 *
 * Partagée par les deux portes — le menu d'une routine dans la liste, et la ligne de son
 * éditeur — pour qu'elles ne puissent pas dire deux choses différentes ni lancer deux séances
 * différentes. Même garde que « Démarrer » côté appelant (rien ne tourne), même sortie : la
 * séance en direct. Aucun rapport au tutoriel : lancer un benchmark n'est pas l'étape qu'il
 * attend.
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

  return (
    <ConfirmSheet
      open={routine !== null}
      onClose={onClose}
      title={routine?.name ?? ''}
      body={t('benchmark.launchBody')}
      confirmLabel={t('benchmark.launchConfirm')}
      onConfirm={() => {
        if (routine === null) return;
        void startBenchmarkFromRoutine(
          routine.id,
          t('benchmark.workoutName', { name: routine.name }),
        )
          .then(() => navigate('/workout'))
          .catch(() => undefined);
      }}
    />
  );
}
