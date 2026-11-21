import { useId, useState, type ReactNode } from 'react';
import { t } from '@/i18n/fr';
import { ChevronDownIcon } from './icons';

/**
 * Le texte d'aide long, replié derrière une ligne « En savoir plus ».
 *
 * Un groupe de réglages garde une phrase visible ; le reste de son explication (la règle de cadence,
 * le détail d'une option) ne disparaît pas, il attend qu'on le demande. L'état est local : rien à
 * retenir d'une visite à l'autre. Le contenu n'est pas monté tant qu'il est replié, pour qu'un
 * lecteur d'écran ne lise pas ce qu'un œil ne voit pas.
 */
export function LearnMore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 items-center gap-1 px-1 text-sm font-semibold text-[var(--text-2)]"
      >
        {t('common.learnMore')}
        <span aria-hidden="true" className={open ? 'rotate-180' : undefined}>
          <ChevronDownIcon />
        </span>
      </button>
      <div id={panelId} hidden={!open} className="space-y-2 pb-1">
        {open && children}
      </div>
    </div>
  );
}
