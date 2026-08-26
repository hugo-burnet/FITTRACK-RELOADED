// Contrats du bundle éditorial embarqué.
//
// `wiki-articles.json` est généré depuis les Markdown de
// `fittrack-kb-contract/editorial/articles/` par `npm run kb:build-articles`, et
// `prebuild` vérifie qu'il n'a pas dérivé. Ces types décrivent ce que le build a
// déjà validé : identifiants uniques, portées dans les vocabulaires contrôlés,
// blocs factuels tous sourcés.
import type { MovementPattern, MuscleGroup } from '@/data/types';

export type WikiFamily =
  | 'muscles'
  | 'movements'
  | 'exercise-choice'
  | 'programming'
  | 'clinical'
  | 'method';

export type WikiReviewState = 'reviewed' | 'pending_human_review';

export type WikiArticleBlock = Readonly<{
  blockId: string;
  text: string;
  /** Affirmations de `evidence-index.json` qui portent ce texte. */
  claimIds: string[];
  /** Fiches de `f1-programming.json` qui portent ce texte. */
  rowIds: string[];
  /**
   * Muscles dont ce bloc documente le rôle. C'est **la seule** donnée qui
   * autorise à expliquer la coopération d'un muscle secondaire ; sans elle, on
   * renvoie vers sa fiche sans inventer de relation mécanique.
   */
  muscleRoles: MuscleGroup[];
  /** Un bloc éditorial introduit et relie ; il n'affirme rien de neuf. */
  editorial: boolean;
}>;

export type WikiArticleSection = Readonly<{
  sectionId: string;
  title: string;
  blocks: WikiArticleBlock[];
}>;

export type WikiArticle = Readonly<{
  articleId: string;
  title: string;
  summary: string;
  family: WikiFamily;
  /** Rang de lecture dans sa famille, déclaré dans le Markdown. */
  order: number;
  muscleGroups: MuscleGroup[];
  movementPatterns: MovementPattern[];
  exerciseSlugs: string[];
  reviewState: WikiReviewState;
  sections: readonly WikiArticleSection[];
}>;

/** Les identités documentaires d'un exercice, et rien d'autre. */
export type ArticleScope = Readonly<{
  muscleGroups?: readonly MuscleGroup[];
  movementPatterns?: readonly MovementPattern[];
  exerciseSlugs?: readonly string[];
}>;

export type WikiArticleBundle = Readonly<{
  schemaVersion: string;
  sourceHashes: Readonly<{ evidence: string; programming: string }>;
  families: WikiFamily[];
  articles: WikiArticle[];
  coverage: Readonly<{
    contexts: number;
    merged: number;
    readablePassages: number;
    claims: number;
    uncoveredClaims: string[];
  }>;
  programmingCoverage: Readonly<{
    rows: number;
    integrated: number;
    appendix: number;
    uncoveredRows: string[];
  }>;
}>;
