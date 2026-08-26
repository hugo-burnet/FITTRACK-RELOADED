// Le résolveur documentaire : quatre identités d'exercice en entrée, une
// projection prête à afficher en sortie.
//
// C'est l'interface profonde de la spécification. Toute la priorité, la
// déduplication, l'ordre et les limites vivent ici ; l'écran d'exercice ne
// connaît ni identifiant d'article, ni `claimId`, ni table de correspondance.
//
// Ce que ce module ne fait **jamais** : lire le nom visible de l'exercice, son
// UUID, ou rapprocher un texte d'un autre. La mesure du 2026-08-26 a montré
// qu'aucun score lexical ne sait décider quel contenu répond à quoi ; le
// rattachement est déclaré dans le corpus et vérifié au build.
import type { Exercise, MuscleGroup } from '@/data/types';
import { articlesForScope } from './articleCatalogue';
import type { ArticleScope, WikiArticle, WikiFamily } from './articleTypes';

export type DocumentationExercise = Pick<
  Exercise,
  'primaryMuscle' | 'secondaryMuscles' | 'movementPattern' | 'slug'
>;

export type ExerciseDocumentationLimit =
  | 'primary_article_missing'
  | 'movement_pattern_missing'
  | 'movement_article_missing';

export type SecondaryMuscleDocumentation = Readonly<{
  muscle: MuscleGroup;
  article: WikiArticle | null;
  /**
   * Ce que le corpus dit du rôle de ce muscle **dans cette famille de
   * mouvement**. `null` quand aucun bloc sourcé ne le balise : on renvoie alors
   * vers sa fiche complète sans inventer de relation mécanique.
   */
  roleText: string | null;
}>;

export type ExerciseDocumentation = Readonly<{
  primary: WikiArticle | null;
  relationship: WikiArticle | null;
  specific: readonly WikiArticle[];
  /**
   * Les pages cliniques qui portent explicitement l'un des muscles de cet
   * exercice. Elles ne diagnostiquent rien et ne remplacent pas un avis
   * médical ; elles évitent d'avoir à chercher « genou » dans un wiki quand on
   * a mal au genou en faisant du squat.
   */
  clinical: readonly WikiArticle[];
  secondary: readonly SecondaryMuscleDocumentation[];
  /** L'ordre de lecture, dédupliqué. C'est une règle du module, pas de l'écran. */
  articleIds: string[];
  limitations: ExerciseDocumentationLimit[];
}>;

const firstFamily = (scope: ArticleScope, family: WikiFamily): WikiArticle | null =>
  articlesForScope(scope).find((article) => article.family === family) ?? null;

// Déduplication par `articleId`, jamais par titre : deux articles peuvent
// légitimement porter le même titre visible, et un identifiant est la seule
// chose que le contrat éditorial garantit unique.
const uniqueArticles = (articles: readonly (WikiArticle | null)[]): WikiArticle[] => {
  const byId = new Map<string, WikiArticle>();
  for (const article of articles) {
    if (article !== null && !byId.has(article.articleId)) byId.set(article.articleId, article);
  }
  return [...byId.values()];
};

export function getDocumentationForExercise(
  exercise: DocumentationExercise,
): ExerciseDocumentation {
  const primary = firstFamily({ muscleGroups: [exercise.primaryMuscle] }, 'muscles');

  const relationship =
    exercise.movementPattern === undefined
      ? null
      : firstFamily({ movementPatterns: [exercise.movementPattern] }, 'movements');

  const specific =
    exercise.slug === undefined ? [] : articlesForScope({ exerciseSlugs: [exercise.slug] });

  const secondary = exercise.secondaryMuscles
    // Un muscle déjà principal n'est pas un secondaire : le répéter donnerait
    // deux fois la même fiche sur le même écran.
    .filter((muscle) => muscle !== exercise.primaryMuscle)
    .map((muscle): SecondaryMuscleDocumentation => {
      const article = firstFamily({ muscleGroups: [muscle] }, 'muscles');
      const roleBlocks =
        relationship?.sections.flatMap((section) =>
          section.blocks.filter((block) => block.muscleRoles.includes(muscle)),
        ) ?? [];
      return {
        muscle,
        article,
        roleText: roleBlocks.length === 0 ? null : roleBlocks.map((block) => block.text).join(' '),
      };
    });

  // Muscle principal **et** secondaires : une douleur d'épaule sur un développé
  // ne se déclare pas selon que l'épaule est la cible ou l'assistante.
  const involved = [exercise.primaryMuscle, ...exercise.secondaryMuscles];
  const clinical = articlesForScope({ muscleGroups: involved }).filter(
    (article) => article.family === 'clinical',
  );

  const ordered = uniqueArticles([
    primary,
    relationship,
    ...specific,
    ...secondary.map((item) => item.article),
    ...clinical,
  ]);

  // Une lacune s'affiche. Un écran qui ne trouve rien ne doit pas se rabattre
  // sur une recherche globale pour combler le trou : il dit ce qui manque.
  const limitations: ExerciseDocumentationLimit[] = [];
  if (primary === null) limitations.push('primary_article_missing');
  if (exercise.movementPattern === undefined) limitations.push('movement_pattern_missing');
  else if (relationship === null) limitations.push('movement_article_missing');

  return {
    primary,
    relationship,
    specific,
    clinical,
    secondary,
    articleIds: ordered.map((article) => article.articleId),
    limitations,
  };
}
