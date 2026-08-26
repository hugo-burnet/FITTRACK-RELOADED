import { t } from '@/i18n/fr';
import type { WikiArticle, WikiArticleBlock } from './articleTypes';
import { stripEmphasis } from './markdownText';

/** Le bandeau qui dit que la matière n'a pas été relue. Il ne se ferme pas. */
export function UnreviewedNotice({ article }: { article: WikiArticle }) {
  if (article.reviewState !== 'pending_human_review') return null;
  return (
    <section className="border-y border-[var(--border)] px-1 py-3">
      <p className="text-sm leading-6 text-[var(--text-2)]">
        <span className="label-xs mr-2 font-semibold">
          {t('knowledge.article.unreviewedLabel')}
        </span>
        {t('knowledge.article.unreviewedBody')}
      </p>
    </section>
  );
}

/** `Label : valeur` — la forme d'un champ de fiche de programmation. */
function splitField(text: string): { label: string; value: string } | null {
  const at = text.indexOf(' : ');
  if (at === -1) return null;
  return { label: text.slice(0, at), value: text.slice(at + 3) };
}

function Provenance({ sources }: { sources: readonly string[] }) {
  return (
    <details className="mt-4 border-t border-[var(--border)] pt-1">
      <summary
        className="label-xs flex min-h-12 cursor-pointer items-center font-semibold
          text-[var(--text-2)]"
      >
        {t('knowledge.article.sourcesLabel')}
      </summary>
      <p className="record-figure break-words pb-3 text-xs leading-5 text-[var(--text-2)]">
        {sources.join(' · ')}
      </p>
    </details>
  );
}

/**
 * Une fiche de programmation, rendue comme une fiche.
 *
 * Défaut trouvé à la relecture : projetée en blocs indépendants, une ligne F1
 * perdait sa structure. La page « Publications majeures » devenait une suite de
 * « Type : … », « URL : PMC » sans qu'on puisse dire à quelle publication
 * chaque ligne appartenait. C'est exactement ce que le commentaire de
 * `programmingIndex.ts` annonçait : « les forcer dans la même forme perdrait ce
 * qui fait la valeur de la seconde ».
 *
 * Le premier champ porte l'affirmation ; les suivants la qualifient.
 */
function RowCard({ blocks }: { blocks: readonly WikiArticleBlock[] }) {
  const fields = blocks.flatMap((block) => {
    const field = splitField(stripEmphasis(block.text));
    return field === null ? [] : [field];
  });
  const [head, ...rest] = fields;
  const sources = [...new Set(blocks.flatMap((block) => block.rowIds))];

  if (head === undefined) return null;

  return (
    <article className="p-5">
      <p className="label-xs font-semibold text-[var(--text-2)]">{head.label}</p>
      <p className="mt-3 text-base leading-7 text-[var(--text-1)]">{head.value}</p>

      {rest.length > 0 && (
        <dl className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
          {rest.map((field) => (
            <div key={field.label}>
              <dt className="label-xs font-semibold text-[var(--text-2)]">{field.label}</dt>
              <dd className="mt-1 text-sm leading-6 text-[var(--text-1)]">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Provenance sources={sources} />
    </article>
  );
}

function ProseBlock({ block }: { block: WikiArticleBlock }) {
  // Un bloc éditorial n'affirme rien : il n'a donc pas le rail du témoin, qui
  // sur tous les autres écrans veut dire « ce texte vient d'une source ». Lui
  // en donner un ferait mentir un signe visuel déjà installé.
  if (block.editorial) {
    return <p className="px-1 text-base leading-7 text-[var(--text-2)]">{block.text}</p>;
  }

  return (
    <article className="p-5">
      <p className="text-base leading-7 text-[var(--text-1)]">{stripEmphasis(block.text)}</p>
      <Provenance sources={[...block.claimIds, ...block.rowIds]} />
    </article>
  );
}

type Group =
  | { kind: 'block'; key: string; block: WikiArticleBlock }
  | { kind: 'row'; key: string; blocks: WikiArticleBlock[] };

type Run =
  | { kind: 'editorial'; key: string; block: WikiArticleBlock }
  | { kind: 'sourced'; key: string; groups: Group[] };

/**
 * Regroupe les blocs consécutifs qui citent la même fiche de programmation.
 * Tout le reste passe tel quel : la prose anatomique n'a pas de fiche à
 * reconstituer.
 */
function groupBlocks(blocks: readonly WikiArticleBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    const rowId =
      block.rowIds.length === 1 && block.claimIds.length === 0 ? (block.rowIds[0] ?? null) : null;
    const last = groups.at(-1);
    if (rowId !== null && last?.kind === 'row' && last.key === rowId) {
      last.blocks.push(block);
      continue;
    }
    if (rowId !== null) groups.push({ kind: 'row', key: rowId, blocks: [block] });
    else groups.push({ kind: 'block', key: block.blockId, block });
  }
  return groups;
}

/** Editorial prose breaks the factual surface; adjacent sourced units share it. */
function groupRuns(groups: readonly Group[]): Run[] {
  const runs: Run[] = [];
  for (const group of groups) {
    if (group.kind === 'block' && group.block.editorial) {
      runs.push({ kind: 'editorial', key: group.key, block: group.block });
      continue;
    }

    const last = runs.at(-1);
    if (last?.kind === 'sourced') last.groups.push(group);
    else runs.push({ kind: 'sourced', key: `sourced:${group.key}`, groups: [group] });
  }
  return runs;
}

/**
 * Le corps d'un article, partagé par la page de lecture et par la projection
 * Documentation d'un exercice. Les deux affichent la même chose : c'est le
 * chemin qui y mène qui diffère, pas le contenu.
 */
export function ArticleBody({ article }: { article: WikiArticle }) {
  return (
    <div className="space-y-7">
      <UnreviewedNotice article={article} />

      {article.sections.map((section) => (
        <section key={section.sectionId} aria-labelledby={section.sectionId} className="space-y-4">
          <h2 id={section.sectionId} className="px-1 text-lg font-semibold text-[var(--text-1)]">
            {section.title}
          </h2>
          {groupRuns(groupBlocks(section.blocks)).map((run) =>
            run.kind === 'editorial' ? (
              <ProseBlock key={run.key} block={run.block} />
            ) : (
              <div
                key={run.key}
                data-article-evidence-group
                className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl
                  bg-[var(--surface-1)]"
              >
                {run.groups.map((group) =>
                  group.kind === 'row' ? (
                    <RowCard key={group.key} blocks={group.blocks} />
                  ) : (
                    <ProseBlock key={group.key} block={group.block} />
                  ),
                )}
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
