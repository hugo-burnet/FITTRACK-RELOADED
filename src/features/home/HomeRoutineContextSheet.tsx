import { useState } from 'react';
import type { HomeDashboardData } from '@/data/repositories/home';
import { setRoutineFolderContext } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { Sheet } from '@/ui';
import { CheckIcon } from '@/ui/icons';

type RoutineContext = HomeDashboardData['routineContext'];

interface Props {
  open: boolean;
  value: RoutineContext['selected'];
  options: RoutineContext['options'];
  onClose: () => void;
}

/**
 * Le dossier dont l'accueil tire sa suggestion.
 *
 * Cette feuille ne passe pas par `OptionSheet` : choisir ici écrit un réglage
 * local, et la feuille doit rester exactement où elle est si cette écriture
 * échoue. Pendant l'écriture, aucune ligne ni sortie ne peut lancer une seconde
 * action concurrente.
 */
export function HomeRoutineContextSheet({ open, value, options, onClose }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const close = () => {
    if (saving === null) onClose();
  };

  const select = async (nextValue: RoutineContext['options'][number]['value']) => {
    if (saving !== null) return;

    const context =
      nextValue === 'root'
        ? { kind: 'root' as const }
        : { kind: 'folder' as const, folderId: nextValue.slice('folder:'.length) };

    try {
      setSaving(nextValue);
      setError(false);
      await setRoutineFolderContext(context);
      onClose();
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Sheet open={open} onClose={close} title={t('home.chooseRoutineFolder')}>
      <div role="radiogroup" aria-label={t('home.chooseRoutineFolder')} className="-mx-5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving !== null}
              onClick={() => void select(option.value)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-[var(--border)]
                px-5 py-3 text-left transition-colors duration-[var(--dur-1)] last:border-b-0
                active:bg-[var(--surface-2)] disabled:opacity-60"
            >
              <span
                className={`min-w-0 flex-1 truncate text-base ${
                  selected ? 'font-semibold text-[var(--accent-ink)]' : 'text-[var(--text-1)]'
                }`}
              >
                {option.label}
              </span>
              {selected && <CheckIcon className="shrink-0 text-[var(--accent-ink)]" />}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="status" className="pt-3 text-sm text-[var(--danger-ink)]">
          {t('home.routineFolderWriteError')}
        </p>
      )}
    </Sheet>
  );
}
