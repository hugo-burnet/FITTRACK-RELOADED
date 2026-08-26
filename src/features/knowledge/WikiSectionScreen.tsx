import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@/i18n/fr';
import { findWikiSection, type WikiPassage } from './wikiIndex';
import { KnowledgeScreenFrame } from './KnowledgeScreenFrame';

function PassageCard({ passage, rank }: { passage: WikiPassage; rank: number }) {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-[var(--surface-1)] pl-1">
      {/* Le rail du témoin, comme sur un résultat de recherche : le même geste
          visuel dit la même chose — ce texte vient d'une source, à l'octet. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-ink)]" />
      <div className="p-5">
        <p className="label-xs font-semibold text-[var(--accent-ink)]">
          {t('knowledge.wiki.passageNumber', { rank })}
        </p>

        <p className="mt-4 text-base leading-7 text-[var(--text-1)]">{passage.text}</p>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="record-figure text-xs leading-5 text-[var(--text-2)]">
            {passage.claimIds.join(' · ')}
          </p>
        </div>
      </div>
    </article>
  );
}

export function WikiSectionScreen() {
  const navigate = useNavigate();
  const { sectionId } = useParams<{ sectionId: string }>();
  const section = sectionId === undefined ? undefined : findWikiSection(sectionId);

  if (section === undefined) {
    return (
      <KnowledgeScreenFrame
        title={t('knowledge.wiki.notFoundTitle')}
        onBack={() => void navigate('/knowledge')}
      >
        <div role="status" className="rounded-2xl border border-[var(--border)] p-5">
          <p className="text-sm leading-6 text-[var(--text-2)]">
            {t('knowledge.wiki.notFoundBody')}
          </p>
        </div>
      </KnowledgeScreenFrame>
    );
  }

  const count = section.passages.length;

  return (
    <KnowledgeScreenFrame
      title={section.title}
      onBack={() => void navigate('/knowledge')}
      // Le document et les titres AU-DESSUS de celui-ci, jamais lui-même : une
      // section de premier niveau a un chemin d'un seul élément, et l'afficher
      // entier écrivait le titre deux fois de suite.
      sub={
        <p className="text-sm leading-6 text-[var(--text-2)]">
          {[section.documentTitle, ...section.headingPath.slice(0, -1)].join(' › ')}
        </p>
      }
      action={
        <span className="record-figure text-sm text-[var(--text-2)]">
          {t(count === 1 ? 'knowledge.wiki.passageCountOne' : 'knowledge.wiki.passageCountMany', {
            count,
          })}
        </span>
      }
    >
      <div className="space-y-4">
        {section.passages.map((passage, index) => (
          <PassageCard key={passage.claimIds[0]} passage={passage} rank={index + 1} />
        ))}
      </div>
    </KnowledgeScreenFrame>
  );
}
