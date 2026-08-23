# Contrats des étapes d'extraction

Ce dossier définit **ce que l'extracteur devra produire**, pas l'extracteur lui-même. L'objectif de la
phase 2 est qu'on puisse écrire le pipeline sans avoir à réinventer les contrats en cours d'implémentation.

## Principe : déterministe d'abord, LLM en dernier recours

L'extraction est hybride, et l'ordre n'est pas négociable.

| Étape | Méthode | Ce qu'elle traite | Ce qu'elle ne traite jamais |
|---|---|---|---|
| E1 | `deterministic_table_row` | Les lignes des tableaux de F1 et F2, qui portent la majorité des claims | La prose |
| E2 | `deterministic_table_cell` | Les cellules typées : confiance, population, limites, « ce qu'on ne peut PAS conclure » | — |
| E3 | `deterministic_link_scan` | Les liens markdown : libellé de citation, URL, fragment d'origine | L'attribution bibliographique |
| E4 | `deterministic_json_path` | F4, qui est un JSON Schema et se parcourt exactement | — |
| E5 | `llm_prose_extraction` | Uniquement les passages en prose que E1–E4 ne couvrent pas, principalement F2 §1 à §9 et F3 §1 à §12 | Les tableaux, déjà couverts ; toute décision de fusion |

La raison de cet ordre est mesurable sur le corpus : les tableaux de F1 fournissent, pour chaque affirmation,
la confiance, la population, les sources, les contradictions, les limites et la colonne « Ce qu'on ne peut PAS
conclure ». Confier cela à un LLM reviendrait à réintroduire de l'incertitude là où le corpus en avait retiré.

## Ce qu'un LLM a le droit de faire

- Découper un paragraphe en affirmations vérifiables distinctes.
- Recopier un `verbatimSpan` exact et proposer un `canonicalStatement`.
- Proposer une classification épistémique **et sa justification**.
- Lever un drapeau (`flags`) pour orienter la revue.

## Ce qu'un LLM n'a jamais le droit de faire

- Attribuer un identifiant métier. Les identifiants viennent du registre, à l'approbation.
- Compléter une métadonnée bibliographique absente du corpus.
- Fusionner deux entités, y compris deux formulations très proches.
- Élever un niveau de confiance ou un statut épistémique par rapport à ce que le fragment énonce.
- Écrire directement dans `curated/`.

Ces interdits ne reposent pas sur la bonne volonté du prompt : `extraction-candidate.schema.json` refuse
un candidat LLM sans `modelId`, `promptHash`, `temperature` et `rawResponse`, et aucun candidat ne peut
entrer dans `curated/` sans `ReviewDecision`.

## Rejouabilité

Chaque exécution conserve : son entrée, sa sortie, la version de l'extracteur, les hashes du corpus, et —
si un LLM est intervenu — l'identifiant du modèle, le hash du prompt et la réponse brute. Sans ces
éléments, une erreur d'extraction est indistinguable d'une erreur de post-traitement, et INV-011 ne peut
pas être vérifié.

## Granularité des claims : décision volontairement laissée ouverte

La synthèse multi-IA signalait deux décisions méritant un prototype avant d'être gelées. La première est ici.

Une ligne de tableau ne produit pas toujours une claim. Le golden set en contient la démonstration : le
paragraphe F2 §2.5 porte **deux** affirmations indépendantes — la spécificité de la force au mode testé et
l'absence de différence d'hypertrophie — que F2 §11 signale précisément comme souvent confondues. Le champ
`siblingClaimsFromSameFragment` les relie sans les fusionner.

La règle de découpage retenue pour l'amorce : **une claim = une affirmation dont on peut dire séparément
si elle est vraie, et pour laquelle le corpus fournit séparément une confiance ou une limite.** Elle tient
sur les tableaux. Elle demande à être éprouvée sur la prose dense de F2 §1 à §7 avant d'être figée, et
c'est le premier travail de la phase 3.

## Étapes du pipeline

```text
 1. snapshot et hash des quatre sources          → corpus/corpus-manifest.json
 2. fragmentation, offsets bruts, headingPath    → fragments/fragments.json
 3. extraction déterministe E1–E4                → candidates/
 4. extraction LLM E5, candidats uniquement      → candidates/
 5. conservation du texte brut extrait           → verbatimSpan
 6. classification épistémique sans hausse       → payload.knowledgeType, epistemicStatus
 7. normalisation entités et vocabulaires        → vocabularies/
 8. résolution des sources sur DOI/PMID exacts   → SourceResolution
 9. candidats de fusion, jamais de fusion auto   → ReviewDecision
10. relations, conflits et lacunes               → curated/epistemic/
11. validation JSON Schema + intégrité           → tests/validate.mjs
12. contrôles sémantiques et de sécurité         → tests/invariants.mjs
13. revue humaine ciblée par le risque           → governance/review-decisions/
14. publication immuable                         → KBRelease
15. génération des projections                   → projections/
```

Les étapes 1, 2, 11 et 12 sont **implémentées et exécutées** dans ce paquet. Les autres sont spécifiées.
