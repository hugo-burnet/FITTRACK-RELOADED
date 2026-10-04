import { useState } from 'react';
import type { HomeDashboardData } from '@/data/repositories/home';
import { setRoutineFolderContext } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { routineContextFromValues, type RoutineContextValue } from '@/lib/routineContext';
import { Button, Sheet } from '@/ui';
import { CheckIcon } from '@/ui/icons';
import { routineContextOptionLabel } from './homeRoutineContextPresentation';

type RoutineContext = HomeDashboardData['routineContext'];

interface Props {
  open: boolean;
  /** Les lignes déjà enregistrées : la feuille repart d'elles à chaque ouverture. */
  value: RoutineContext['selected'];
  options: RoutineContext['options'];
  onClose: () => void;
}

/**
 * Les dossiers dont l'accueil tire sa suggestion — un ou plusieurs.
 *
 * Cases à cocher et non plus boutons radio : un cycle qui traverse deux dossiers
 * n'a pas de dossier unique à désigner, et le rôle doit dire que plusieurs
 * réponses sont permises avant le premier tap.
 *
 * Les taps ne touchent qu'un **brouillon**, et « Terminé » écrit une fois. Écrire
 * à chaque case aurait changé le contexte sous la feuille — la carte derrière
 * se recompose à chaque changement de sélection — et refermé la feuille avant la
 * deuxième case. Fermer sans « Terminé » ne choisit rien.
 *
 * Cette feuille ne passe pas par `MultiOptionSheet` : valider écrit un réglage
 * local, et la feuille doit rester exactement où elle est si cette écriture
 * échoue. Pendant l'écriture, aucune ligne ni sortie ne peut lancer une seconde
 * action concurrente.
 */
export function HomeRoutineContextSheet({ open, value, options, onClose }: Props) {
  const [draft, setDraft] = useState<RoutineContextValue[]>(value);
  const [wasOpen, setWasOpen] = useState(open);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // À chaque ouverture on repart de ce qui est enregistré : un brouillon
  // abandonné, ou une erreur d'une session précédente, ne reviennent pas.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(value);
      setError(false);
    }
  }

  const close = () => {
    if (!saving) onClose();
  };

  const toggle = (optionValue: RoutineContextValue) => {
    if (saving) return;
    setDraft((current) =>
      current.includes(optionValue)
        ? current.filter((candidate) => candidate !== optionValue)
        : [...current, optionValue],
    );
  };

  const done = async () => {
    if (saving) return;

    // Dans l'ordre de la bibliothèque, quel que soit l'ordre des taps.
    const context = routineContextFromValues(
      options.map((option) => option.value).filter((candidate) => draft.includes(candidate)),
    );
    if (context === null) return;

    try {
      setSaving(true);
      setError(false);
      await setRoutineFolderContext(context);
      onClose();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} title={t('home.chooseRoutineFolder')}>
      {options.length > 1 && (
        <p className="mb-3 text-sm leading-relaxed text-[var(--text-2)]">
          {t('home.routineFolderHint')}
        </p>
      )}

      <div role="group" aria-label={t('home.chooseRoutineFolder')} className="-mx-5">
        {options.map((option) => {
          const selected = draft.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={saving}
              onClick={() => toggle(option.value)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-[var(--border)]
                px-5 py-3 text-left transition-colors duration-[var(--dur-1)] last:border-b-0
                active:bg-[var(--surface-2)] disabled:opacity-60"
            >
              {/* La case porte l'état à elle seule : la ligne se lit « plusieurs
                  réponses possibles » avant que rien ne soit coché. */}
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-md border
                  transition-[background-color,border-color,transform] duration-[var(--dur-1)]
                  ease-[var(--ease-mech)]
                  ${
                    selected
                      ? `scale-105 border-[var(--color-accent)] bg-[var(--color-accent)]
                        text-[var(--color-accent-fg)]`
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-transparent'
                  }`}
              >
                <CheckIcon className="size-4" />
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-base ${
                  selected ? 'font-semibold text-[var(--text-1)]' : 'text-[var(--text-1)]'
                }`}
              >
                {routineContextOptionLabel(option)}
              </span>
            </button>
          );
        })}
      </div>

      {draft.length === 0 && (
        <p className="pt-3 text-sm text-[var(--text-2)]">{t('home.routineFolderPickOne')}</p>
      )}

      {error && (
        <p role="status" className="pt-3 text-sm text-[var(--danger-ink)]">
          {t('home.routineFolderWriteError')}
        </p>
      )}

      {/* Collé au bas du panneau, dans la zone du pouce — même geste que la
          feuille multi-choix des muscles. */}
      <div
        className="sticky bottom-0 -mx-5 bg-[var(--surface-1)] px-5 pt-3
          pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={draft.length === 0 || saving}
          onClick={() => void done()}
        >
          {t('common.done')}
        </Button>
      </div>
    </Sheet>
  );
}
