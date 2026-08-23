# Architecture de la Knowledge Base FitTrack

## Ce que ce paquet est, et ce qu'il n'est pas

C'est le **contrat exécutable** de la KB : l'arborescence canonique, les schemas, les vocabulaires, la
migration du schéma clinique, les contrats d'extraction, un golden set fondé sur le corpus, et quinze
invariants qui tournent réellement.

Ce n'est pas l'extracteur, ni un wiki, ni une base vectorielle, ni un dataset. Le but est qu'on puisse
écrire le pipeline ensuite **sans réinventer les contrats en cours d'implémentation**.

## Les trois espaces

```text
KB      : quelles dimensions faut-il observer, et comment les interpréter prudemment ?
POLICY  : quelle conduite conservatrice FitTrack applique-t-il ?
RUNTIME : que rapporte cet utilisateur, à cette date, avec cette charge ?
```

C'est la correction conceptuelle la plus importante apportée par la comparaison multi-IA, et elle est
structurelle plutôt que documentaire :

- une entité runtime porte un identifiant préfixé `rt.`, qui la rend inréférençable depuis `curated/` ;
- une entité runtime n'a pas de champ `provenance`, et son schéma le refuse ;
- une politique n'a pas de provenance de corpus non plus, mais une `decision` ;
- INV-015 échoue si `testedLoad`, `testedRange`, `symptomDuring`, `symptomAfter24h` ou `irritability`
  apparaissent hors du runtime.

## Arborescence

```text
fittrack-kb-contract/
├── corpus/              empreinte des quatre fichiers, jamais leur copie
├── fragments/           tranches exactes : offsets octets, headingPath, hashes
├── candidates/          extractions non approuvées (vide à ce stade, contrat défini)
├── curated/             source de vérité — représentée ici par fixtures/golden-set
├── policies/            décisions normatives FitTrack
├── governance/          registre d'identifiants, décisions de revue, releases
├── schemas/             47 JSON Schema draft 2020-12
├── vocabularies/        29 vocabulaires contrôlés, générés depuis une source unique
├── fixtures/            golden set, cas valides, cas qui doivent échouer
├── projections/         sorties dérivées et reconstruisibles
├── extraction-contract/ ce que l'extracteur devra produire
├── mappings/            migration du schéma clinique existant
├── tests/               validateur, invariants, critères d'acceptation
└── tools/               générateurs — fragments, vocabulaires, hashes, registre
```

Et, hors de la KB scientifique :

```text
fittrack-runtime/
├── symptom-observations
├── tolerance-observations
├── irritability-states
├── exercise-responses
├── delayed-responses
└── clinician-instructions
```

## Le modèle épistémique : six axes orthogonaux, aucun score global

Le corpus utilise trois échelles de certitude incompatibles, et plusieurs de ses lignes portent une confiance
composite — « Élevé pour la direction; modéré pour la forme de la courbe ». Aucun scalaire ne peut représenter
cela : l'aplatir vers le haut gonfle la certitude, vers le bas détruit de l'information.

| Axe | Porté par | Rôle |
|---|---|---|
| `knowledgeType` | Claim et EvidenceAssessment | Nature de l'objet affirmé |
| `epistemicStatus` | Claim | État de la conclusion |
| `confidenceByAspect[]` | EvidenceAssessment | Confiance par dimension |
| `directness` | EvidenceAssessment | Nature de la preuve |
| `evidenceTypes[]` | EvidenceAssessment | Types de documents |
| `hierarchyRef` | EvidenceAssessment | Hiérarchie dans laquelle le rang a un sens |

**Aucune claim ne porte de score global de preuve.** La confiance vit dans les `EvidenceAssessment`, qui
sont **référencées et non embarquées** : embarquées, leur historique dépendrait de la révision de la claim
et serait écrasé à la première mise à jour.

### Trois hiérarchies, pas une

Le rapport de programmation place les *position stands* au sommet ; le rapport biomécanique place les études
longitudinales d'hypertrophie mesurée au sommet et relègue l'EMG au rang 6 ; la base clinique ordonne selon
les recommandations de pratique. Ce n'est pas une contradiction, c'est une différence de finalité : l'un
raisonne recommandation, l'autre mécanisme, le troisième adaptation prudente.

Les fusionner en une hiérarchie universelle détruirait une information réelle du corpus. Les trois sont
déclarées comme entités, et chaque évaluation dit dans laquelle son rang a un sens.

### Ce que le schéma rend impossible

Ces règles ne sont pas des consignes d'usage. Elles sont refusées à la validation.

| Règle | Mécanisme |
|---|---|
| `EXPERT_PRACTICE` ou `HYPOTHESIS` ne peuvent pas être des faits établis | `if/then` sur `epistemicStatus` |
| Une observation EMG ne peut pas être « établie » | `if/then` sur `epistemicStatus` |
| Une évaluation `emg_only` ne peut pas porter une confiance haute sur l'ampleur | `if/then` sur `confidenceByAspect` |
| Un risque démontré exige une donnée épidémiologique | `if/then` sur `epidemiologicalEvidence` |
| Une politique produit ne peut pas se déclarer vérité médicale | `const: false` |
| Une règle d'adaptation ne peut pas ignorer un red flag | `const: true` |

La règle initialement envisagée interdisait une confiance élevée à tout type autre que `EVIDENCE`. Elle a
été restreinte : un fait anatomique — la biarticularité du chef long du triceps — peut légitimement être
très certain. L'interdiction vise spécifiquement `EXPERT_PRACTICE`, `HYPOTHESIS` et l'EMG.

## Provenance

```text
entité canonique → candidat extrait → fragment exact → fichier du corpus
                                    → occurrence de citation → source résolue ou non
```

Un `CorpusFragment` porte `corpusFileId`, `headingPath`, lignes et **offsets octets**, type de bloc, texte
brut et hash. Les offsets sont en octets et non en caractères : le corpus est en français, plein de
caractères multi-octets, et un offset en caractères ne permettrait pas de relire le fichier avec un outil
bas niveau.

`tools/make-fragments.mjs` vérifie chaque fragment en **relisant le fichier aux offsets calculés** et en
comparant au texte. Sans ce contrôle, une erreur d'indexation rendrait toute la provenance fausse en
silence.

`reconstructibleFromFragments` est une constante à `false`. Les fragments sont sémantiques et non
exhaustifs ; prétendre reconstruire le fichier octet pour octet serait une garantie que le découpage ne
tient pas. Le fichier original reste l'autorité.

## Sources : l'incomplétude est l'état normal

Le rapport biomécanique cite une centaine de références sans auteur, sans année, sans type de document, avec
les DOI enfouis dans les URL. Un schéma qui exigerait ces champs forcerait à les inventer.

Seuls sont obligatoires : l'identité, la provenance, le libellé de citation et le statut de résolution.

Le corpus fournit quatre cas de résolution réels, tous présents dans le golden set :

| Cas | Situation | Traitement |
|---|---|---|
| Alias non déclaré | « ACSM, 2026 » pointe l'URL que le registre attribue à Currier et al. | Fusion sur preuve interne + décision de revue |
| Localisateurs multiples | Le même essai cité via PubMed, l'éditeur, et PMC sans nom d'auteur | Fusion sur PMID identique |
| Référence partielle | URL seule, ni DOI ni PMID énoncés | `partial`, DOI **non** dérivé de l'URL à ce stade |
| Conflit d'attribution | Deux noms d'auteur, deux localisateurs sans recouvrement | **Non fusionné**, escaladé |

Une fusion automatique n'est autorisée que sur un identifiant bibliographique fort identique. Une similarité
de titre, d'auteur ou de sujet produit seulement un candidat à la revue.

## Exercices : le modèle `AttestedValue`, dosé

La question était de ne pas rendre le modèle inutilisable en enveloppant chaque champ, ni laxiste en
n'enveloppant rien. La règle retenue :

> Un champ est **trivial** — valeur nue — si deux curateurs compétents lisant le corpus ne peuvent pas
> diverger dessus. Il est **non trivial** — valeur attestée — sinon, ou s'il peut influencer une décision
> de coaching.

| Trivial | Attesté |
|---|---|
| identifiant, libellé, alias | muscles moteurs et synergistes |
| `movementPattern` | `lengthenedBias`, `stabilityDemand` |
| `equipment` | `axialLoad`, `lumbarDemand`, `romNotes` |
| `isMultiJoint` | `progressionPotential`, notes de pratique |

`Exercise` et `ExerciseVariant` sont séparés parce que le profil de résistance change pour un même exercice
selon l'équipement : l'attacher à `Exercise` produirait une valeur fausse pour la moitié des exécutions.

`emgActivationComparative` est un champ **séparé et étiqueté**, jamais fusionné avec un champ d'hypertrophie.
Son existence même est la trace de l'interdiction.

Aucun champ binaire `safe` ou `dangerous` n'existe nulle part. Les quatre catégories — charge mécanique,
inconfort rapporté, risque démontré, risque supposé — vivent dans `JointLoadObservation`, et chacune impose
ses propres exigences.

`completeness: stub` est l'état attendu de la grande majorité des exercices : le corpus en nomme plusieurs
dizaines sans les documenter. Une fiche stub ne peut porter aucune affirmation musculaire, ce que le schéma
refuse.

## Clinique : ce qui a changé par rapport au schéma existant

Le schéma clinique existant est **migré, pas utilisé comme squelette**. Les 98 chemins de champs sont
couverts par `mappings/clinical-schema-migration.json`, et INV-013 le vérifie en énumérant les chemins
depuis le fichier réel.

Trois corrections structurelles :

1. **`toleranceDimension` était schizophrène.** Il portait à la fois la définition générale d'un axe et
   l'observation datée d'une personne. Il devient `ToleranceDimensionDefinition` en KB et
   `ToleranceObservation` en runtime.
2. **`irritability` n'a pas sa place dans une condition.** L'irritabilité change d'une semaine à l'autre
   chez une même personne. Elle devient `IrritabilityState`, datée et argumentée par ses indices.
3. **`expert_practice` n'était pas un niveau de preuve.** Le laisser dans l'échelle A/B/C/D permettait de le
   comparer à `A_high`, ce qui n'a pas de sens. Il devient `knowledgeType: EXPERT_PRACTICE`. C'est la seule
   modification de valeur de toute la migration, et le seul changement majeur du contrat.

Trois entités sans équivalent dans le schéma existant ont été créées, parce que le corpus contenait le
contenu sans que rien puisse le porter : `ReferralRule`, `ProductSafetyPolicy` et `OutputPolicy`.

## Ce qui reste ouvert

Deux décisions demandaient un prototype avant d'être gelées ; elles le restent, et c'est délibéré.

1. **Granularité des claims dans la prose dense.** La règle d'amorce est énoncée dans
   `extraction-contract/README.md`. Elle tient sur les tableaux ; elle demande à être éprouvée sur les
   sections en prose du rapport biomécanique avant d'être figée.
2. **Ergonomie d'`AttestedValue` à grande échelle.** Le modèle est éprouvé sur cinq variantes. Il faudra le
   rejuger sur plusieurs centaines de fiches, où le coût de saisie devient réel.

La liste complète de ce qui n'est pas vérifié à ce stade est dans `tests/acceptance-criteria.md`, section
« Critères NON atteints », et dans `tests/invariants.json`, clé `notTestedAtThisPhase`.
