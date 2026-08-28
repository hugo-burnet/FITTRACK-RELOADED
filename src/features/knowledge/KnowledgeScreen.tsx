import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { t, type TranslationKey } from '@/i18n/fr';
import { Button } from '@/ui';
import { WikiBrowse } from './WikiBrowse';
import { stripEmphasis } from './markdownText';
import { articleHref, findArticleForRow } from './articleCatalogue';
import { KnowledgeScreenFrame } from './KnowledgeScreenFrame';
import {
  evidenceIndexStatus,
  searchEvidence,
  type EpistemicStatus,
  type EvidenceCandidate,
  type EvidenceSearchOutcome,
} from './searchEvidence';

const STATUS_KEYS = {
  absence_of_evidence: 'knowledge.status.absenceOfEvidence',
  established: 'knowledge.status.established',
  established_direction: 'knowledge.status.establishedDirection',
  mechanistic_only: 'knowledge.status.mechanisticOnly',
  practice_only: 'knowledge.status.practiceOnly',
  probable: 'knowledge.status.probable',
  refuted: 'knowledge.status.refuted',
  uncertain: 'knowledge.status.uncertain',
} as const satisfies Record<EpistemicStatus, TranslationKey>;

function statusLabel(status: EpistemicStatus | null): string {
  return status === null ? t('knowledge.status.unqualified') : t(STATUS_KEYS[status]);
}

function EvidenceCard({ evidence, rank }: { evidence: EvidenceCandidate; rank: number }) {
  // On affiche toujours le contexte — c'est lui la prose lisible — et on ne
  // répète la citation en dessous que si elle apporte un cadrage absent du
  // contexte. Le contexte contenant presque toujours la citation, la montrer
  // deux fois doublait la hauteur de la carte pour rien.
  // La comparaison porte sur les formes *affichées* : le contexte et la citation
  // ne portent pas toujours la même emphase Markdown pour le même texte, et
  // comparer les formes brutes laissait passer des répétitions bien visibles.
  const quoteIsRedundant = stripEmphasis(evidence.displayContext).includes(
    stripEmphasis(evidence.rawQuote),
  );
  const isProgramming = evidence.kind === 'programming';
  // Une fiche de programmation n'a plus de page de lignes brutes : elle est
  // citée dans un article du Guide, et c'est là qu'on l'envoie lire. Pour une
  // affirmation E5, la section du corpus reste la bonne destination.
  const programmingArticle = isProgramming ? findArticleForRow(evidence.claimId) : undefined;
  const sectionHref = isProgramming
    ? programmingArticle && articleHref(programmingArticle)
    : evidence.sectionId && `/knowledge/s/${evidence.sectionId}`;

  return (
    <article className="relative overflow-hidden rounded-2xl bg-[var(--surface-1)] pl-1">
      {/* The witness rail: every card is visibly anchored to a source span. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-ink)]" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="label-xs font-semibold text-[var(--accent-ink)]">
            {t('knowledge.proofNumber', { rank })}
          </p>
          {/* Une fiche de programmation porte « non relu » à la place du statut
              épistémique : son niveau de confiance est un champ du tableau,
              affiché dans la fiche, et non une étiquette de l'échelle E5. */}
          {isProgramming && (
            <p className="label-xs text-right font-semibold text-[var(--text-2)]">
              {t('knowledge.programming.unreviewedLabel')}
            </p>
          )}
          {/* Un statut absent n'a rien à annoncer. « Cadre non qualifié »
              sortait sur presque chaque carte : du bruit, pas du sens. */}
          {evidence.epistemicStatus !== null && (
            <p className="label-xs text-right font-semibold text-[var(--text-2)]">
              {statusLabel(evidence.epistemicStatus)}
            </p>
          )}
        </div>

        <blockquote className="mt-4 text-base leading-7 text-[var(--text-1)]">
          {stripEmphasis(evidence.displayContext)}
        </blockquote>

        {!quoteIsRedundant && (
          <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-4">
            <p className="label-xs font-semibold text-[var(--text-2)]">
              {t('knowledge.exactQuote')}
            </p>
            <q className="mt-2 block text-sm leading-6 text-[var(--text-1)]">
              {stripEmphasis(evidence.rawQuote)}
            </q>
          </div>
        )}

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-sm leading-6 text-[var(--text-2)]">{evidence.sourceTitle}</p>
          <p className="record-figure mt-2 text-xs leading-5 text-[var(--text-2)]">
            {evidence.claimId} · {evidence.fragmentId} · {evidence.supportStartByte}–
            {evidence.supportEndByte}
          </p>
          {/* Un extrait seul ne dit pas ce qu'il y avait autour. Ce lien est la
              différence entre une recherche et un corpus qu'on peut lire. */}
          {sectionHref !== undefined && (
            <Link
              viewTransition
              to={sectionHref}
              className="mt-4 flex min-h-12 items-center gap-2 text-sm font-semibold text-[var(--accent-ink)]"
            >
              {t('knowledge.wiki.readInSection')}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function SearchResult({ outcome }: { outcome: EvidenceSearchOutcome }) {
  if (outcome.kind === 'EMPTY_QUERY') {
    return (
      <div role="status" className="rounded-2xl bg-[var(--surface-1)] p-5">
        <h2 className="font-semibold text-[var(--text-1)]">{t('knowledge.emptyQueryTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          {t('knowledge.emptyQueryBody')}
        </p>
      </div>
    );
  }

  if (outcome.kind === 'NO_LEXICAL_EVIDENCE') {
    return (
      <div role="status" className="rounded-2xl border border-[var(--border)] p-5">
        <p className="label-xs font-semibold text-[var(--text-2)]">{t('knowledge.refusalLabel')}</p>
        <h2 className="mt-3 text-lg font-semibold text-[var(--text-1)]">
          {t('knowledge.noEvidenceTitle')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          {t('knowledge.noEvidenceBody')}
        </p>
      </div>
    );
  }

  const count = outcome.candidates.length;
  return (
    <section aria-labelledby="knowledge-results" className="space-y-4">
      <div className="flex items-end justify-between gap-4 px-1">
        <h2 id="knowledge-results" className="text-lg font-semibold text-[var(--text-1)]">
          {t('knowledge.resultsTitle')}
        </h2>
        <p className="record-figure text-sm text-[var(--text-2)]">
          {t(count === 1 ? 'knowledge.resultCountOne' : 'knowledge.resultCountMany', { count })}
        </p>
      </div>
      {outcome.candidates.map((evidence, index) => (
        <EvidenceCard key={evidence.claimId} evidence={evidence} rank={index + 1} />
      ))}
    </section>
  );
}

export function KnowledgeScreen() {
  const navigate = useAppNavigate();
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<EvidenceSearchOutcome | null>(null);

  const runSearch = () => setOutcome(searchEvidence(query));

  return (
    <KnowledgeScreenFrame title={t('knowledge.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7">
        <section className="rounded-2xl bg-[var(--accent-soft)] p-5">
          <p className="label-xs font-semibold text-[var(--accent-ink)]">
            {t('knowledge.evidenceOnlyLabel')}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-1)]">{t('knowledge.intro')}</p>
          {evidenceIndexStatus === 'UNCALIBRATED' && (
            <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">
              {t('knowledge.uncalibratedNotice')}
            </p>
          )}
        </section>

        {/* Le sommaire passe devant. La mesure du 2026-08-26 a tranché : une
            recherche lexicale répond pour 28 questions sur 28 auxquelles le
            corpus ne peut pas répondre, et aucun seuil de refus ne rattrape ça.
            Parcourir est devenu le parcours principal ; chercher est le
            raccourci de celui qui sait déjà quel mot il cherche. */}
        <WikiBrowse />

        <section className="border-t border-[var(--border)] px-1 pt-5">
          <h2 className="text-lg font-semibold text-[var(--text-1)]">
            {t('knowledge.article.searchTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            {t('knowledge.article.searchIntro')}
          </p>
        </section>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <label htmlFor="knowledge-query" className="label-xs font-semibold text-[var(--text-2)]">
            {t('knowledge.queryLabel')}
          </label>
          <input
            id="knowledge-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t('knowledge.queryPlaceholder')}
            enterKeyHint="search"
            autoComplete="off"
            className="min-h-14 w-full rounded-xl bg-[var(--surface-2)] px-4 text-base
              text-[var(--text-1)] outline-none placeholder:text-[var(--text-2)]
              focus:ring-2 focus:ring-[var(--accent-ink)]"
          />
          <Button type="submit" variant="primary" size="lg" fullWidth>
            {t('knowledge.searchAction')}
          </Button>
        </form>

        {outcome === null ? (
          <p className="px-1 text-sm leading-6 text-[var(--text-2)]">{t('knowledge.idleHint')}</p>
        ) : (
          <SearchResult outcome={outcome} />
        )}

        <section className="border-t border-[var(--border)] px-1 pt-5">
          <h2 className="label-xs font-semibold text-[var(--text-2)]">
            {t('knowledge.limitTitle')}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{t('knowledge.limitBody')}</p>
        </section>
      </div>
    </KnowledgeScreenFrame>
  );
}
