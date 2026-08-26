import { findArticle } from './articleCatalogue';
import type { WikiArticle } from './articleTypes';

/**
 * « Apprendre à programmer » : l'ordre dans lequel lire le Guide.
 *
 * Le Guide seul est une table des matières du document source — 19 sujets, dans
 * l'ordre où l'auteur les a écrits. C'est complet et illisible pour qui veut
 * juste construire son premier programme sans faire n'importe quoi.
 *
 * Ce parcours ne contient **aucun contenu propre** : il ordonne des articles qui
 * existent, et dit en une phrase pourquoi chaque étape arrive à ce moment-là. Si
 * une page manque, l'étape disparaît au lieu de mener nulle part.
 *
 * L'ordre est une décision pédagogique, pas une déduction : la surcharge
 * progressive vient en premier parce que sans elle rien du reste ne produit quoi
 * que ce soit, et la douleur vient avant les contradictions parce qu'on peut se
 * blesser avant d'avoir fini de lire.
 */
export type LearningStep = Readonly<{
  articleId: string;
  /** Une phrase. Pourquoi cette étape, maintenant. */
  reason: string;
}>;

export const LEARNING_PATH: readonly LearningStep[] = [
  {
    articleId: 'programming-progression',
    reason:
      'Sans progression, rien de ce qui suit ne produit quoi que ce soit. C’est le seul paramètre dont l’absence annule tous les autres.',
  },
  {
    articleId: 'programming-volume',
    reason:
      'Combien de séries par muscle et par semaine. Le paramètre le mieux étudié, et celui dont on abuse le plus vite.',
  },
  {
    articleId: 'programming-frequency',
    reason:
      'Comment répartir ce volume dans la semaine. Réponse courte, et c’est une bonne nouvelle.',
  },
  {
    articleId: 'programming-intensity-and-repetitions',
    reason:
      'Quelle charge, combien de répétitions. La plage utile est bien plus large que ce qu’on entend en salle.',
  },
  {
    articleId: 'programming-rir-rpe',
    reason:
      'Jusqu’où pousser une série. C’est ce qui décide si une série légère compte ou non.',
  },
  {
    articleId: 'programming-rest',
    reason: 'Combien de temps entre deux séries, et ce que raccourcir coûte vraiment.',
  },
  {
    articleId: 'programming-exercise-selection',
    reason:
      'Choisir et changer ses exercices. À lire avec les familles de mouvement du wiki, qui disent quels muscles coopèrent.',
  },
  {
    articleId: 'programming-exercise-order',
    reason: 'Dans quel ordre les enchaîner dans une séance.',
  },
  {
    articleId: 'programming-splits',
    reason: 'Découper la semaine. C’est une conséquence du volume et de la fréquence, pas un choix premier.',
  },
  {
    articleId: 'programming-periodization',
    reason: 'Organiser plusieurs semaines, une fois que la séance tient debout.',
  },
  {
    articleId: 'programming-deload',
    reason: 'Alléger volontairement, et sur quelles bases.',
  },
  {
    articleId: 'clinical-red-flags',
    reason:
      'Ce qui doit faire arrêter, et ce qui doit faire consulter. À lire avant d’en avoir besoin, pas pendant.',
  },
  {
    articleId: 'programming-contradictions',
    reason:
      'Les désaccords que la littérature n’a pas tranchés. Les connaître évite de suivre le premier avis entendu.',
  },
  {
    articleId: 'method-limits-governance',
    reason:
      'Ce que tout ce qui précède ne permet pas d’affirmer. La dernière étape, et pas la moins utile.',
  },
];

export type ResolvedLearningStep = Readonly<{ article: WikiArticle; reason: string }>;

/** Le parcours, privé des étapes dont l'article n'existe pas. */
export function resolveLearningPath(): readonly ResolvedLearningStep[] {
  return LEARNING_PATH.flatMap((step) => {
    const article = findArticle(step.articleId);
    return article === undefined ? [] : [{ article, reason: step.reason }];
  });
}

/**
 * Les étapes déjà lues, dans `localStorage` comme le thème et l'annonceur : la
 * progression d'une lecture n'est pas une donnée d'entraînement, elle n'a rien à
 * faire dans Dexie. Elle voyage tout de même dans la sauvegarde, qui capture
 * l'espace de noms `fittrack:`.
 */
export const LEARNING_PATH_STORAGE_KEY = 'fittrack:learnProgramming';

export function loadReadSteps(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(LEARNING_PATH_STORAGE_KEY);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    // Navigation privée, stockage plein, JSON corrompu : un parcours sans
    // mémoire reste utilisable, un écran qui plante non.
    return new Set();
  }
}

export function saveReadSteps(readSteps: ReadonlySet<string>): void {
  try {
    localStorage.setItem(LEARNING_PATH_STORAGE_KEY, JSON.stringify([...readSteps]));
  } catch {
    // Idem : ne rien mémoriser est acceptable, échouer bruyamment ne l'est pas.
  }
}
