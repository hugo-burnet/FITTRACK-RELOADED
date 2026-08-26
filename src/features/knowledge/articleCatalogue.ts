// L'index du wiki rédigé.
//
// Ce module cache le format de stockage du bundle : au-dessus de lui, personne
// ne connaît de `claimId`, de fichier Markdown ni de table de correspondance. On
// demande un article par identifiant, ou les articles qui portent une identité
// documentaire — un muscle, une famille de mouvement, un slug de catalogue.
//
// Aucune sélection ne passe par un nom visible ni par une proximité lexicale.
// C'est la conséquence directe de la mesure du 2026-08-26 : la recherche ne sait
// pas décider quel contenu rattacher à quoi, et le rattachement est désormais
// déclaré dans le corpus puis vérifié au build.
import { t } from '@/i18n/fr';
import type { MovementPattern, MuscleGroup } from '@/data/types';
import bundleDocument from './wiki-articles.json';
import type { ArticleScope, WikiArticle, WikiArticleBundle, WikiFamily } from './articleTypes';

const bundle = bundleDocument as unknown as WikiArticleBundle;

export const wikiArticles: readonly WikiArticle[] = bundle.articles;

export const wikiArticleCoverage = bundle.coverage;

const FAMILY_LABELS = {
  muscles: 'knowledge.article.familyMuscles',
  movements: 'knowledge.article.familyMovements',
  'exercise-choice': 'knowledge.article.familyExerciseChoice',
  programming: 'knowledge.article.familyProgramming',
  clinical: 'knowledge.article.familyClinical',
  method: 'knowledge.article.familyMethod',
} as const satisfies Record<WikiFamily, string>;

export type ArticleFamilyGroup = Readonly<{
  id: WikiFamily;
  label: string;
  articles: readonly WikiArticle[];
}>;

const byId = new Map(bundle.articles.map((article) => [article.articleId, article]));

function index<Key>(pick: (article: WikiArticle) => readonly Key[]): Map<Key, WikiArticle[]> {
  const map = new Map<Key, WikiArticle[]>();
  for (const article of bundle.articles) {
    for (const key of pick(article)) {
      const existing = map.get(key);
      if (existing) existing.push(article);
      else map.set(key, [article]);
    }
  }
  return map;
}

const byMuscle = index<MuscleGroup>((article) => article.muscleGroups);
const byMovement = index<MovementPattern>((article) => article.movementPatterns);
const bySlug = index<string>((article) => article.exerciseSlugs);

// L'ordre de lecture du sommaire : celui du bundle, écrit à la main dans le
// contrat. Un sommaire qui se réordonne selon les données n'est plus un
// sommaire — c'est la règle déjà appliquée par l'ancien index de sections.
const families: ArticleFamilyGroup[] = bundle.families.map((id) => ({
  id,
  label: t(FAMILY_LABELS[id]),
  articles: bundle.articles
    .filter((article) => article.family === id)
    .sort((left, right) => left.order - right.order),
}));

export function listArticleFamilies(): readonly ArticleFamilyGroup[] {
  return families;
}

export function findArticle(articleId: string): WikiArticle | undefined {
  return byId.get(articleId);
}

/**
 * Les articles qui portent l'une des identités demandées, dédupliqués et rendus
 * dans l'ordre du bundle. La **priorité** entre muscle, mouvement et slug n'est
 * pas décidée ici : elle appartient au résolveur documentaire, qui sait dans
 * quel ordre un écran d'exercice doit lire ces articles.
 */
export function articlesForScope(scope: ArticleScope): readonly WikiArticle[] {
  const found = new Set<WikiArticle>();
  for (const muscle of scope.muscleGroups ?? []) {
    for (const article of byMuscle.get(muscle) ?? []) found.add(article);
  }
  for (const pattern of scope.movementPatterns ?? []) {
    for (const article of byMovement.get(pattern) ?? []) found.add(article);
  }
  for (const slug of scope.exerciseSlugs ?? []) {
    for (const article of bySlug.get(slug) ?? []) found.add(article);
  }
  return bundle.articles.filter((article) => found.has(article));
}

/**
 * Les pages du Guide vivent sous `/knowledge/programmation` pour rester dans
 * l'espace Planifier, les autres sous `/knowledge/a`. Les deux adresses mènent au
 * même composant de lecture : c'est l'emplacement qui change, pas la page.
 */
export function articleHref(article: WikiArticle): string {
  return article.family === 'programming'
    ? `/knowledge/programmation/${article.articleId}`
    : `/knowledge/a/${article.articleId}`;
}

/**
 * L'article du Guide qui cite une fiche de programmation donnée.
 *
 * La recherche globale peut encore remonter une fiche `cand.e1.*` ; le lien
 * « lire dans sa section » doit alors mener à l'article qui la porte, et non à
 * une page de lignes brutes. C'est le seul endroit où l'application traduit un
 * identifiant de source en page — et il lit la déclaration du corpus, pas un
 * rapprochement de texte.
 */
const articleByRow = new Map<string, WikiArticle>();
for (const article of bundle.articles) {
  for (const section of article.sections) {
    for (const block of section.blocks) {
      for (const rowId of block.rowIds) articleByRow.set(rowId, article);
    }
  }
}

export function findArticleForRow(rowId: string): WikiArticle | undefined {
  return articleByRow.get(rowId);
}
