# Wiki structuré, documentation des exercices et Planifier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le routage documentaire par recherche par un wiki statique traçable, relier ce wiki aux exercices du catalogue et personnels, puis réunir Routines, Programmes et Guide dans Planifier avec dossiers repliables et réordonnancement verrouillé.

**Architecture:** Les Markdown versionnés dans `fittrack-kb-contract/editorial/articles/` deviennent la source canonique ; un générateur déterministe les valide contre les 408 affirmations, les 102 fiches de programmation et les vocabulaires contrôlés, puis produit le JSON embarqué. L’application consomme ce JSON derrière deux interfaces profondes : le catalogue éditorial et `getDocumentationForExercise`, sans recherche de nom ni modèle. L’interface ajoute ensuite une projection Documentation aux exercices et un espace Planifier qui conserve les objets `Routine` et `Program` existants.

**Tech Stack:** Node.js >= 20, Vite 8, React 19, TypeScript strict, Tailwind CSS v4, Dexie 4, Zustand 5, Vitest 4, Testing Library, `node:test` pour le contrat KB.

## Global Constraints

- L’application doit fonctionner à 100 % hors ligne ; aucun modèle, appel réseau ou secret n’entre dans le runtime.
- Les articles Markdown sont canoniques ; `src/features/knowledge/wiki-articles.json` est généré et ne se modifie jamais à la main.
- Les 408 affirmations anatomiques/cliniques restent traçables ; les 266 contextes avant fusion doivent produire exactement 209 passages lisibles après 57 fusions imbriquées.
- Les 102 fiches de programmation restent `pending_human_review` jusqu’à une revue humaine explicite.
- Le branchement d’un exercice utilise seulement `primaryMuscle`, `secondaryMuscles`, `movementPattern` et le `slug` du catalogue ; jamais le nom visible ni l’UUID local.
- `movementPattern` est facultatif et non indexé ; aucune table ni version Dexie n’est ajoutée.
- Les routes `/routines`, `/programs` et `/knowledge/programmation` restent canoniques ; seul `/programs/new` crée un `Program`.
- Les états de repli et de verrouillage sont éphémères, non persistés, et reviennent respectivement à « tout déplié » et « verrouillé » après redémarrage.
- Toutes les chaînes d’interface vivent dans `src/i18n/fr.ts`, avec des cibles tactiles de 48 px minimum.
- Toute tâche de logique suit rouge → vert → refactor ; chaque tâche finit par un commit atomique.

---

## File map

### Contrat éditorial et génération

- Create: `fittrack-kb-contract/editorial/ARTICLE_FORMAT.md` — syntaxe Markdown canonique et règles de provenance.
- Create: `fittrack-kb-contract/editorial/articles/**/*.md` — articles canoniques organisés par famille.
- Create: `fittrack-kb-contract/tools/editorial/article-format.mjs` — parseur, normalisation et diagnostics.
- Create: `fittrack-kb-contract/tools/editorial/build-articles.mjs` — validation, couverture et bundle déterministe.
- Create: `fittrack-kb-contract/tests/editorial/article-format.test.mjs` — contrat du parseur.
- Create: `fittrack-kb-contract/tests/editorial/article-validation.test.mjs` — invariants de contenu et mutants.
- Create: `scripts/build-wiki-articles.mjs` — façade racine `--write` / `--check`.
- Create in Task 4: `src/features/knowledge/wiki-articles.json` — artefact généré après ajout du corpus complet.
- Modify: `fittrack-kb-contract/package.json` — commande `test:editorial`.
- Modify: `package.json` — commandes de génération et contrôle avant build.

### Runtime wiki et documentation

- Create: `src/features/knowledge/articleTypes.ts` — contrats du bundle embarqué.
- Create: `src/features/knowledge/articleCatalogue.ts` — indexation, lecture et filtre local.
- Create: `src/features/knowledge/articleCatalogue.test.ts` — tests purs du catalogue.
- Create: `src/features/knowledge/ArticleBody.tsx` — rendu partagé des blocs.
- Create: `src/features/knowledge/WikiArticleScreen.tsx` — page d’article.
- Create: `src/features/knowledge/WikiProgrammingScreen.test.tsx` — Guide généré et bandeau non relu.
- Create: `src/features/knowledge/exerciseDocumentation.ts` — résolveur pur.
- Create: `src/features/knowledge/exerciseDocumentation.test.ts` — ordre, déduplication et absence d’inférence.
- Create: `src/features/exercises/ExerciseDocumentationView.tsx` — projection dédiée à une fiche exercice.
- Create: `src/features/exercises/ExerciseDocumentationView.test.tsx` — états complets, partiels et filtre.
- Modify: `src/features/knowledge/KnowledgeScreen.tsx` — sommaire prioritaire, recherche globale secondaire.
- Modify: `src/features/knowledge/WikiBrowse.tsx` — cinq familles et entrée méthode.
- Modify: `src/features/knowledge/routes.tsx` — route lazy des articles.
- Modify: `src/router.tsx` — routes article générique et Guide sous `/knowledge/programmation`.
- Modify: `src/features/exercises/ExerciseDetailScreen.tsx` — vues Suivi / Documentation.
- Modify: `src/features/exercises/ExerciseDetailScreen.test.tsx` — navigation entre les deux vues.

### Identité de mouvement

- Modify in Task 5: `src/data/types.ts` — `MOVEMENT_PATTERNS`, `MovementPattern`, champ optionnel requis par le catalogue d’articles.
- Modify: `src/data/seed/exercises.json` — décision explicite par exercice du catalogue.
- Create: `src/data/seed/catalogueMovementAudit.test.ts` — exhaustivité et vocabulaire.
- Modify: `src/data/seed/seedDatabase.ts` — réalignement contrôlé de `movementPattern`.
- Modify: `src/data/seed/seedDatabase.test.ts` — correction catalogue sans toucher aux exercices personnels.
- Modify: `src/features/exercises/ExerciseFormScreen.tsx` — choix facultatif pour les exercices personnels.
- Modify: `src/features/exercises/ExerciseFormScreen.test.tsx` — création, édition, absence et renommage.
- Modify: `src/i18n/labels.ts` — `movementPatternLabel`.

### Planifier et bibliothèque de routines

- Create: `src/features/planning/PlanningTabs.tsx` — navigation Routines / Programmes / Guide.
- Create: `src/features/planning/PlanningTabs.test.tsx` — route active et liens canoniques.
- Create: `src/features/knowledge/ProgrammingGuideEntry.tsx` — CTA vers le véritable éditeur Program.
- Create: `src/stores/routineLibraryView.ts` — machine d’état éphémère repli/verrou.
- Create: `src/stores/routineLibraryView.test.ts` — mémorisation et restauration des dossiers.
- Modify: `src/app/BottomNav.tsx` — libellé Planifier et activité groupée.
- Create: `src/app/BottomNav.test.tsx` — activité sur les trois routes.
- Modify: `src/features/routines/RoutinesScreen.tsx` — onglets, commandes globales et cadenas.
- Modify: `src/features/routines/RoutineCollection.tsx` — groupes repliables et drag désactivé.
- Modify: `src/features/routines/RoutineCollection.test.tsx` — accessibilité, repli et placement complet.
- Modify: `src/features/programs/ProgramListScreen.tsx` — navigation Planifier.
- Modify in Task 5: `src/features/knowledge/WikiProgrammingScreen.tsx` — liste des articles Guide générés et bandeau de revue.
- Modify in Task 10: `src/features/knowledge/WikiProgrammingScreen.tsx` — navigation Planifier et CTA.
- Modify: `src/i18n/fr.ts` — tout le vocabulaire nouveau.
- Modify: `PROGRESS.md` — verdict, livraison et checkpoints téléphone.

---

### Task 1: Fermer proprement la piste reranker et CAL

**Files:**
- Modify: `fittrack-kb-contract/benchmark/e5-retrieval/RESULTATS.md:362`
- Modify: `docs/plans/kb-phase-4-wiki.md:176`
- Modify: `PROGRESS.md:1`

**Interfaces:**
- Consumes: résultats mesurés déjà consignés sur DEV.
- Produces: décision documentaire explicite ; aucune dépendance runtime.

- [ ] **Step 1: Ajouter le verdict mesuré aux résultats**

Ajouter sous la section cross-encoder :

```markdown
#### Verdict produit — 2026-08-26

Le petit cross-encoder atteint 4 343 ms/question après chargement pour 16 passages avec WebGPU,
mais dégrade le rappel de 27/31 à 22/31 et la précision@1 de 17/31 à 5/31. La piste est arrêtée :
aucun reranker n’entre dans l’application, CAL et TEST restent fermés, et la recherche ne sert plus
à décider quel contenu rattacher à un objet FitTrack.
```

- [ ] **Step 2: Marquer T8 conclu négativement et T9 annulé**

Remplacer les cases de `docs/plans/kb-phase-4-wiki.md` par :

```markdown
- [x] **T8 — Mesurer le reclassement.** Mesure conclue négativement le 2026-08-26 :
      4 343 ms/question, rappel 22/31, précision@1 5/31.
- [x] **T9 — Ne pas recalibrer le refus.** Annulée par le résultat négatif de T8 ;
      CAL et TEST restent fermés.
```

- [ ] **Step 3: Vérifier le diff documentaire**

Run: `git diff --check`

Expected: aucune sortie, code 0.

- [ ] **Step 4: Commit**

```bash
git add fittrack-kb-contract/benchmark/e5-retrieval/RESULTATS.md docs/plans/kb-phase-4-wiki.md PROGRESS.md
git commit -m "docs(kb): clore la piste de reclassement"
```

### Task 2: Définir le format éditorial exécutable

**Files:**
- Create: `fittrack-kb-contract/editorial/ARTICLE_FORMAT.md`
- Create: `fittrack-kb-contract/tools/editorial/article-format.mjs`
- Create: `fittrack-kb-contract/tests/editorial/article-format.test.mjs`
- Modify: `fittrack-kb-contract/package.json`

**Interfaces:**
- Consumes: Markdown UTF-8 portant un commentaire JSON `fittrack-wiki` et des annotations de blocs.
- Produces: `parseArticle(source, filePath): ParsedArticle` et `ArticleFormatError`.

- [ ] **Step 1: Écrire les tests rouges du parseur**

Créer `article-format.test.mjs` avec ces cas complets :

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArticleFormatError, parseArticle } from '../../tools/editorial/article-format.mjs';

const VALID = `<!-- fittrack-wiki
{"articleId":"muscle-triceps","title":"Triceps","summary":"Comprendre le triceps.","family":"muscles","muscleGroups":["triceps"],"movementPatterns":[],"exerciseSlugs":[],"reviewState":"reviewed"}
-->
# Triceps
## Anatomie et fonctions
<!-- factual: claim.97d620570f37f665 | roles: triceps -->
Le chef long traverse aussi l’épaule.
<!-- editorial -->
Cette distinction organise la suite de la fiche.
`;

test('parse les métadonnées, sections et sources de chaque bloc', () => {
  const article = parseArticle(VALID, 'muscles/triceps.md');
  assert.equal(article.articleId, 'muscle-triceps');
  assert.deepEqual(article.muscleGroups, ['triceps']);
  assert.deepEqual(article.sections[0].blocks[0].claimIds, ['claim.97d620570f37f665']);
  assert.deepEqual(article.sections[0].blocks[0].muscleRoles, ['triceps']);
  assert.equal(article.sections[0].blocks[1].editorial, true);
});

test('rejette un paragraphe sans annotation', () => {
  assert.throws(
    () => parseArticle(VALID.replace('<!-- editorial -->\n', ''), 'broken.md'),
    (error) => error instanceof ArticleFormatError && error.code === 'UNSOURCED_BLOCK',
  );
});

test('accepte une fiche de programmation comme source', () => {
  const source = VALID.replace(
    '<!-- factual: claim.97d620570f37f665 | roles: triceps -->',
    '<!-- factual: row:cand.e1.bbadd751172a5c7f -->',
  ).replace('"reviewed"', '"pending_human_review"');
  assert.deepEqual(parseArticle(source, 'programming/volume.md').sections[0].blocks[0].rowIds, [
    'cand.e1.bbadd751172a5c7f',
  ]);
});
```

- [ ] **Step 2: Exécuter le test et constater l’échec**

Run: `node --test fittrack-kb-contract/tests/editorial/article-format.test.mjs`

Expected: FAIL avec `ERR_MODULE_NOT_FOUND` pour `article-format.mjs`.

- [ ] **Step 3: Implémenter le contrat minimal du parseur**

Le module exporte exactement :

```js
export class ArticleFormatError extends Error {
  constructor(code, filePath, message) {
    super(`${filePath}: ${message}`);
    this.name = 'ArticleFormatError';
    this.code = code;
    this.filePath = filePath;
  }
}

export function parseArticle(source, filePath) {
  const header = source.match(/^<!-- fittrack-wiki\s*\n([\s\S]*?)\n-->\s*\n/u);
  if (!header) throw new ArticleFormatError('MISSING_HEADER', filePath, 'en-tête absent');
  let metadata;
  try { metadata = JSON.parse(header[1]); }
  catch { throw new ArticleFormatError('INVALID_HEADER', filePath, 'JSON invalide'); }

  const lines = source.slice(header[0].length).split(/\r?\n/u);
  const sections = [];
  let section = null;
  let provenance = null;
  let textLines = [];
  const flush = () => {
    if (textLines.length === 0) return;
    const text = textLines.join(' ').trim();
    textLines = [];
    if (!section) throw new ArticleFormatError('BLOCK_OUTSIDE_SECTION', filePath, 'bloc hors section');
    if (!provenance) throw new ArticleFormatError('UNSOURCED_BLOCK', filePath, `bloc sans source: ${text}`);
    const claimIds = provenance.refs.filter((value) => !value.startsWith('row:'));
    const rowIds = provenance.refs.filter((value) => value.startsWith('row:')).map((value) => value.slice(4));
    section.blocks.push({ blockId: `${section.sectionId}-b${section.blocks.length + 1}`, text, claimIds, rowIds, muscleRoles: provenance.muscleRoles, editorial: provenance.editorial });
    provenance = null;
  };
  for (const line of lines) {
    if (line.startsWith('# ')) { flush(); continue; }
    if (line.startsWith('## ')) {
      flush();
      section = { sectionId: `${metadata.articleId}-${sections.length + 1}`, title: line.slice(3), blocks: [] };
      sections.push(section);
      provenance = null;
      continue;
    }
    const factual = line.match(/^<!-- factual: ([^|]+?)(?: \| roles: (.+))? -->$/u);
    if (factual) {
      flush();
      provenance = {
        refs: factual[1].split(',').map((value) => value.trim()),
        muscleRoles: factual[2]?.split(',').map((value) => value.trim()) ?? [],
        editorial: false,
      };
      continue;
    }
    if (line === '<!-- editorial -->') { flush(); provenance = { refs: [], muscleRoles: [], editorial: true }; continue; }
    if (line.trim() === '') { flush(); continue; }
    textLines.push(line.trim());
  }
  flush();
  return { ...metadata, sections };
}
```

Documenter exactement la même grammaire dans `ARTICLE_FORMAT.md`, avec l’interdiction d’un bloc factuel sans `claim.*` ou `row:cand.*`. `roles:` est facultatif, accepte uniquement les muscles contrôlés et constitue la seule donnée que le résolveur peut utiliser pour expliquer le rôle d’un muscle secondaire.

- [ ] **Step 4: Ajouter et lancer la commande du paquet KB**

Ajouter dans `fittrack-kb-contract/package.json` :

```json
"test:editorial": "node --test tests/editorial/*.test.mjs"
```

Run: `npm --prefix fittrack-kb-contract run test:editorial`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add fittrack-kb-contract/editorial/ARTICLE_FORMAT.md fittrack-kb-contract/tools/editorial/article-format.mjs fittrack-kb-contract/tests/editorial/article-format.test.mjs fittrack-kb-contract/package.json
git commit -m "feat(kb): definir le format editorial"
```

### Task 3: Valider la provenance et générer le bundle embarqué

**Files:**
- Create: `fittrack-kb-contract/tools/editorial/build-articles.mjs`
- Create: `fittrack-kb-contract/tests/editorial/article-validation.test.mjs`
- Create: `scripts/build-wiki-articles.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `parseArticle`, `evidence-index.json`, `f1-programming.json`, `movement-pattern.vocab.json`, `exercises.json`.
- Produces: `buildArticleBundle({ articleSources }): WikiArticleBundle`, `validateArticleBundle(bundle): Diagnostic[]`, CLI `--write|--check`. Le JSON applicatif n’est écrit qu’en Task 4, lorsque le corpus complet existe.

- [ ] **Step 1: Écrire les tests rouges des invariants**

Les tests construisent un article valide minimal puis mutent une propriété à la fois :

```js
test('rejette les identifiants, muscles, mouvements, slugs et sources inconnus', () => {
  assert.deepEqual(codes(validateArticleBundle(bundleWith({ articleId: 'duplique' }))), ['DUPLICATE_ARTICLE_ID']);
  assert.deepEqual(codes(validateArticleBundle(bundleWith({ muscleGroups: ['inconnu'] }))), ['UNKNOWN_MUSCLE']);
  assert.deepEqual(codes(validateArticleBundle(bundleWith({ movementPatterns: ['inconnu'] }))), ['UNKNOWN_MOVEMENT']);
  assert.deepEqual(codes(validateArticleBundle(bundleWith({ exerciseSlugs: ['inconnu'] }))), ['UNKNOWN_EXERCISE_SLUG']);
  assert.deepEqual(codes(validateArticleBundle(bundleWithBlock({ claimIds: ['claim.inconnu'] }))), ['UNKNOWN_CLAIM']);
});

test('conserve pending_human_review dès qu’une fiche de programmation est citée', () => {
  const bundle = bundleWithBlock({ rowIds: ['cand.e1.bbadd751172a5c7f'] }, { reviewState: 'reviewed' });
  assert.ok(codes(validateArticleBundle(bundle)).includes('PROGRAMMING_REVIEW_PROMOTED'));
});

test('rejette un rôle musculaire hors d’un article de mouvement', () => {
  const bundle = bundleWithBlock({ muscleRoles: ['triceps'] }, { family: 'muscles' });
  assert.ok(codes(validateArticleBundle(bundle)).includes('ROLE_OUTSIDE_MOVEMENT'));
});

test('calcule 266 contextes, 57 fusions, 209 passages et 408 claims couverts', () => {
  const report = buildCoverageReport(fullBundle);
  assert.deepEqual(report, { contexts: 266, merged: 57, readablePassages: 209, claims: 408, uncoveredClaims: [] });
});
```

- [ ] **Step 2: Exécuter les tests et constater l’échec**

Run: `npm --prefix fittrack-kb-contract run test:editorial`

Expected: FAIL sur l’import de `build-articles.mjs`.

- [ ] **Step 3: Implémenter le bundle déterministe**

Utiliser ce contrat de sortie, sans timestamp :

```js
export function buildArticleBundle({ articles, evidenceIndex, programming, vocabularies, catalogue }) {
  const sorted = [...articles].sort((left, right) => left.articleId.localeCompare(right.articleId));
  return {
    schemaVersion: '1.0.0-wiki-articles',
    sourceHashes: {
      evidence: evidenceIndex.corpusHash,
      programming: programming.contentHash,
    },
    families: ['muscles', 'movements', 'exercise-choice', 'programming', 'clinical', 'method'],
    articles: sorted,
    coverage: buildCoverageReport({ articles: sorted, evidenceIndex, programming }),
  };
}
```

`buildCoverageReport` regroupe d’abord les claims par `(sourceTitle, displayContext)`. Chaque entrée reçoit exactement un état : `merged` lorsqu’elle est strictement contenue dans un contexte plus large de la même section, `appendix` lorsqu’elle est citée seulement par une famille `method` ou une section Sources, `integrated` lorsqu’elle alimente le corps d’un autre article. Le rapport exige que les 408 `claimId` soient cités, y compris ceux absorbés par une fusion. Chaque `rowId` des 102 fiches reçoit la même classification ; une ligne bibliographique appartient à `appendix` et toutes les autres à `integrated`.

- [ ] **Step 4: Implémenter la façade racine et le contrôle de dérive**

Le CLI doit lire récursivement `fittrack-kb-contract/editorial/articles/**/*.md`, construire en mémoire la chaîne JSON avec deux espaces et un saut final, puis :

```js
if (mode === '--check') {
  if (existing !== generated) throw new Error('wiki-articles.json est périmé; lancer npm run kb:build-articles');
  console.log('Wiki articles: artefact à jour');
} else {
  writeFileSync(outputPath, generated, 'utf8');
  console.log(`Wiki articles: ${bundle.articles.length} articles -> ${outputPath}`);
}
```

Ajouter à `package.json` sans brancher encore `prebuild` :

```json
"kb:build-articles": "node scripts/build-wiki-articles.mjs --write",
"kb:check-articles": "node scripts/build-wiki-articles.mjs --check",
"kb:test:editorial": "npm --prefix fittrack-kb-contract run test:editorial"
```

- [ ] **Step 5: Lancer les tests du validateur**

Run: `npm run kb:test:editorial`

Expected: tous les tests `editorial` PASS sur les fixtures unitaires. Le corpus réel n’est pas encore contrôlé et aucun test de corpus n’est déclaré avant Task 4.

- [ ] **Step 6: Commit**

```bash
git add fittrack-kb-contract/tools/editorial/build-articles.mjs fittrack-kb-contract/tests/editorial/article-validation.test.mjs scripts/build-wiki-articles.mjs package.json
git commit -m "feat(kb): generer les articles valides"
```

### Task 4: Rédiger et intégrer tout le corpus éditorial

**Files:**
- Create: `fittrack-kb-contract/editorial/articles/method/reading-evidence.md`
- Create: `fittrack-kb-contract/editorial/articles/method/limits-governance.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/chest.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/lats.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/upper-back.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/traps.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/shoulders.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/biceps.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/triceps.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/forearms.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/quads.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/hamstrings.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/glutes.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/adductors.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/calves.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/abs.md`
- Create: `fittrack-kb-contract/editorial/articles/muscles/lower-back.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/horizontal-press.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/vertical-press.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/horizontal-pull.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/vertical-pull.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/squat.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/hinge.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/lunge.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/elbow-isolation.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/shoulder-isolation.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/knee-isolation.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/hip-isolation.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/ankle-isolation.md`
- Create: `fittrack-kb-contract/editorial/articles/movements/wrist-isolation.md`
- Create: `fittrack-kb-contract/editorial/articles/exercise-choice/resistance-profiles.md`
- Create: `fittrack-kb-contract/editorial/articles/exercise-choice/muscle-length-and-rom.md`
- Create: `fittrack-kb-contract/editorial/articles/exercise-choice/stability.md`
- Create: `fittrack-kb-contract/editorial/articles/exercise-choice/substitutions.md`
- Create: `fittrack-kb-contract/editorial/articles/exercise-choice/exercise-families.md`
- Create: `fittrack-kb-contract/editorial/articles/exercise-choice/triceps-extensions.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/red-flags.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/pain-monitoring.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/tendinopathy.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/shoulder.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/elbow-wrist.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/lower-back.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/knee.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/return-to-training.md`
- Create: `fittrack-kb-contract/editorial/articles/clinical/limits.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/method.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/volume.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/frequency.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/intensity-and-repetitions.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/rir-rpe.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/rest.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/rom-and-muscle-length.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/tempo.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/exercise-selection.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/exercise-order.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/progression.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/periodization.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/deload.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/splits.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/fatigue-recovery.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/specialization.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/populations.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/contradictions.md`
- Create: `fittrack-kb-contract/editorial/articles/programming/sources.md`
- Modify: `fittrack-kb-contract/tests/editorial/article-validation.test.mjs`
- Modify: `package.json`
- Regenerate: `src/features/knowledge/wiki-articles.json`

**Interfaces:**
- Consumes: grammaire de Task 2 et validateur de Task 3.
- Produces: toutes les familles navigables et une couverture sans trou.

Le `articleId` est déterministe : `method-<stem>`, `muscle-<stem>`, `movement-<stem>`, `exercise-<stem>`, `clinical-<stem>` ou `programming-<stem>`. Le fichier `triceps-extensions.md` porte donc `exercise-triceps-extensions`, utilisé par le test du résolveur.

Les 13 fichiers de mouvement portent respectivement `poussee_horizontale`, `poussee_verticale`, `tirage_horizontal`, `tirage_vertical`, `squat`, `hinge`, `fente`, `isolation_coude`, `isolation_epaule`, `isolation_genou`, `isolation_hanche`, `isolation_cheville` et `isolation_poignet`. `exercise-triceps-extensions` déclare exactement ces slugs : `skull-crusher`, `cable-triceps-pushdown-rope`, `cable-triceps-pushdown-bar`, `overhead-cable-extension`, `dumbbell-overhead-extension`, `dumbbell-kickback`, `machine-triceps-extension`, `band-triceps-pushdown`. C’est la liaison commune demandée pour les pushdowns et extensions overhead ; aucune variante n’est retrouvée par son nom.

- [ ] **Step 1: Rédiger les articles anatomie, mouvements et choix d’exercice**

Chaque fiche musculaire suit exactement : Résumé ; Anatomie et fonctions ; Mouvements ; Synergistes et stabilisateurs ; Choix d’exercices ; Limites ; Sources. Chaque bloc factuel cite les `claimId` qui portent son texte. Exemple de forme attendue :

```markdown
<!-- fittrack-wiki
{"articleId":"muscle-triceps","title":"Triceps","summary":"Fonctions des trois chefs et conséquences pour les extensions du coude.","family":"muscles","muscleGroups":["triceps"],"movementPatterns":["isolation_coude","poussee_horizontale","poussee_verticale"],"exerciseSlugs":[],"reviewState":"pending_human_review"}
-->
# Triceps
## Résumé
<!-- factual: claim.97d620570f37f665,claim.22282f571ee5e4 -->
Le triceps étend le coude. Son chef long traverse aussi l’épaule, ce qui rend la position du bras pertinente lorsque l’on compare deux extensions du coude.
## Limites
<!-- editorial -->
Cette fiche décrit ce que couvre le corpus ; elle ne transforme pas une différence biomécanique en classement universel des exercices.
```

Les articles de mouvement n’affirment une coopération musculaire que lorsque les claims cités la décrivent. Chaque rôle exploitable depuis un exercice porte `| roles: muscle_a,muscle_b`. Si le corpus ne documente pas un rôle précis, aucun rôle n’est balisé et l’interface renvoie seulement vers la fiche musculaire.

Exemple dans `movements/elbow-isolation.md` :

```markdown
## Muscles qui produisent le mouvement
<!-- factual: claim.67bd353e883b7a38 | roles: triceps -->
Lors d’une extension du coude, le triceps fournit l’action principale documentée par le corpus.
```

- [ ] **Step 2: Rédiger les articles cliniques sans conseil personnalisé**

Chaque fiche clinique conserve les red flags, limites de généralisation et critères de retour présents dans les sources. Aucun bloc ne formule de diagnostic ni de prescription individuelle. Les neuf fichiers cliniques doivent citer l’ensemble des claims issus du document clinique.

- [ ] **Step 3: Transformer les 102 fiches de programmation en Guide**

Les 19 fichiers de programmation reprennent chaque `row:cand.e1.*` exactement une fois, bibliographie comprise, et portent tous :

```json
"reviewState":"pending_human_review"
```

La prose peut relier plusieurs fiches dans un même bloc, mais ne retire ni contradiction, ni population, ni limite présente dans les lignes sources.

- [ ] **Step 4: Remplacer la fixture synthétique par le test du corpus réel**

Le test final doit charger tous les Markdown et affirmer :

```js
assert.equal(bundle.coverage.contexts, 266);
assert.equal(bundle.coverage.merged, 57);
assert.equal(bundle.coverage.readablePassages, 209);
assert.equal(bundle.coverage.claims, 408);
assert.deepEqual(bundle.coverage.uncoveredClaims, []);
assert.equal(bundle.coverage.programmingRows, 102);
assert.deepEqual(bundle.coverage.uncoveredProgrammingRows, []);
```

- [ ] **Step 5: Générer et vérifier le bundle**

Ajouter maintenant à `package.json`, puisque le corpus et l’artefact existent :

```json
"prebuild": "npm run kb:check-articles"
```

Run: `npm run kb:build-articles`

Expected: affiche le nombre d’articles et écrit `wiki-articles.json`.

Run: `npm run kb:check-articles && npm run kb:test:editorial`

Expected: artefact à jour ; tous les tests PASS.

- [ ] **Step 6: Gate de revue humaine**

Exporter la liste `articleId`, `reviewState`, claims et rows vers la sortie du validateur. Une revue humaine peut faire passer un article anatomique/clinique à `reviewed`; aucun article de programmation ne change tant que ses lignes sources n’ont pas été vérifiées une par une. Le commit est autorisé avec les bandeaux `pending_human_review`, jamais avec une promotion implicite.

- [ ] **Step 7: Commit**

```bash
git add fittrack-kb-contract/editorial/articles fittrack-kb-contract/tests/editorial/article-validation.test.mjs src/features/knowledge/wiki-articles.json
git commit -m "feat(kb): rediger le wiki structure"
```

### Task 5: Remplacer l’ancien sommaire par le catalogue éditorial

**Files:**
- Create: `src/features/knowledge/articleTypes.ts`
- Create: `src/features/knowledge/articleCatalogue.ts`
- Create: `src/features/knowledge/articleCatalogue.test.ts`
- Create: `src/features/knowledge/ArticleBody.tsx`
- Create: `src/features/knowledge/WikiArticleScreen.tsx`
- Modify: `src/features/knowledge/KnowledgeScreen.tsx`
- Modify: `src/features/knowledge/WikiBrowse.tsx`
- Modify: `src/features/knowledge/WikiProgrammingScreen.tsx`
- Create: `src/features/knowledge/WikiProgrammingScreen.test.tsx`
- Modify: `src/features/knowledge/routes.tsx`
- Modify: `src/router.tsx`
- Modify: `src/data/types.ts`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `wiki-articles.json` schema `1.0.0-wiki-articles`.
- Produces: `MovementPattern`, `listArticleFamilies`, `findArticle`, `articlesForScope`, `filterArticles`, `articleHref`, routes `/knowledge/a/:articleId` et `/knowledge/programmation/:articleId`.

- [ ] **Step 1: Écrire les tests rouges du catalogue**

```ts
expect(listArticleFamilies().map((family) => family.id)).toEqual([
  'muscles', 'movements', 'exercise-choice', 'programming', 'clinical', 'method',
]);
expect(findArticle('muscle-triceps')?.title).toBe('Triceps');
expect(findArticle('missing')).toBeUndefined();
expect(articlesForScope({ muscleGroups: ['triceps'] }).some((a) => a.articleId === 'muscle-triceps')).toBe(true);
expect(filterArticles([findArticle('muscle-triceps')!], 'chef long')).toHaveLength(1);
expect(filterArticles([findArticle('muscle-triceps')!], 'zirconium')).toEqual([]);
```

Dans `WikiProgrammingScreen.test.tsx`, vérifier que la page liste `Volume`, conserve le bandeau « Non relu », lie l’article vers `/knowledge/programmation/programming-volume` et n’affiche plus les cartes brutes identifiées par `cand.e1.*`.

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/features/knowledge/articleCatalogue.test.ts`

Expected: FAIL sur les modules absents.

- [ ] **Step 3: Ajouter le vocabulaire TypeScript sans migration Dexie**

Dans `src/data/types.ts`, ajouter avant `Exercise` :

```ts
export const MOVEMENT_PATTERNS = [
  'poussee_horizontale', 'poussee_verticale', 'tirage_horizontal', 'tirage_vertical',
  'squat', 'hinge', 'fente', 'isolation_coude', 'isolation_epaule', 'isolation_genou',
  'isolation_hanche', 'isolation_cheville', 'isolation_poignet', 'autre',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];
```

Ajouter ensuite cette propriété dans l’interface `Exercise` existante :

```ts
movementPattern?: MovementPattern;
```

Ne modifier aucun bloc `db.version(...)` : le champ est non indexé et facultatif.

- [ ] **Step 4: Définir les types éditoriaux et l’index profond**

```ts
export type WikiFamily = 'muscles' | 'movements' | 'exercise-choice' | 'programming' | 'clinical' | 'method';
export type WikiReviewState = 'reviewed' | 'pending_human_review';
export type WikiArticleBlock = Readonly<{ blockId: string; text: string; claimIds: string[]; rowIds: string[]; muscleRoles: MuscleGroup[]; editorial: boolean }>;
export type WikiArticle = Readonly<{
  articleId: string; title: string; summary: string; family: WikiFamily;
  muscleGroups: MuscleGroup[]; movementPatterns: MovementPattern[]; exerciseSlugs: string[];
  reviewState: WikiReviewState; sections: ReadonlyArray<{ sectionId: string; title: string; blocks: WikiArticleBlock[] }>;
}>;

export type ArticleScope = Readonly<{
  muscleGroups?: readonly MuscleGroup[];
  movementPatterns?: readonly MovementPattern[];
  exerciseSlugs?: readonly string[];
}>;
```

`articleCatalogue.ts` construit une fois des `Map` par identifiant, muscle, mouvement et slug. `filterArticles` normalise accents et casse, mais ne sélectionne jamais de nouveaux articles hors de l’entrée fournie.

`articleHref(article)` retourne `/knowledge/programmation/${article.articleId}` pour la famille `programming` et `/knowledge/a/${article.articleId}` pour les autres familles. Ainsi les pages du Guide restent sous l’espace Planifier sans dupliquer le composant de lecture.

- [ ] **Step 5: Construire l’UI de lecture et ses états**

`ArticleBody` affiche le bandeau non relu, les sections et les coordonnées de provenance. `WikiArticleScreen` omet proprement un article absent et propose `/knowledge`. `WikiBrowse` met les cinq familles en premier et Méthode à part. `WikiProgrammingScreen` liste les articles `programming` du bundle, conserve le bandeau tant qu’un article reste non relu et ne lit plus directement `f1-programming.json`. La recherche globale existante descend après le sommaire et reste présentée comme raccourci facultatif.

- [ ] **Step 6: Ajouter la route lazy**

```tsx
export const WikiArticleRoute = lazyRoute(
  () => import('./WikiArticleScreen'),
  'WikiArticleScreen',
);
// router.tsx
{ path: 'knowledge/a/:articleId', element: <WikiArticleRoute /> },
{ path: 'knowledge/programmation/:articleId', element: <WikiArticleRoute /> },
```

- [ ] **Step 7: Lancer les tests et le build ciblés**

Run: `npm run test:run -- src/features/knowledge/articleCatalogue.test.ts src/features/knowledge/KnowledgeScreen.test.tsx src/features/knowledge/WikiProgrammingScreen.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: code 0.

- [ ] **Step 8: Commit**

```bash
git add src/features/knowledge src/router.tsx src/data/types.ts src/i18n/fr.ts
git commit -m "feat(kb): naviguer dans les articles structures"
```

### Task 6: Auditer et persister les familles de mouvement du catalogue

**Files:**
- Modify: `src/data/seed/exercises.json`
- Create: `src/data/seed/catalogueMovementAudit.test.ts`
- Modify: `src/data/seed/seedDatabase.ts:1-110`
- Modify: `src/data/seed/seedDatabase.test.ts`
- Modify: `src/data/repositories/backup.test.ts`
- Modify: `src/i18n/fr.ts`
- Modify: `src/i18n/labels.ts`

**Interfaces:**
- Consumes: vocabulaire fermé du contrat KB.
- Produces: décisions catalogue exhaustives, réalignement du seed et `movementPatternLabel`.

- [ ] **Step 1: Écrire les tests rouges du vocabulaire et du catalogue**

```ts
expect(MOVEMENT_PATTERNS).toEqual([
  'poussee_horizontale', 'poussee_verticale', 'tirage_horizontal', 'tirage_vertical',
  'squat', 'hinge', 'fente', 'isolation_coude', 'isolation_epaule', 'isolation_genou',
  'isolation_hanche', 'isolation_cheville', 'isolation_poignet', 'autre',
]);
for (const row of catalogue) {
  expect(row).toHaveProperty('movementPattern');
  expect(row.movementPattern === null || MOVEMENT_PATTERNS.includes(row.movementPattern)).toBe(true);
}
```

Le JSON utilise `null` pour une décision explicite « non classé honnêtement » ; le seed convertit `null` en absence du champ persisté.

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/data/seed/catalogueMovementAudit.test.ts`

Expected: FAIL, export et propriétés absents.

- [ ] **Step 3: Taper la décision `null` du catalogue sans la persister**

Dans `seedDatabase.ts`, typer la source JSON séparément du modèle persisté :

```ts
type CatalogueSourceExercise = Omit<CatalogueExercise, 'movementPattern'> & {
  movementPattern: MovementPattern | null;
};
const SOURCE_CATALOGUE = catalogue as CatalogueSourceExercise[];
const CATALOGUE: CatalogueExercise[] = SOURCE_CATALOGUE.map(({ movementPattern, ...entry }) =>
  movementPattern === null ? entry : { ...entry, movementPattern },
);
```

- [ ] **Step 4: Auditer les 175 slugs du catalogue**

Ajouter `movementPattern` à chaque ligne de `exercises.json`. Une valeur vient d’une décision éditoriale relue ; `null` est réservé aux exercices cardio, étirements ou mouvements que les 14 termes ne décrivent pas honnêtement. Aucun script ne déduit la valeur depuis `name`.

- [ ] **Step 5: Réaligner uniquement les exercices livrés**

Étendre `reconcileShippedMetadata` pour comparer et appliquer `movementPattern`. Pour une entrée `null`, supprimer le champ avec une copie avant `touch`; pour un exercice personnel (`isCustom: 1` ou sans slug), ne rien écrire. Ajouter les deux tests : correction d’un mouvement catalogue dérivé et conservation du mouvement personnalisé.

Ajouter un round-trip dans `src/data/repositories/backup.test.ts` pour prouver qu’une famille choisie sur un exercice personnel survit à l’export et à la restauration ; une ancienne sauvegarde sans le champ reste valide sans backfill.

- [ ] **Step 6: Ajouter les libellés exhaustifs**

```ts
export const movementPatternLabel = (pattern: MovementPattern): string =>
  t(`movementPattern.${pattern}`);
```

Les 14 clés françaises reprennent les labels de `movement-pattern.vocab.json`.

- [ ] **Step 7: Vérifier**

Run: `npm run test:run -- src/data/seed/catalogueMovementAudit.test.ts src/data/seed/seedDatabase.test.ts src/data/repositories/backup.test.ts src/i18n/labels.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/data/seed/exercises.json src/data/seed/catalogueMovementAudit.test.ts src/data/seed/seedDatabase.ts src/data/seed/seedDatabase.test.ts src/data/repositories/backup.test.ts src/i18n/fr.ts src/i18n/labels.ts
git commit -m "feat(exercises): declarer les familles de mouvement"
```

### Task 7: Construire le résolveur documentaire pur

**Files:**
- Create: `src/features/knowledge/exerciseDocumentation.ts`
- Create: `src/features/knowledge/exerciseDocumentation.test.ts`

**Interfaces:**
- Consumes: `DocumentationExercise` et `articleCatalogue`.
- Produces: `getDocumentationForExercise(exercise): ExerciseDocumentation`.

- [ ] **Step 1: Écrire les sept tests rouges du design**

```ts
const catalogueExercise: DocumentationExercise = { primaryMuscle: 'triceps', secondaryMuscles: ['shoulders'], movementPattern: 'isolation_coude', slug: 'cable-triceps-pushdown-rope' };
expect(getDocumentationForExercise(catalogueExercise).articleIds).toEqual([
  'muscle-triceps', 'movement-elbow-isolation', 'exercise-triceps-extensions', 'muscle-shoulders',
]);

const custom: DocumentationExercise = { primaryMuscle: 'triceps', secondaryMuscles: ['shoulders'] };
expect(getDocumentationForExercise(custom).relationship).toBeNull();
expect(getDocumentationForExercise({ ...custom, movementPattern: 'isolation_coude' }).relationship?.articleId).toBe('movement-elbow-isolation');
const renamedExercise = { ...catalogueExercise, name: 'Nom changé' };
expect(getDocumentationForExercise(renamedExercise)).toEqual(getDocumentationForExercise(catalogueExercise));
```

Compléter avec : secondaire sans rôle documenté → lien seulement ; déduplication ; ordre stable ; slug absent → aucun article spécifique.

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/features/knowledge/exerciseDocumentation.test.ts`

Expected: FAIL sur le module absent.

- [ ] **Step 3: Implémenter l’interface profonde**

```ts
export type DocumentationExercise = Pick<
  Exercise,
  'primaryMuscle' | 'secondaryMuscles' | 'movementPattern' | 'slug'
>;

export type ExerciseDocumentation = Readonly<{
  primary: WikiArticle | null;
  relationship: WikiArticle | null;
  specific: WikiArticle[];
  secondary: ReadonlyArray<{ muscle: MuscleGroup; article: WikiArticle | null; roleText: string | null }>;
  articleIds: string[];
  limitations: ExerciseDocumentationLimit[];
}>;

export type ExerciseDocumentationLimit =
  | 'primary_article_missing'
  | 'movement_pattern_missing'
  | 'movement_article_missing';

const firstFamily = (scope: ArticleScope, family: WikiFamily): WikiArticle | null =>
  articlesForScope(scope).find((article) => article.family === family) ?? null;

const uniqueArticles = (articles: ReadonlyArray<WikiArticle | null>): WikiArticle[] => {
  const byId = new Map<string, WikiArticle>();
  for (const article of articles) if (article !== null) byId.set(article.articleId, article);
  return [...byId.values()];
};

export function getDocumentationForExercise(exercise: DocumentationExercise): ExerciseDocumentation {
  const primary = firstFamily({ muscleGroups: [exercise.primaryMuscle] }, 'muscles');
  const relationship =
    exercise.movementPattern === undefined
      ? null
      : firstFamily({ movementPatterns: [exercise.movementPattern] }, 'movements');
  const specific =
    exercise.slug === undefined ? [] : articlesForScope({ exerciseSlugs: [exercise.slug] });
  const secondary = exercise.secondaryMuscles
    .filter((muscle) => muscle !== exercise.primaryMuscle)
    .map((muscle) => {
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
  const ordered = uniqueArticles([
    primary,
    relationship,
    ...specific,
    ...secondary.map((item) => item.article),
  ]);
  const limitations: ExerciseDocumentationLimit[] = [];
  if (primary === null) limitations.push('primary_article_missing');
  if (exercise.movementPattern === undefined) limitations.push('movement_pattern_missing');
  else if (relationship === null) limitations.push('movement_article_missing');
  return { primary, relationship, specific, secondary, articleIds: ordered.map((article) => article.articleId), limitations };
}
```

La relation d’un secondaire est lue uniquement dans les blocs sourcés dont `muscleRoles` contient ce muscle ; si aucun bloc ne le porte, `roleText` vaut `null`. Dédupliquer par `articleId`, jamais par titre.

- [ ] **Step 4: Lancer les tests**

Run: `npm run test:run -- src/features/knowledge/exerciseDocumentation.test.ts`

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/knowledge/exerciseDocumentation.ts src/features/knowledge/exerciseDocumentation.test.ts
git commit -m "feat(kb): resoudre la documentation des exercices"
```

### Task 8: Permettre la famille facultative sur un exercice personnel

**Files:**
- Modify: `src/features/exercises/ExerciseFormScreen.tsx:21-191`
- Modify: `src/features/exercises/ExerciseFormScreen.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `MOVEMENT_PATTERNS`, `MovementPattern`, `movementPatternLabel`.
- Produces: création et édition de `Exercise.movementPattern` sans toucher au nom.

- [ ] **Step 1: Écrire les tests rouges du formulaire**

Tester : champ « Famille de mouvement » affiché ; valeur vide acceptée ; choix « Isolation du coude » persisté ; suppression ultérieure persistée ; renommage sans changement de famille.

```ts
await user.click(screen.getByRole('button', { name: /Famille de mouvement/ }));
await user.click(screen.getByRole('option', { name: 'Isolation du coude' }));
await user.click(screen.getByRole('button', { name: 'Créer l’exercice' }));
expect((await listExercises({ search: 'Extension maison' }))[0]?.movementPattern).toBe('isolation_coude');
```

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/features/exercises/ExerciseFormScreen.test.tsx`

Expected: FAIL, contrôle absent.

- [ ] **Step 3: Étendre le draft et le picker**

Ajouter `movementPattern?: MovementPattern` à `Draft`, `movement` à `Field`, puis :

```tsx
<PickerRow
  label={t('exerciseForm.movementPatternLabel')}
  value={draft.movementPattern === undefined ? t('exerciseForm.movementPatternNone') : movementPatternLabel(draft.movementPattern)}
  onOpen={() => setPicker('movement')}
/>
<OptionSheet<MovementPattern | ''>
  open={picker === 'movement'}
  onClose={() => setPicker(null)}
  title={t('exerciseForm.movementPatternLabel')}
  options={[{ value: '', label: t('exerciseForm.movementPatternNone') }, ...MOVEMENT_OPTIONS]}
  value={draft.movementPattern ?? ''}
  onSelect={(value) => setDraft({ ...draft, movementPattern: value === '' ? undefined : value })}
/>
```

Inclure `movementPattern` dans `base`; pour la suppression en édition, transmettre explicitement `movementPattern: undefined`.

- [ ] **Step 4: Lancer les tests**

Run: `npm run test:run -- src/features/exercises/ExerciseFormScreen.test.tsx src/data/repositories/exercises.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/exercises/ExerciseFormScreen.tsx src/features/exercises/ExerciseFormScreen.test.tsx src/i18n/fr.ts
git commit -m "feat(exercises): choisir une famille de mouvement"
```

### Task 9: Ajouter la vue Documentation à la fiche exercice

**Files:**
- Create: `src/features/exercises/ExerciseDocumentationView.tsx`
- Create: `src/features/exercises/ExerciseDocumentationView.test.tsx`
- Modify: `src/features/exercises/ExerciseDetailScreen.tsx`
- Modify: `src/features/exercises/ExerciseDetailScreen.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `getDocumentationForExercise`, `ArticleBody`, `filterArticles`.
- Produces: onglets Suivi / Documentation et filtre limité à la projection.

- [ ] **Step 1: Écrire les tests rouges de la projection**

Tester : Suivi actif par défaut ; Documentation affiche muscle principal puis mouvement puis spécifique ; exercice personnel sans mouvement montre la limite ; filtre sans résultat conserve le bouton d’effacement ; aucun appel à `searchEvidence`.

```tsx
await user.click(screen.getByRole('tab', { name: 'Documentation' }));
expect(screen.getByRole('heading', { name: 'Triceps' })).toBeVisible();
expect(screen.getByText(/Aucune relation de mouvement n’est déclarée/)).toBeVisible();
expect(searchEvidence).not.toHaveBeenCalled();
```

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/features/exercises/ExerciseDocumentationView.test.tsx src/features/exercises/ExerciseDetailScreen.test.tsx`

Expected: FAIL, vue et onglet absents.

- [ ] **Step 3: Implémenter la vue isolée**

`ExerciseDocumentationView` calcule la projection une seule fois, construit son sommaire, puis filtre seulement `documentation.articleIds`. Un article absent rend un bloc `role="status"` renvoyant vers `/knowledge`; aucun écran blanc n’est possible.

- [ ] **Step 4: Intégrer les tabs sans charger les queries Suivi inutilement**

Ajouter un état `view: 'tracking' | 'documentation'`. Les deux boutons portent `role="tab"`, `aria-selected` et une hauteur minimale de 48 px. Le footer « Terminé » reste commun. La documentation s’affiche dès que `exercise` est chargé ; les records, séances et coach ne bloquent que Suivi.

- [ ] **Step 5: Lancer les tests**

Run: `npm run test:run -- src/features/exercises/ExerciseDocumentationView.test.tsx src/features/exercises/ExerciseDetailScreen.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: code 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/exercises/ExerciseDocumentationView.tsx src/features/exercises/ExerciseDocumentationView.test.tsx src/features/exercises/ExerciseDetailScreen.tsx src/features/exercises/ExerciseDetailScreen.test.tsx src/i18n/fr.ts
git commit -m "feat(exercises): afficher la documentation reliee"
```

### Task 10: Réunir Routines, Programmes et Guide dans Planifier

**Files:**
- Create: `src/features/planning/PlanningTabs.tsx`
- Create: `src/features/planning/PlanningTabs.test.tsx`
- Create: `src/features/knowledge/ProgrammingGuideEntry.tsx`
- Modify: `src/app/BottomNav.tsx`
- Create: `src/app/BottomNav.test.tsx`
- Modify: `src/features/routines/RoutinesScreen.tsx`
- Modify: `src/features/programs/ProgramListScreen.tsx`
- Modify: `src/features/knowledge/WikiProgrammingScreen.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: routes canoniques existantes.
- Produces: navigation partagée et CTA `/programs/new` sans écriture directe.

- [ ] **Step 1: Écrire les tests rouges de navigation**

```tsx
expect(screen.getByRole('link', { name: 'Planifier' })).toHaveAttribute('href', '#/routines');
// Sur /programs et /knowledge/programmation, le même onglet porte l’état actif.
expect(screen.getByRole('link', { name: 'Planifier' })).toHaveAttribute('aria-current', 'page');
expect(screen.getByRole('link', { name: 'Mettre en pratique' })).toHaveAttribute('href', '#/programs/new');
```

Tester aussi que les trois onglets internes pointent exactement vers `/routines`, `/programs`, `/knowledge/programmation` et qu’aucun nouveau type Programme n’est importé par `ProgrammingGuideEntry`.

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/app/BottomNav.test.tsx src/features/planning/PlanningTabs.test.tsx`

Expected: FAIL, composants absents et libellé encore « Routines ».

- [ ] **Step 3: Implémenter l’activité groupée de la barre basse**

Remplacer le `NavLink` Planifier par un `Link` utilisant `useLocation()` et :

```ts
export const isPlanningPath = (pathname: string): boolean =>
  pathname.startsWith('/routines') ||
  pathname.startsWith('/programs') ||
  pathname.startsWith('/knowledge/programmation');
```

Toucher l’onglet navigue toujours vers `/routines`; l’indicateur actif utilise `isPlanningPath`.

- [ ] **Step 4: Implémenter `PlanningTabs`**

Rendre trois liens de 48 px minimum, avec `aria-current="page"` sur la route active. Monter le composant en tête de `RoutinesScreen`, `ProgramListScreen` et `WikiProgrammingScreen`.

- [ ] **Step 5: Ajouter le CTA du Guide**

```tsx
<Link to="/programs/new" className="flex min-h-12 items-center justify-center rounded-xl ...">
  {t('planning.applyGuide')}
</Link>
```

Le composant n’importe ni `db`, ni repository Program, ni type de brouillon.

- [ ] **Step 6: Lancer les tests**

Run: `npm run test:run -- src/app/BottomNav.test.tsx src/features/planning/PlanningTabs.test.tsx src/features/programs/ProgramFlow.integration.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/BottomNav.tsx src/app/BottomNav.test.tsx src/features/planning src/features/knowledge/ProgrammingGuideEntry.tsx src/features/knowledge/WikiProgrammingScreen.tsx src/features/routines/RoutinesScreen.tsx src/features/programs/ProgramListScreen.tsx src/i18n/fr.ts
git commit -m "feat(planning): reunir routines programmes et guide"
```

### Task 11: Modéliser le repli et le verrou de bibliothèque

**Files:**
- Create: `src/stores/routineLibraryView.ts`
- Create: `src/stores/routineLibraryView.test.ts`
- Modify: `src/ui/OrderLockButton.tsx`
- Modify: `src/ui/OrderLockButton.test.tsx`

**Interfaces:**
- Consumes: identifiants `root` et `RoutineFolder.id`.
- Produces: store non persisté et bouton à libellés configurables.

- [ ] **Step 1: Écrire les tests rouges de la machine d’état**

```ts
const store = useRoutineLibraryView.getState();
store.toggleFolder('folder-a');
expect(useRoutineLibraryView.getState().collapsedFolderIds).toEqual(new Set(['folder-a']));
store.setReorderUnlocked(true);
expect(useRoutineLibraryView.getState().collapsedFolderIds.size).toBe(0);
expect(useRoutineLibraryView.getState().rememberedCollapsedFolderIds).toEqual(new Set(['folder-a']));
store.toggleFolder('folder-b');
expect(useRoutineLibraryView.getState().collapsedFolderIds.size).toBe(0);
store.setReorderUnlocked(false);
expect(useRoutineLibraryView.getState().collapsedFolderIds).toEqual(new Set(['folder-a']));
```

Tester aussi `collapseAll(['root','folder-a'])`, `expandAll()`, `reset()` et l’indépendance de `useExerciseOrderLock`.

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/stores/routineLibraryView.test.ts`

Expected: FAIL, store absent.

- [ ] **Step 3: Implémenter le store non persisté**

```ts
type RoutineLibraryViewState = {
  reorderUnlocked: boolean;
  collapsedFolderIds: Set<string>;
  rememberedCollapsedFolderIds: Set<string>;
  toggleFolder: (id: string) => void;
  collapseAll: (ids: readonly string[]) => void;
  expandAll: () => void;
  setReorderUnlocked: (unlocked: boolean) => void;
  reset: () => void;
};

const emptyIds = (): Set<string> => new Set<string>();

export const useRoutineLibraryView = create<RoutineLibraryViewState>((set) => ({
  reorderUnlocked: false,
  collapsedFolderIds: emptyIds(),
  rememberedCollapsedFolderIds: emptyIds(),
  toggleFolder: (id) =>
    set((state) => {
      if (state.reorderUnlocked) return state;
      const next = new Set(state.collapsedFolderIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedFolderIds: next };
    }),
  collapseAll: (ids) =>
    set((state) => (state.reorderUnlocked ? state : { collapsedFolderIds: new Set(ids) })),
  expandAll: () =>
    set((state) => (state.reorderUnlocked ? state : { collapsedFolderIds: emptyIds() })),
  setReorderUnlocked: (unlocked) =>
    set((state) => {
      if (state.reorderUnlocked === unlocked) return state;
      return unlocked
        ? {
            reorderUnlocked: true,
            rememberedCollapsedFolderIds: new Set(state.collapsedFolderIds),
            collapsedFolderIds: emptyIds(),
          }
        : {
            reorderUnlocked: false,
            collapsedFolderIds: new Set(state.rememberedCollapsedFolderIds),
            rememberedCollapsedFolderIds: emptyIds(),
          };
    }),
  reset: () =>
    set({
      reorderUnlocked: false,
      collapsedFolderIds: emptyIds(),
      rememberedCollapsedFolderIds: emptyIds(),
    }),
}));
```

Chaque mutation crée un nouveau `Set`. Quand `reorderUnlocked` vaut `true`, `toggleFolder` et `collapseAll` sont des no-op. Aucun middleware `persist` n’est utilisé.

- [ ] **Step 4: Rendre `OrderLockButton` réutilisable**

```ts
type Props = {
  unlocked: boolean;
  onToggle: () => void;
  unlockLabel?: string;
  lockLabel?: string;
};
```

Les appels existants gardent les clés `common.*`; la bibliothèque fournit exactement « Déverrouiller l'ordre des routines » et « Verrouiller l'ordre des routines » depuis `fr.ts`.

- [ ] **Step 5: Lancer les tests**

Run: `npm run test:run -- src/stores/routineLibraryView.test.ts src/ui/OrderLockButton.test.tsx src/stores/exerciseOrderLock.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/routineLibraryView.ts src/stores/routineLibraryView.test.ts src/ui/OrderLockButton.tsx src/ui/OrderLockButton.test.tsx src/i18n/fr.ts
git commit -m "feat(routines): modeliser le repli verrouille"
```

### Task 12: Intégrer dossiers repliables et drag verrouillé

**Files:**
- Modify: `src/features/routines/RoutineCollection.tsx`
- Modify: `src/features/routines/RoutineCollection.test.tsx`
- Modify: `src/features/routines/RoutinesScreen.tsx`
- Modify: `src/features/routines/RoutineFlow.integration.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `useRoutineLibraryView`, `OrderLockButton`, `ReorderableList disabled`.
- Produces: repli accessible et placement complet uniquement en mode déverrouillé.

- [ ] **Step 1: Écrire les tests rouges du composant**

Ajouter aux props de `RoutineCollection` :

```ts
collapsedFolderIds: ReadonlySet<string>;
reorderUnlocked: boolean;
onToggleFolder: (folderId: string) => void;
```

Tester : compteur dans chaque en-tête ; `aria-expanded`; routine masquée après repli ; bouton désactivé pendant le réordonnancement ; aucune poignée lorsque verrouillé ; flèche clavier sans intention ; placement complet lors d’un déplacement entre dossiers.

- [ ] **Step 2: Exécuter et constater l’échec**

Run: `npm run test:run -- src/features/routines/RoutineCollection.test.tsx`

Expected: FAIL sur les nouvelles props et attentes.

- [ ] **Step 3: Séparer projection complète et projection visible**

```ts
const allEntries = projectEntries(summaries, folders);
const visibleEntries = reorderUnlocked
  ? allEntries
  : allEntries.filter((entry) => entry.kind === 'heading' || !collapsedFolderIds.has(entry.folderId));
```

Étendre `Entry` routine avec son `folderId`. Quand `reorderUnlocked`, utiliser `allEntries` et `projectPlacement(allEntries)` ; sinon `ReorderableList` reçoit `disabled` et les poignées ne sont pas rendues. Ne jamais calculer un placement à partir de `visibleEntries`.

- [ ] **Step 4: Rendre les en-têtes accessibles**

Chaque en-tête contient un bouton de 48 px avec `aria-expanded={!collapsed}`, le nom et le nombre de routines. Le menu dossier reste un bouton distinct. Le repli racine utilise l’identifiant littéral `root`.

- [ ] **Step 5: Monter les commandes dans `RoutinesScreen`**

Afficher `PlanningTabs`, `OrderLockButton` et une commande dont le libellé alterne « Tout replier » / « Tout déplier ». `setReorderUnlocked(true)` mémorise puis ouvre tout ; le relock restaure. Le repository n’est appelé que pour `reorderRoutines`, jamais pour un repli.

- [ ] **Step 6: Vérifier l’intégration repository**

Dans `RoutineFlow.integration.test.tsx`, déverrouiller, déplacer une routine racine après l’en-tête d’un dossier, attendre `useLiveQuery`, puis vérifier `folderId` et les ordres de toutes les routines via `listRoutineSummaries()`.

- [ ] **Step 7: Lancer les tests**

Run: `npm run test:run -- src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutineFlow.integration.test.tsx src/ui/ReorderableList.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/routines/RoutineCollection.tsx src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutinesScreen.tsx src/features/routines/RoutineFlow.integration.test.tsx src/i18n/fr.ts
git commit -m "feat(routines): replier et verrouiller la bibliotheque"
```

### Task 13: Vérification complète, téléphone et livraison

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: toutes les tâches précédentes.
- Produces: branche vérifiée et checkpoint manuel consigné.

- [ ] **Step 1: Vérifier le contrat éditorial et l’artefact**

Run: `npm run kb:check-articles && npm run kb:test:editorial`

Expected: artefact à jour ; couverture 266/57/209/408 et 102/102 ; tous les tests PASS.

- [ ] **Step 2: Vérifier l’application**

Run: `npm run lint`

Expected: code 0.

Run: `npm run typecheck`

Expected: code 0.

Run: `npm run test:run`

Expected: toutes les suites PASS.

Run: `npm run build`

Expected: build Vite terminé ; `prebuild` confirme que le bundle wiki est à jour.

Run: `git diff --check`

Expected: aucune sortie, code 0.

- [ ] **Step 3: Exécuter les huit checkpoints téléphone**

1. Exercice catalogue : Suivi / Documentation, texte hors ligne et relation pertinente.
2. Exercice personnel sans puis avec famille : aucun lien par nom, relation ajoutée seulement après choix.
3. Planifier : Routines / Programmes / Guide clairement séparés.
4. Guide : « Mettre en pratique » ouvre `/programs/new`.
5. Dossiers : repli sans perte d’ordre.
6. Déverrouillage : ouverture de tous les dossiers, déplacement inter-dossiers, restauration du repli.
7. Force-close : cadenas fermé, dossiers dépliés, routines intactes.
8. Mode avion : Documentation et Guide restent entièrement lisibles.

- [ ] **Step 4: Mettre à jour `PROGRESS.md`**

Consigner les commandes et compteurs exacts, le commit testé, le résultat de chaque checkpoint, les articles encore `pending_human_review` et toute lacune de documentation signalée par le validateur.

- [ ] **Step 5: Commit final de session**

```bash
git add PROGRESS.md
git commit -m "docs: consigner le wiki et planifier"
```

## Definition of done

- Le build échoue si un Markdown, une source, un muscle, un mouvement ou un slug est invalide, ou si le JSON généré dérive.
- Les 408 claims et 102 fiches ont une couverture explicite ; les compteurs 266 → 209 et 57 fusions restent vérifiés.
- Un exercice personnel sans mouvement reçoit uniquement la documentation musculaire ; son nom n’influence jamais la projection.
- Le Guide reste en lecture seule et `/programs/new` reste l’unique entrée de création de programme.
- La bibliothèque masque réellement les poignées et désactive pointeur et clavier lorsqu’elle est verrouillée.
- Tous les tests, lint, typecheck et build passent, puis les huit checkpoints téléphone sont consignés.
