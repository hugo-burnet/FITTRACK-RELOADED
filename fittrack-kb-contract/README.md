# FitTrack — Contrat technique de la Knowledge Base

Phase 2 : le contrat exécutable de la KB, avant l'écriture de l'extracteur.

## Lancer les validations

```bash
npm install
npm run validate
```

Résultat attendu, à jour :

```text
  ok  1. Syntaxe JSON : 99 fichiers JSON analysés, 0 erreur
  ok  2. Schemas : 47 schemas compilés, tous les $ref résolus localement
  ok  3. Vocabulaires : 29 vocabulaires, enums et fichiers cohérents avec la source
  ok  4. Fixtures valides : 208 instances validées contre leur schéma
  ok  5. Fixtures invalides : 20 cas rejetés pour la raison attendue
  ok  6. INV-001 à INV-015 : 15 invariants exécutés, 0 échec
```

## Régénérer les artefacts dérivés

```bash
npm run build
```

Cela relance trois générateurs. Ce qui est dérivable n'est jamais saisi à la main : c'est le seul moyen
d'empêcher un schéma et un vocabulaire, ou un offset et un texte, de diverger en silence.

| Générateur | Produit |
|---|---|
| `tools/make-fragments.mjs` | empreinte du corpus, fragments avec offsets vérifiés par relecture |
| `tools/build-vocabularies.mjs` | 29 fichiers de vocabulaire + les enums de `vocab.schema.json` |
| `tools/build-derived.mjs` | fixtures de provenance, `contentHash`, registre d'identifiants |

## Le corpus n'est pas dans ce paquet

Les quatre fichiers de recherche restent l'autorité et vivent hors du contrat.
`corpus/corpus-files.config.json` en donne les chemins candidats et le hash attendu.

Le paquet conserve leur **empreinte** et le **texte brut des 77 fragments réellement cités**, sans quoi
aucune provenance ne serait vérifiable. Il ne contient pas les fichiers complets.

Si le corpus a bougé, adapter `candidatePaths`. Si son contenu a changé, `make-fragments.mjs` refuse de
régénérer et l'explique : régénérer en silence produirait des fragments valides pointant vers un texte
différent, et personne ne s'en apercevrait.

## Où regarder en premier

| Question | Fichier |
|---|---|
| Pourquoi ce modèle plutôt qu'un autre | `ARCHITECTURE.md` |
| Comment fonctionnent les identifiants | `ID_POLICY.md` |
| Quelles versions, et laquelle bouge quand | `VERSIONING.md` |
| Qui relit quoi, et ce qui va en revue humaine | `REVIEW_WORKFLOW.md` |
| Ce que l'extracteur devra produire | `extraction-contract/README.md` |
| Ce qui a été réellement vérifié | `VALIDATION_REPORT.md` |
| Ce qui n'est pas vérifié, et pourquoi | `tests/acceptance-criteria.md` |
| Migration du schéma clinique existant | `mappings/clinical-schema-migration.md` |

## Ce que contient le golden set

208 instances, toutes issues des quatre fichiers du corpus.

| | |
|---|---|
| Claims | 15, dont 2 paires issues d'un même fragment |
| Sources | 10, dont 1 partielle et 2 en conflit d'attribution non résolu |
| Évaluations de preuve | 6, dont 2 historiques sur la même claim |
| Conflits / lacunes | 2 / 2 |
| Exercices / variantes / substitutions | 5 / 5 / 3 |
| Observations de charge articulaire | 3, couvrant 3 des 4 catégories |
| Conditions / red flags / zones | 2 / 4 / 3 |
| Politiques produit | 2 `ProductSafetyPolicy` + 1 `OutputPolicy` |
| Observations runtime | 7, clairement séparées de la KB |
| Fragments et fichiers de corpus | 77 / 4, avec offsets vérifiés |

Il est **destiné à la revue humaine, pas à la consommation par un coach**. Plusieurs entités portent des
rattachements provisoires explicitement signalés en `unknownFields` avec la raison `pending_human_review` :
le corpus cite bien plus de références que ce golden set restreint n'en modélise, et dire ce qui manque
vaut mieux que rattacher une affirmation à une source approximative.

## Les trois espaces

```text
KB      : quelles dimensions faut-il observer, et comment les interpréter prudemment ?
POLICY  : quelle conduite conservatrice FitTrack applique-t-il ?
RUNTIME : que rapporte cet utilisateur, à cette date, avec cette charge ?
```

Une politique FitTrack n'est jamais présentée comme une vérité scientifique ou médicale, et le schéma la
refuse si elle essaie.

## Avertissement

Cette KB aide à **adapter une exposition**, jamais à poser ou exclure un diagnostic. Elle ne remplace ni un
médecin ni un kinésithérapeute, ne doit jamais contredire un protocole postopératoire, et ne doit pas
retarder une prise en charge urgente. Tout red flag prévaut sur le coaching.
