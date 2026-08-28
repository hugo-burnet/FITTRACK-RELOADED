import { Link } from 'react-router-dom';
import { t } from '@/i18n/fr';

/**
 * « Mettre en pratique » : le seul pont entre le Guide et les programmes.
 *
 * Il **navigue**, et c'est tout. Le Guide n'écrit jamais un `Program` : seul
 * l'éditeur existant `/programs/new` en crée un, et ce composant n'importe ni
 * `db`, ni repository, ni type de brouillon — la vérification est dans son test.
 *
 * Il ne préremplit rien non plus. Un cycle prérempli depuis une fiche non relue
 * ressemblerait à une recommandation, et le Guide n'en fait aucune.
 */
export function ProgrammingGuideEntry() {
  return (
    <section className="rounded-2xl border border-[var(--border)] p-5">
      <p className="text-sm leading-6 text-[var(--text-2)]">{t('planning.applyGuideHint')}</p>
      {/* min-h-12 = 48 px : une cible tactile pour une main en sueur. */}
      <Link
        viewTransition
        to="/programs/new"
        className="mt-4 flex min-h-12 items-center justify-center rounded-xl
          bg-[var(--color-accent)] px-4 text-base font-semibold text-[var(--color-accent-fg)]"
      >
        {t('planning.applyGuide')}
      </Link>
    </section>
  );
}
