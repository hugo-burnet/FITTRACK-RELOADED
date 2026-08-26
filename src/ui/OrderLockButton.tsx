import { t } from '@/i18n/fr';
import { LockIcon, UnlockIcon } from './icons';

/**
 * Le cadenas d'ordre. Trois surfaces l'emploient — l'éditeur de routine, la
 * séance en cours, et la bibliothèque — et elles ne réordonnent pas la même
 * chose. Les libellés sont donc fournis par l'appelant quand « exercices » ne
 * dit pas la vérité : un lecteur d'écran qui annonce « l'ordre des exercices »
 * sur une liste de routines décrit un autre écran.
 */
export function OrderLockButton({
  unlocked,
  onToggle,
  unlockLabel,
  lockLabel,
}: {
  unlocked: boolean;
  onToggle: () => void;
  unlockLabel?: string;
  lockLabel?: string;
}) {
  const label = unlocked
    ? (lockLabel ?? t('common.lockExerciseOrder'))
    : (unlockLabel ?? t('common.unlockExerciseOrder'));
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onToggle}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl
        text-[var(--accent-ink)] transition-colors duration-[var(--dur-1)]
        active:bg-[var(--surface-1)]"
    >
      {unlocked ? <UnlockIcon /> : <LockIcon />}
    </button>
  );
}
