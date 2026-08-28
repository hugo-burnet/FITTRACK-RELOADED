import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { t } from '@/i18n/fr';
import type { WikiArticle, WikiArticleBlock } from './articleTypes';
import { stripEmphasis } from './markdownText';
import { resolveSources } from './claimSources';

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

type Field = { label: string; value: string };

/** L'en-tête d'une fiche de preuve, par opposition à une fiche de publication. */
const CLAIM_FIELD = 'Affirmation principale';

/**
 * Les quatre champs qui disent d'où vient l'affirmation plutôt que ce qu'elle
 * dit. Sur une fiche de preuve ils rejoignent le repli « Sources ».
 *
 * Défaut trouvé sur téléphone : neuf champs de même poids à la file, l'article
 * devenait un mur où l'affirmation ne se distinguait plus de « Type de preuve ».
 * Rien n'est supprimé — même DOM, un tap — parce que la traçabilité une par une
 * est ce que ce wiki promet ; c'est la hiérarchie qui manquait, pas la matière.
 */
const PROVENANCE_FIELDS = new Set([
  'Confiance',
  'Population',
  'Type de preuve',
  'Sources principales',
]);

/** Le seul champ qui se traduit en geste sous la barre. */
const PRACTICE_FIELD = 'Interprétation pratique';

/**
 * Les sources écrivent leurs énumérations en points-virgules. Rendues telles
 * quelles, « Courtes durées; peu de femmes; volumes élevés rares » se lit comme
 * une phrase qui n'en est pas une. Deux segments au minimum : en deçà, c'est une
 * phrase qui contient un point-virgule, et la découper la casserait.
 */
function splitList(value: string): string[] | null {
  const parts = value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return parts.length >= 2 ? parts : null;
}

function FieldValue({ value, className }: { value: string; className: string }) {
  const items = splitList(value);
  if (items === null) return <p className={className}>{value}</p>;
  return (
    <ul className={`${className} list-disc space-y-1 pl-5 marker:text-[var(--text-2)]`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Provenance({
  sources,
  fields = [],
}: {
  sources: readonly string[];
  fields?: readonly Field[];
}) {
  const tutorial = useTutorialControls();

  return (
    /* L'ancre est posée sur chacun : un article porte un bloc Sources par
       affirmation, pas un seul. Le guide encadre le premier du document et
       l'étape se valide sur celui que le lecteur ouvre, quel qu'il soit. */
    <details
      className="mt-4 border-t border-[var(--border)] pt-1"
      data-tutorial-id="knowledge-sources"
      onToggle={(event) => {
        if (event.currentTarget.open) tutorial?.report({ type: 'article-sources-opened' });
      }}
    >
      <summary
        className="label-xs flex min-h-12 cursor-pointer items-center font-semibold
          text-[var(--text-2)]"
      >
        {t('knowledge.article.sourcesLabel')}
      </summary>
      <div className="space-y-3 pb-3">
        {fields.map((field) => (
          <div key={field.label}>
            <p className="label-xs font-semibold text-[var(--text-2)]">{field.label}</p>
            <FieldValue
              value={field.value}
              className="mt-1 text-sm leading-6 text-[var(--text-1)]"
            />
          </div>
        ))}
        {/* La section du corpus, pas son empreinte. Le compte n'apparaît qu'au
            pluriel : « 1.1 Pectoraux — 1 affirmations » se lirait comme un bug,
            et une source unique n'a rien à dénombrer. */}
        <ul className="space-y-1">
          {resolveSources(sources).map((source) => (
            <li key={source.label} className="text-sm leading-6 text-[var(--text-2)]">
              {source.label}
              {source.count > 1 && (
                <span className="text-[var(--text-2)]">
                  {' — '}
                  {t('knowledge.article.sourcesCount', { count: source.count })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
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

  // Une fiche de publication (« Publication : … ») n'a pas de provenance à
  // replier : elle *est* la provenance. Lui appliquer la réorganisation d'une
  // fiche de preuve viderait la carte de ce qui fait sa valeur — c'est le défaut
  // que le commentaire ci-dessus raconte déjà, sous une autre forme.
  const isClaim = head.label === CLAIM_FIELD;
  const practice = isClaim ? rest.find((field) => field.label === PRACTICE_FIELD) : undefined;
  const provenance = isClaim ? rest.filter((field) => PROVENANCE_FIELDS.has(field.label)) : [];
  const caveats = rest.filter((field) => field !== practice && !provenance.includes(field));

  return (
    <article className="p-5">
      {/* L'étiquette « Affirmation principale » se répète sur 55 articles et ne
          dit rien que la première place et le corps ne disent déjà. Une fiche de
          publication garde la sienne : « Publication » y identifie l'objet. */}
      {!isClaim && <p className="label-xs font-semibold text-[var(--text-2)]">{head.label}</p>}
      <p
        className={`text-[var(--text-1)] ${
          isClaim ? 'text-lg leading-8' : 'mt-3 text-base leading-7'
        }`}
      >
        {head.value}
      </p>

      {/* Ce qu'on fait de l'affirmation, sur la surface qui veut déjà dire « à
          retenir » ailleurs dans le Guide. C'est le seul champ qu'on lit une
          barre à la main. */}
      {practice !== undefined && (
        <div className="mt-4 rounded-xl bg-[var(--accent-soft)] p-4">
          <p className="label-xs font-semibold text-[var(--accent-ink)]">{practice.label}</p>
          <FieldValue
            value={practice.value}
            className="mt-1.5 text-sm leading-6 text-[var(--text-1)]"
          />
        </div>
      )}

      {caveats.length > 0 && (
        <dl className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
          {caveats.map((field) => (
            <div key={field.label}>
              <dt className="label-xs font-semibold text-[var(--text-2)]">{field.label}</dt>
              <dd className="mt-1">
                <FieldValue
                  value={field.value}
                  className="text-sm leading-6 text-[var(--text-1)]"
                />
              </dd>
            </div>
          ))}
        </dl>
      )}

      <Provenance sources={sources} fields={provenance} />
    </article>
  );
}

function ProseBlock({ block, framed = true }: { block: WikiArticleBlock; framed?: boolean }) {
  // Un bloc éditorial n'affirme rien : il n'a donc pas le rail du témoin, qui
  // sur tous les autres écrans veut dire « ce texte vient d'une source ». Lui
  // en donner un ferait mentir un signe visuel déjà installé.
  if (block.editorial) {
    return <p className="px-1 text-base leading-7 text-[var(--text-2)]">{block.text}</p>;
  }

  // Hors cadre, le paragraphe s'aligne sur le titre de section plutôt que de
  // garder la marge intérieure d'une carte qui n'est plus là.
  return (
    <article className={framed ? 'p-5' : 'px-1 py-4'}>
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
          {/* Le jalon. Un article de prose n'avait aucun repère : une seule
              surface grise, des paragraphes de même poids, et des titres au ton
              du corps de texte. L'accent ici ne décore pas — c'est le seul
              endroit de la page qui dit « nouvelle idée ». */}
          <h2
            id={section.sectionId}
            className="border-b border-[var(--border)] px-1 pb-2 text-lg font-semibold
              text-[var(--accent-ink)]"
          >
            {section.title}
          </h2>
          {groupRuns(groupBlocks(section.blocks)).map((run) => {
            if (run.kind === 'editorial') return <ProseBlock key={run.key} block={run.block} />;

            // Une fiche est une carte ; de la prose est un document. Les
            // enfermer dans la même dalle grise donnait ce bloc unique où plus
            // rien ne se distinguait — c'est le cadre qui était en trop, pas la
            // matière.
            const framed = run.groups.some((group) => group.kind === 'row');

            return (
              <div
                key={run.key}
                data-article-evidence-group
                className={`divide-y divide-[var(--border)] ${
                  framed ? 'overflow-hidden rounded-2xl bg-[var(--surface-1)]' : ''
                }`}
              >
                {run.groups.map((group) =>
                  group.kind === 'row' ? (
                    <RowCard key={group.key} blocks={group.blocks} />
                  ) : (
                    <ProseBlock key={group.key} block={group.block} framed={framed} />
                  ),
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
