# Critères d'acceptation

Un critère est **atteint** seulement si une commande le vérifie. Les critères qui ne peuvent pas encore être
vérifiés sont listés à part, sans être présentés comme atteints.

```bash
npm run validate
```

## A. Structure et syntaxe

| # | Critère | Vérifié par | État |
|---|---|---|---|
| A1 | Tous les fichiers JSON du paquet sont syntaxiquement valides | validate.mjs étape 1 | atteint |
| A2 | Tous les schemas déclarent un `$id` unique et compilent en draft 2020-12 | validate.mjs étape 2 | atteint |
| A3 | Tous les `$ref` résolvent localement, sans accès réseau | validate.mjs étape 2 | atteint |
| A4 | Chaque `kind` de fixture correspond à une entrée du catalogue d'entités | validate.mjs étape 4 | atteint |

## B. Vocabulaires

| # | Critère | Vérifié par | État |
|---|---|---|---|
| B1 | Chaque vocabulaire déclare son origine : corpus, schéma clinique existant, ou décision de modélisation | `vocabulary-file.schema.json` | atteint |
| B2 | Tout terme déclaré issu du corpus porte une référence au corpus | `vocabulary-file.schema.json`, contrainte `if/then` | atteint |
| B3 | Les enums des schemas sont identiques aux vocabulaires publiés | validate.mjs étape 3 | atteint |
| B4 | Aucune divergence n'est possible entre les deux | Génération par `tools/build-vocabularies.mjs` | atteint par construction |

## C. Provenance

| # | Critère | Vérifié par | État |
|---|---|---|---|
| C1 | Chaque fragment porte des offsets octets vérifiés par relecture du fichier réel | `tools/make-fragments.mjs` | atteint |
| C2 | Chaque objet canonique possède une provenance vers un fragment existant | INV-002, INV-001 | atteint |
| C3 | Le fichier original reste l'autorité ; aucun round-trip octet n'est promis | `corpus-file.schema.json`, `reconstructibleFromFragments` constant à `false` | atteint |
| C4 | Régénérer les fragments depuis le corpus redonne exactement le même résultat | INV-011 | atteint |
| C5 | Le corpus est identifié par son hash, pas par son chemin | `expectedContentHash` dans la configuration | atteint |

## D. Épistémique

| # | Critère | Vérifié par | État |
|---|---|---|---|
| D1 | Aucune claim ne porte de score global de preuve | `claim.schema.json`, absence du champ | atteint |
| D2 | Les six axes restent orthogonaux | `evidence-assessment.schema.json` | atteint |
| D3 | `EXPERT_PRACTICE` et `HYPOTHESIS` ne peuvent pas être des faits établis | `claim.schema.json`, `if/then` | atteint, testé par INV-CASE-03 |
| D4 | Une mesure EMG ne devient jamais une preuve d'hypertrophie | INV-005 | atteint, testé par INV-CASE-04 et 05 |
| D5 | `rawStatement` est conservé même quand `canonicalStatement` existe | `claim.schema.json`, champ requis | atteint |
| D6 | `cannotConclude` est présent sur chaque claim et survit à la projection | INV-004 | atteint, testé par INV-CASE-06 |
| D7 | Une même claim porte plusieurs évaluations datées, sans écrasement | INV-012, golden set : `claim.training.volume.0001` | atteint |
| D8 | Une hausse de confiance exige une preuve nouvelle | INV-003 | atteint, testé par INV-CASE-20 |
| D9 | Une ligne de tableau peut produire plusieurs claims | `siblingClaimsFromSameFragment`, golden set : F2 §2.5 | atteint |

## E. Sources

| # | Critère | Vérifié par | État |
|---|---|---|---|
| E1 | Une source incomplète reste incomplète et validable | `source.schema.json`, champs facultatifs | atteint |
| E2 | Une publication accepte plusieurs URL | `source.urls[]` | atteint |
| E3 | Un DOI ou PMID présent exige sa provenance | `source.schema.json`, `if/then` | atteint, testé par INV-CASE-02 |
| E4 | Un conflit d'attribution n'est jamais fusionné | INV-009 | atteint, testé par INV-CASE-17 |
| E5 | Une fusion n'est permise que sur identifiant fort ou décision humaine | `source-resolution.schema.json` | atteint |

## F. Exercices et substitutions

| # | Critère | Vérifié par | État |
|---|---|---|---|
| F1 | Aucun champ binaire `safe` ou `dangerous` n'existe | Absence dans tous les schemas | atteint |
| F2 | Les quatre catégories d'observation articulaire sont distinctes et contraignantes | `joint-load-observation.schema.json` | atteint, testé par INV-CASE-07 |
| F3 | Une charge mécanique ne produit jamais une contre-indication | INV-006 | atteint |
| F4 | Une substitution porte au moins un critère justificatif | `substitution-relation.schema.json` | atteint, testé par INV-CASE-10 |
| F5 | Un champ d'exercice non trivial porte son attestation | `exercise.schema.json` | atteint, testé par INV-CASE-11 |
| F6 | Une fiche stub ne porte aucune affirmation musculaire | `exercise.schema.json`, `if/then` | atteint |

## G. Clinique, politiques et runtime

| # | Critère | Vérifié par | État |
|---|---|---|---|
| G1 | Un red flag porte son action et son niveau d'urgence | `red-flag.schema.json` | atteint, testé par INV-CASE-09 |
| G2 | Un red flag actif ne peut pas être contourné | INV-007 | atteint, testé par INV-CASE-14 |
| G3 | Une contre-indication repose sur un fondement admissible et vérifié | INV-008 | atteint, testé par INV-CASE-08 |
| G4 | Une politique produit n'est jamais présentée comme une vérité médicale | `product-safety-policy.schema.json` | atteint, testé par INV-CASE-12 |
| G5 | Une règle normative référence une claim ou une décision produit | `adaptation-rule.schema.json` | atteint, testé par INV-CASE-13 |
| G6 | Aucun état dynamique d'utilisateur ne vit dans la KB | INV-015 | atteint, testé par INV-CASE-15 |
| G7 | Toute entité normative porte une date de revue | INV-015 | atteint |

## H. Identifiants et gouvernance

| # | Critère | Vérifié par | État |
|---|---|---|---|
| H1 | Un identifiant est attribué une fois et enregistré | INV-010 | atteint, testé par INV-CASE-19 |
| H2 | Le hash détecte un changement mais ne constitue pas l'identité | `tools/canonical.mjs`, exclusions documentées | atteint |
| H3 | Un slug peut changer sans casser une relation | Rien ne référence un slug ; historique conservé au registre | atteint |
| H4 | Aucune suppression physique silencieuse | INV-012 | atteint, testé par INV-CASE-16 |
| H5 | Une release refuse de publier si un contrôle bloquant échoue | `kb-release.schema.json`, `if/then` sur `blockingChecks` | atteint |

## I. Migration clinique

| # | Critère | Vérifié par | État |
|---|---|---|---|
| I1 | Tous les champs du schéma existant sont couverts par le mapping | INV-013, 98 chemins | atteint |
| I2 | Aucun chemin surnuméraire dans le mapping | INV-013 | atteint |
| I3 | Chaque transformation porte sa justification | `clinical-schema-migration.json`, champ `rationale` sur les 98 entrées | atteint |
| I4 | La destination des champs runtime est explicite | `runtimeDestinations` + golden set runtime | atteint |
| I5 | Les règles de priorité des red flags sont énoncées | `redFlagPriorityRules`, 6 règles | atteint |
| I6 | Au moins un exemple de migration valide | `tolerance-observation` et `irritability-state` du golden set | atteint |

## Critères NON atteints à ce stade, et pourquoi

| # | Critère | Raison |
|---|---|---|
| X1 | Idempotence du pipeline complet | Les étapes 3 à 10 et 15 ne sont pas implémentées. Seule la fragmentation est vérifiée (INV-011). |
| X2 | Conservation de `cannotConclude` dans toutes les projections | Une seule projection existe. L'assertion est écrite pour être réutilisée mais n'a rien d'autre à contrôler. |
| X3 | Audit des sorties conversationnelles | `OutputPolicy` énumère les interdits ; aucun générateur de sortie n'existe encore. |
| X4 | Résolution du conflit Haugen / Heidel | Non tranchable avec le corpus seul. Volontairement laissé ouvert et escaladé. |
| X5 | Ergonomie du modèle `AttestedValue` à grande échelle | Éprouvé sur cinq variantes. La synthèse multi-IA demandait un prototype avant de figer ; il faudra le rejuger sur plusieurs centaines de fiches. |
| X6 | Granularité des claims dans la prose dense | Règle d'amorce énoncée dans `extraction-contract/README.md`, éprouvée sur les tableaux, pas encore sur F2 §1 à §7. |
