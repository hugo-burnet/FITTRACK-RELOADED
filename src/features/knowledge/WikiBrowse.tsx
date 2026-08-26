import { Link } from 'react-router-dom';
import { t } from '@/i18n/fr';
import { wikiDocuments } from './wikiIndex';

function countLabel(count: number, one: 'sectionCountOne' | 'passageCountOne'): string {
  const many = one === 'sectionCountOne' ? 'sectionCountMany' : 'passageCountMany';
  return t(`knowledge.wiki.${count === 1 ? one : many}`, { count });
}

/**
 * Le sommaire. Ce qui transforme 266 passages orphelins en quelque chose qui se
 * parcourt : l'ordre du document source, et rien d'autre. Pas de tri par
 * pertinence — un sommaire qui se réordonne n'est plus un sommaire.
 */
export function WikiBrowse() {
  return (
    <section aria-labelledby="wiki-browse" className="space-y-4">
      <div className="px-1">
        <h2 id="wiki-browse" className="text-lg font-semibold text-[var(--text-1)]">
          {t('knowledge.wiki.browseTitle')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          {t('knowledge.wiki.browseIntro')}
        </p>
      </div>

      <Link
        to="/knowledge/questions"
        className="flex min-h-12 items-center justify-between gap-4 rounded-2xl bg-[var(--accent-soft)] px-5 py-4"
      >
        <span className="font-semibold text-[var(--accent-ink)]">
          {t('knowledge.wiki.questionsEntry')}
        </span>
        <span aria-hidden="true" className="text-[var(--accent-ink)]">
          →
        </span>
      </Link>

      {/* La programmation vient d'un autre document et d'un autre étage
          d'extraction. Elle a sa propre entrée plutôt que d'être fondue dans la
          liste des sections : sa matière est faite de fiches, pas de prose. */}
      <Link
        to="/knowledge/programmation"
        className="flex min-h-12 items-center justify-between gap-4 rounded-2xl bg-[var(--accent-soft)] px-5 py-4"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-[var(--accent-ink)]">
            {t('knowledge.programming.title')}
          </span>
          <span className="mt-1 block text-sm leading-6 text-[var(--text-2)]">
            {t('knowledge.programming.entry')}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-[var(--accent-ink)]">
          →
        </span>
      </Link>

      {wikiDocuments.map((document) => {
        const passages = document.sections.reduce(
          (total, section) => total + section.passages.length,
          0,
        );
        return (
          <article key={document.documentId} className="rounded-2xl bg-[var(--surface-1)] p-5">
            <h3 className="text-base font-semibold leading-6 text-[var(--text-1)]">
              {document.title}
            </h3>
            <p className="label-xs mt-2 font-semibold text-[var(--text-2)]">
              {countLabel(document.sections.length, 'sectionCountOne')} ·{' '}
              {countLabel(passages, 'passageCountOne')}
            </p>

            <ul className="mt-4 space-y-1">
              {document.sections.map((section) => (
                <li key={section.sectionId}>
                  {/* min-h-12 = 48 px : une cible tactile pour une main en sueur. */}
                  <Link
                    to={`/knowledge/s/${section.sectionId}`}
                    className="flex min-h-12 items-center justify-between gap-4 rounded-xl px-3 py-2 text-sm leading-6 text-[var(--text-1)]"
                  >
                    <span>{section.title}</span>
                    <span className="record-figure shrink-0 text-xs text-[var(--text-2)]">
                      {section.passages.length}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
