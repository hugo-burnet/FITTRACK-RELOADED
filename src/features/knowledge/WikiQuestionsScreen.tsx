import { Link, useNavigate } from 'react-router-dom';
import { t } from '@/i18n/fr';
import questionsDocument from './wiki-questions.json';
import { findSectionIdForClaim, findWikiSection } from './wikiIndex';
import { KnowledgeScreenFrame } from './KnowledgeScreenFrame';

type CoveredQuestion = { questionId: string; text: string; claimIds: string[] };
type UncoveredQuestion = { questionId: string; text: string; missing: string };

const covered = questionsDocument.covered as CoveredQuestion[];
const uncovered = questionsDocument.uncovered as UncoveredQuestion[];

/**
 * Les sections où lire, dans l'ordre du corpus et sans doublon : plusieurs
 * affirmations d'une même question vivent souvent dans la même page, et
 * l'afficher trois fois ne dit rien de plus.
 */
function sectionsFor(claimIds: string[]) {
  const seen = new Set<string>();
  const sections = [];
  for (const claimId of claimIds) {
    const sectionId = findSectionIdForClaim(claimId);
    if (sectionId === undefined || seen.has(sectionId)) continue;
    seen.add(sectionId);
    const section = findWikiSection(sectionId);
    if (section !== undefined) sections.push(section);
  }
  return sections;
}

function CoveredCard({ question }: { question: CoveredQuestion }) {
  const sections = sectionsFor(question.claimIds);

  return (
    <article className="relative overflow-hidden rounded-2xl bg-[var(--surface-1)] pl-1">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-ink)]" />
      <div className="p-5">
        <h3 className="text-base font-semibold leading-6 text-[var(--text-1)]">{question.text}</h3>
        <ul className="mt-4 space-y-1">
          {sections.map((section) => (
            <li key={section.sectionId}>
              <Link
                to={`/knowledge/s/${section.sectionId}`}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-4 py-2 text-sm leading-6 text-[var(--text-1)]"
              >
                <span>{section.title}</span>
                <span aria-hidden="true" className="shrink-0 text-[var(--accent-ink)]">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function UncoveredCard({ question }: { question: UncoveredQuestion }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] p-5">
      <p className="label-xs font-semibold text-[var(--text-2)]">
        {t('knowledge.wiki.uncoveredBadge')}
      </p>
      <h3 className="mt-3 text-base font-semibold leading-6 text-[var(--text-1)]">
        {question.text}
      </h3>
      {/* Ce qui manque, en une phrase, plutôt qu'une page vide. Le texte vient
          de l'annotation elle-même : le réécrire ici serait le réinventer. */}
      <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{question.missing}</p>
    </article>
  );
}

export function WikiQuestionsScreen() {
  const navigate = useNavigate();

  return (
    <KnowledgeScreenFrame
      title={t('knowledge.wiki.questionsTitle')}
      onBack={() => void navigate('/knowledge')}
    >
      <div className="space-y-7">
        <section className="rounded-2xl bg-[var(--accent-soft)] p-5">
          <p className="text-sm leading-6 text-[var(--text-1)]">
            {t('knowledge.wiki.questionsIntro')}
          </p>
        </section>

        <section aria-labelledby="wiki-covered" className="space-y-4">
          <div className="px-1">
            <h2 id="wiki-covered" className="text-lg font-semibold text-[var(--text-1)]">
              {t('knowledge.wiki.coveredTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
              {t('knowledge.wiki.coveredIntro')}
            </p>
          </div>
          {covered.map((question) => (
            <CoveredCard key={question.questionId} question={question} />
          ))}
        </section>

        <section aria-labelledby="wiki-uncovered" className="space-y-4">
          <div className="px-1">
            <h2 id="wiki-uncovered" className="text-lg font-semibold text-[var(--text-1)]">
              {t('knowledge.wiki.uncoveredTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
              {t('knowledge.wiki.uncoveredIntro')}
            </p>
          </div>
          {uncovered.map((question) => (
            <UncoveredCard key={question.questionId} question={question} />
          ))}
        </section>
      </div>
    </KnowledgeScreenFrame>
  );
}
