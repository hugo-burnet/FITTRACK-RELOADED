# E5-GOLD — benchmark humain de l’extraction de prose

E5-GOLD est la vérité d’évaluation manuelle d’E5-LLM. Ce dossier n’est ni un jeu
d’entraînement, ni une extraction de production, ni une partie de `curated/`.
Il décrit uniquement les claims qu’un extracteur doit retrouver dans les 100
fragments fixés par E5-P0.

## Références normatives

Les annotations ont été réalisées en monde fermé à partir de :

- [`references/E5-DESIGN-REVIEW.md`](references/E5-DESIGN-REVIEW.md), lu intégralement avant annotation ;
- [`../../extraction-contract/README.md`](../../extraction-contract/README.md) ;
- les schémas `Claim`, `EvidenceAssessment`, `Provenance`, `CorpusFragment` et
  `CitationOccurrence` ;
- [`../../candidates/e5-prose-golden-manifest.json`](../../candidates/e5-prose-golden-manifest.json) ;
- les seuls fragments et CitationOccurrences de prose produits par E5-P0.

Aucune recherche web, résolution bibliographique, connaissance générale ou
fragment adjacent n’a complété le texte annoté.

## Arborescence

```text
golden/e5/
  annotation.schema.json
  annotations/
    annotator-a.json
    annotator-b.json
  adjudication/
    adjudicated.json
    disagreements.json
  references/
    E5-DESIGN-REVIEW.md
  source/
    annotator-a-f2.mjs
    annotator-a-f3.mjs
    annotator-b.mjs
    adjudication-spec.mjs
    double-annotation-fragments.json
  manifest.json
  metrics.json
  README.md
```

Les modules de `source/` sont la saisie manuelle compacte. Le builder calcule
les offsets UTF-8, les identifiants techniques stables et les sidecars de
résolution ; il ne décide pas automatiquement quels claims existent.

## Unité et granularité

La question unique est : « quelles unités de connaissance distinctes et
réellement affirmées sont présentes dans ce fragment ? » Une claim porte un
prédicat évaluable. Deux propositions sont séparées lorsque leur vérité, leur
preuve, leur type épistémique ou leur périmètre peuvent varier indépendamment.
Les qualificatifs indispensables — population, condition, temporalité,
modalité, négation et limite — restent attachés au prédicat.

Chaque `rawStatement` est un span exact du `rawText`. Plusieurs spans sont
autorisés seulement lorsque plusieurs portions minimales sont nécessaires. Les
offsets relatifs au fragment et absolus dans le fichier sont calculés en octets
UTF-8 et relus par le validateur.

## Axes non déterminables

Le schéma réutilise les vocabulaires fermés du contrat. Une valeur n’est
présente que si le fragment la permet. Le sidecar `axisResolution` distingue
`RESOLVED`, `UNRESOLVED`, `NOT_STATED` et `NOT_APPLICABLE`. La chaîne
`UNRESOLVED` n’est jamais injectée dans un vocabulaire fermé.

Les `assessment` sont des brouillons compatibles avec les axes du schéma de
production, pas des `EvidenceAssessment` curated : aucun identifiant métier,
`Source`, auteur, DOI ou niveau bibliographique n’est inventé.

## Citations

`citationOccurrenceIds` est une liste fermée de candidate IDs E5-P0. Une
occurrence est attachée uniquement lorsque sa portée textuelle soutient la
claim. Une attribution terminale ou groupée ambiguë reste `UNRESOLVED`. Une
claim textuelle sans citation conserve une liste vide ; aucune citation n’est
ajoutée par propagation depuis une phrase voisine.

## ZERO_CLAIM

`zero_claim` est une cible positive du benchmark. Elle couvre notamment les
transitions, fragments de listes sans sujet autonome, politiques de sortie,
instructions d’encodage et commentaires de schéma. Une répétition ou une
affirmation scientifique non citée n’est pas un zéro claim par défaut.

## Double annotation et adjudication

Trente fragments difficiles ont été sélectionnés avant annotation : 15 F2 et
15 F3, dont les onze ancres du Design Review. `annotator_A` a annoté les 100
fragments ; `annotator_B` a annoté ces 30 fragments sans accès aux sorties A.
Les désaccords mesurés portent sur le nombre de claims, les spans/granularité,
les citations, `knowledgeType`, `epistemicStatus`, `ZERO_CLAIM` et
`UNRESOLVED`.

`adjudication/disagreements.json` contient une justification uniquement pour
les désaccords réels. `adjudication/adjudicated.json` est la référence finale
de comparaison. Les accords ne reçoivent pas de justification artificielle.

## Résultat v1 adjudiqué

- 100 fragments : 50 F2 et 50 F3 ;
- 186 claims : 123 F2 et 63 F3 ;
- moyenne 1,86 et médiane 2 claims par fragment ;
- 32 `ZERO_CLAIM` ;
- 0 statut fragment `unresolved` ou `needs_adjudication` après adjudication ;
- 71 claims conservent au moins un axe `UNRESOLVED`, réparties sur 31 fragments ;
- 76 claims avec au moins une citation, 110 sans citation ;
- 88 couples claim–CitationOccurrence, soit 0,473 citation par claim.

Sur les 30 fragments doubles, l’accord exact sur le nombre de claims est de
76,7 % (23/30) et l’écart absolu moyen de 0,4 claim. Après alignement par
chevauchement maximal des spans : accord exact des spans 79,1 %,
`knowledgeType` 95,3 %, `epistemicStatus` 93,2 % et attribution des citations
91,9 %. L’unique cas comparable `ZERO_CLAIM` est concordant. Vingt-sept
désaccords doubles et deux cas primaires supplémentaires ont reçu une décision
d’adjudication explicite.

Les principaux désaccords portent sur les frontières/granularité (20
fragments), la décision de laisser un axe `UNRESOLVED` (17), les citations (12),
le statut épistémique (12), le type de connaissance (9) et le nombre de claims
(7). Ces chiffres ne sont pas normalisés pour donner une impression d’accord
artificiel ; ils décrivent la reproductibilité réelle de la politique.

Deux limites du Design Review sont devenues concrètes pendant l’annotation :

- le manifest P0 figé ne contient que 12 fragments à citations multiples,
  contre la cible de 15 du review ; la sélection P0 n’a pas été modifiée ;
- une coordination partageant un seul sujet/prédicat peut être impossible à
  découper en spans à la fois autonomes, atomiques et verbatim. Dans ce cas, la
  proposition coordonnée est conservée et l’attribution fine reste ambiguë.

## Validation déterministe

```bash
npm run build:e5-gold
npm run test:e5-gold
npm run validate:e5-gold
```

Les contrôles couvrent : existence et ordre des fragments ; relecture exacte
des spans ; offsets relatifs et absolus ; références fermées aux citations ;
appartenance de chaque occurrence au fragment ; vocabulaires ; contraintes
EMG/biomécanique ; IDs uniques ; couverture exacte 100/30 ; présence de
l’adjudication pour chaque désaccord ; cohérence du manifest et des métriques.

## Benchmark E5-LLM futur

La structure permet un futur comparateur sur : claim precision/recall/F1,
exact/near-match de granularité, correction des spans, précision/rappel des
citations, exactitude des types/statuts, `ZERO_CLAIM`, hallucinations,
inférences non soutenues et surinterprétation clinique. Aucun modèle n’est
appelé et aucun benchmark modèle n’est lancé par E5-GOLD.
