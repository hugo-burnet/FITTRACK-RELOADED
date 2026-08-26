# Format des articles du wiki

> Lu par `tools/editorial/article-format.mjs`. Ce document et ce parseur décrivent la même
> grammaire ; s'ils divergent, c'est le parseur qui a raison et ce fichier qui est en retard.

Les fichiers de `editorial/articles/**/*.md` sont **l'artefact canonique** du wiki.
`src/features/knowledge/wiki-articles.json` en est la projection générée, jamais éditée à la main.

## Pourquoi une grammaire, et pas du Markdown libre

Le 2026-08-26, la mesure a tranché : ni BM25, ni les embeddings, ni un cross-encoder ne savent
décider quel passage du corpus répond à une question, et aucun seuil de refus n'est calibrable sur
leurs scores. Le rattachement d'un contenu à un muscle, à une famille de mouvement ou à un exercice
**redevient déclaré**. La grammaire ci-dessous existe pour que cette déclaration soit obligatoire,
vérifiable au build, et impossible à oublier en silence.

## Squelette d'un fichier

```markdown
<!-- fittrack-wiki
{"articleId":"muscle-triceps","title":"Triceps","summary":"…","family":"muscles","muscleGroups":["triceps"],"movementPatterns":[],"exerciseSlugs":[],"reviewState":"reviewed"}
-->
# Triceps

## Anatomie et fonctions

<!-- factual: claim.97d620570f37f665 | roles: triceps -->
Le chef long traverse aussi l'épaule, ce qui le rend
sensible à la position du bras.

<!-- editorial -->
Cette distinction organise la suite de la fiche.
```

## En-tête `fittrack-wiki`

Un commentaire HTML ouvrant le fichier, contenant **un objet JSON sur une seule ligne**.
Absent : `MISSING_HEADER`. Illisible : `INVALID_HEADER`.

| Champ | Rôle |
|---|---|
| `articleId` | Identifiant stable et unique du bundle. Ne change jamais après publication. |
| `title` | Titre affiché. |
| `summary` | Une phrase, affichée dans les listes et le sommaire. |
| `family` | `muscles`, `movements`, `exercise-choice`, `programming`, `clinical` ou `method`. |
| `muscleGroups` | Portée musculaire, dans le vocabulaire de `MUSCLE_GROUPS` (`src/data/types.ts`). |
| `movementPatterns` | Portée de mouvement, dans `vocabularies/movement-pattern.vocab.json`. |
| `exerciseSlugs` | Portée par exercice du catalogue. **Le `slug`, jamais le nom ni l'UUID.** |
| `reviewState` | `reviewed` ou `pending_human_review`. |

Le titre `# ` qui suit duplique `title` : il rend le fichier lisible dans un éditeur et n'entre pas
dans la structure exportée.

## Sections

`## Titre` ouvre une section. Les sections sont ordonnées et reçoivent un `sectionId` dérivé de
`articleId` et de leur rang. Un bloc rencontré avant la première section échoue : `BLOCK_OUTSIDE_SECTION`.

## Blocs

Un bloc est **une annotation suivie d'un paragraphe**. Une ligne vide ferme le bloc.

Les lignes d'un même paragraphe sont recollées avec une espace : l'enroulement à 100 colonnes est
une commodité d'écriture, pas une structure. C'est aussi pourquoi **la ligne vide est obligatoire**
entre deux blocs — sans elle, un paragraphe qui a perdu son annotation se recolle silencieusement au
précédent, qui est sourcé, et le trou de provenance devient invisible.

### `<!-- factual: … -->`

Porte une ou plusieurs sources, séparées par des virgules :

- `claim.xxxxxxxx` — une affirmation de `src/features/knowledge/evidence-index.json` ;
- `row:cand.e1.xxxxxxxx` — une ligne de fiche de `src/features/knowledge/f1-programming.json`.

**Un bloc factuel sans au moins un `claim.*` ou un `row:cand.*` est interdit.** Le validateur le
rejette en `UNKNOWN_CLAIM` : une source vide n'est pas une source.

Citer un `row:cand.*` force l'article à rester `pending_human_review` — les 102 fiches de
programmation n'ont pas été relues par un humain, et aucun remaniement éditorial ne vaut relecture.

Suffixe facultatif `| roles: muscle1, muscle2` : les muscles dont ce bloc documente le rôle. C'est
**la seule donnée** qui autorise le résolveur à expliquer la coopération d'un muscle secondaire ;
sans elle il donne le lien vers la fiche et n'invente aucune relation mécanique. Réservé aux
articles de famille `movements` (sinon `ROLE_OUTSIDE_MOVEMENT`), et limité au vocabulaire
`MUSCLE_GROUPS`.

### `<!-- editorial -->`

Le bloc introduit, relie ou résume la structure. Il **ne porte aucune affirmation scientifique
nouvelle** — cette règle est éditoriale, elle n'est pas vérifiable par machine, et c'est la seule
du document dans ce cas.

### Ce qui échoue

| Code | Cause |
|---|---|
| `MISSING_HEADER` | Le fichier ne commence pas par `<!-- fittrack-wiki`. |
| `INVALID_HEADER` | JSON de l'en-tête illisible. |
| `BLOCK_OUTSIDE_SECTION` | Un paragraphe avant le premier `## `. |
| `UNSOURCED_BLOCK` | Un paragraphe sans `factual` ni `editorial` devant lui. |
| `UNKNOWN_ANNOTATION` | Un commentaire HTML qui n'est ni l'en-tête, ni `factual`, ni `editorial`. Sans ce refus, une annotation mal orthographiée s'afficherait telle quelle dans l'application. |

## Vérifier

```bash
npm --prefix fittrack-kb-contract run test:editorial
```
