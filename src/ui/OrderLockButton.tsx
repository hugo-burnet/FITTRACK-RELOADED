import { t } from '@/i18n/fr';
import { LockIcon, UnlockIcon } from './icons';

export function OrderLockButton({
  unlocked,
  onToggle,
}: {
  unlocked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={t(unlocked ? 'common.lockExerciseOrder' : 'common.unlockExerciseOrder')}
      aria-pressed={unlocked}
      onClick={onToggle}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl
        text-[var(--accent-ink)] transition-colors duration-[var(--dur-1)]
        active:bg-[var(--surface-1)]"
    >
      {unlocked ? <UnlockIcon /> : <LockIcon />}
    </button>
  );
}
