# FitTrack — Synthèse comparative des rapports Claude, GPT et Grok

## Verdict

Les trois rapports convergent fortement sur l’architecture générale. Ils ne doivent cependant pas être fusionnés mécaniquement et aucun ne doit être adopté sans corrections.

La recommandation est :

1. utiliser **Claude comme document d’architecture principal** ;
2. intégrer plusieurs corrections conceptuelles de **GPT**, surtout la séparation entre connaissance scientifique et état dynamique de l’utilisateur ;
3. conserver les fichiers de **Grok comme prototypes et exemples de test**, mais ne pas prendre ses JSON Schema comme contrat de production en l’état ;
4. produire maintenant un contrat consolidé, des schémas complets et un petit golden set validé avant d’écrire l’extracteur.

Il n’est pas nécessaire de relancer immédiatement les trois IA. Les rapports contiennent déjà assez de matière pour trancher l’architecture.

## Comparaison synthétique

| Critère | Claude | GPT | Grok |
|---|---|---|---|
| Analyse réelle des quatre fichiers | Excellente, très précise | Bonne, plus synthétique | Bonne, mais moins approfondie |
| Préservation des nuances scientifiques | Excellente | Très bonne | Correcte |
| Provenance et résolution des sources | Excellente | Très bonne | Basique |
| Modélisation des contradictions et lacunes | Excellente | Très bonne | Présente mais simplifiée |
| Exercices et substitutions | Excellente, relations justifiées | Très bonne séparation exercice/variante | Trop simplifiée dans le schéma livré |
| Migration du JSON clinique | Très détaillée | Conceptuellement la plus juste sur le runtime | Concrète mais incomplète |
| Sécurité clinique | Excellente | Excellente | Bonne dans le rapport, moins forte dans le schéma |
| Pipeline et contrôles qualité | Très détaillés | Solides et clairs | Exploitables mais trop sommaires |
| Fichiers directement utilisables | Aucun schéma complet | Aucun schéma complet | Oui, mais prototypes à corriger |
| Risque principal | Sur-modélisation | Spécification trop abstraite | Fausse impression d’être prêt pour la production |

## Consensus solide entre les trois rapports

Les points suivants peuvent être adoptés sans nouvelle consultation :

- la source canonique doit être versionnée dans Git ;
- JSON ou JSONL doivent porter les entités, avec JSON Schema pour la validation ;
- le wiki, l’index vectoriel, le graphe, les context packs et le futur dataset sont des projections reconstruisibles ;
- le claim atomique est le cœur épistémique, mais pas l’unique entité ;
- toute donnée importante doit remonter à un fragment exact du corpus ;
- les sources incomplètes doivent rester incomplètes ;
- les évaluations de preuve doivent être historisées et ne jamais être écrasées ;
- contradictions, lacunes et incertitudes sont des données de première classe ;
- `EXPERT_PRACTICE`, `HYPOTHESIS`, biomécanique, EMG et preuve directe doivent rester distincts ;
- `Exercise` et `ExerciseVariant` doivent être séparés ;
- une substitution doit être une relation justifiée, pas une simple liste de muscles communs ;
- le schéma clinique existant doit être migré, pas utilisé comme squelette global ;
- les red flags et la zone RED prévalent sur le coaching normal ;
- l’extraction doit être hybride : déterministe d’abord, LLM seulement pour les passages ambigus ;
- aucune conversation ni trajectoire de tools ne doit être générée à ce stade.

## Ce qu’il faut retenir de Claude

Le rapport Claude est le meilleur socle parce qu’il relie réellement les décisions de modélisation aux particularités du corpus.

À conserver :

- les marqueurs séparant faits du corpus, décisions de modélisation et informations manquantes ;
- les couches `corpus → fragments → extracted → normalized → curated → projections` ;
- la séparation physique entre contenu descriptif et règles normatives ;
- les hiérarchies de preuves propres à chaque domaine au lieu d’une hiérarchie universelle artificielle ;
- la confiance évaluée par aspect lorsqu’un claim possède une conclusion forte sur une dimension et plus faible sur une autre ;
- `SourceResolution` pour conserver les ambiguïtés bibliographiques ;
- les cas réels de sources dupliquées ou contradictoires comme fixtures de test ;
- `JointLoadObservation` à la place d’un champ laissant entendre qu’un exercice serait intrinsèquement dangereux ;
- `SubstitutionEdge` avec critères obligatoires ;
- `SafetyPolicy` et `OutputPolicy` séparées des faits scientifiques ;
- les tests anti-inflation de certitude, EMG ≠ hypertrophie, charge mécanique ≠ danger, et préservation de `cannotConclude`.

À simplifier ou corriger :

- ne pas placer l’état actuel d’irritabilité et les observations de tolérance d’un utilisateur dans une `Condition` canonique ;
- ne pas utiliser un fragment de hash comme partie nécessaire de l’identité métier ;
- éviter d’embarquer des `EvidenceAssessment` complets dans un claim si ces évaluations sont aussi des entités indépendantes ; utiliser des références ;
- conserver `rawStatement` en plus de `canonicalStatement`, afin que la normalisation ne remplace jamais le texte extrait ;
- ne pas supposer qu’une ligne de tableau correspond toujours exactement à un claim ; certaines lignes peuvent contenir plusieurs affirmations vérifiables ;
- la reconstruction octet pour octet à partir de fragments sémantiques n’est réaliste que si les offsets et les séparateurs bruts sont conservés. Le fichier original et ses hashes de tranches doivent rester l’autorité ;
- la règle interdisant une confiance élevée à tout type autre que `EVIDENCE` est trop large : un fait anatomique peut être très certain. L’interdiction doit viser spécifiquement `EXPERT_PRACTICE` et `HYPOTHESIS` ;
- limiter DOI/PMID/URL au contenu du corpus est correct pendant l’extraction initiale, mais une future phase d’enrichissement vérifié devra pouvoir ajouter des métadonnées avec une provenance externe explicite.

## Ce qu’il faut retenir de GPT

GPT apporte la correction conceptuelle la plus importante : **la KB scientifique et l’état dynamique de l’utilisateur ne sont pas la même chose**.

À conserver :

- `ToleranceDimension` comme définition générale dans la KB ;
- `ToleranceObservation`, `SymptomObservation`, `IrritabilityState`, `ExerciseResponse`, `DelayedResponse` et `ClinicianInstruction` dans le stockage runtime de l’utilisateur ;
- `ProductSafetyPolicy` pour les choix conservateurs de FitTrack qui ne sont pas des seuils médicaux universels ;
- des identifiants métier stables, un `contentHash` séparé et une révision indépendante ;
- aucune fusion automatique de claims seulement parce que leurs formulations semblent proches ;
- la comparaison population/intervention/comparateur/outcome/contexte avant toute déduplication ;
- une revue humaine orientée par le risque : red flags, contre-indications, conflits, sources ambiguës, règles cliniques et fusions incertaines ;
- des sources dont les champs minimums sont faibles et dont le statut de résolution est explicite.

À compléter :

- le rapport ne fournit pas les vrais JSON Schema annoncés ;
- il analyse moins précisément les conflits bibliographiques déjà présents dans les fichiers ;
- plusieurs exemples laissent les références vers claims et sources vides ;
- sa version de KB au format date n’est pas du SemVer : il faut choisir clairement entre version calendaire et SemVer, sans les confondre.

## Ce qu’il faut retenir de Grok

Grok a fourni le meilleur **paquet de démarrage matériel** : plusieurs JSON Schema, des enums, une migration, une spécification de pipeline et des critères d’acceptation.

Ces fichiers sont utiles comme :

- exemples de structure de dépôt ;
- brouillons de schemas ;
- liste initiale d’enums ;
- fixtures à transformer en cas valides et invalides ;
- checklist pour vérifier le futur contrat consolidé.

Ils ne doivent pas devenir la base de production en l’état, pour les raisons suivantes :

- le rapport exige une provenance pour toutes les entités, mais plusieurs schemas ne la rendent pas obligatoire ;
- `conditionRecord` n’a pas d’identifiant métier stable, ni révision ni date de revue obligatoire ;
- le clinique mélange encore connaissances générales et observations dynamiques de l’utilisateur ;
- la confiance composite `high_for_direction_moderate_for_curve` est codée comme une valeur spéciale au lieu d’une évaluation par aspect ;
- plusieurs entités annoncées n’ont aucun schema : `CorpusFragment`, `EvidenceAssessment`, `EvidenceConflict`, `ReviewDecision`, `Population`, `Outcome`, `ExerciseVariant`, relations de substitution, etc. ;
- le registre global de sources et les sources cliniques embarquées font encore double emploi ;
- les champs d’exercice n’imposent pas systématiquement les claim refs ou source refs qui les justifient ;
- `evidenceConfidence` accepte des chaînes libres, ce qui contourne les vocabulaires contrôlés ;
- les règles RED, EMG et expert practice sont surtout documentaires : les schemas seuls ne les rendent pas toutes impossibles ;
- la stratégie d’ID et la déduplication par hash de formulation plus sources sont trop sensibles aux reformulations et aux mises à jour bibliographiques.

## Architecture consolidée recommandée

```text
fittrack-kb/
├── corpus/                 # fichiers originaux immuables + manifest et hashes
├── fragments/              # fragments bruts, offsets, headingPath, hashes
├── candidates/             # sorties déterministes ou LLM non approuvées
├── curated/
│   ├── epistemic/          # claims, sources, assessments, conflicts, gaps
│   ├── training/           # variables et heuristiques de programmation
│   ├── anatomy/            # muscles, régions, articulations, actions
│   ├── exercises/          # exercices, variantes, observations, substitutions
│   └── clinical/           # conditions, symptômes, red flags, règles générales
├── policies/               # choix normatifs FitTrack, sécurité et formulation
├── governance/             # décisions de revue, historique, releases
├── schemas/                # contrats JSON Schema complets
├── vocabularies/           # enums et lexiques contrôlés
├── fixtures/               # golden set + cas invalides
└── projections/            # wiki, recherche, context packs, règles compilées

fittrack-runtime/           # hors de la KB scientifique
├── symptom-observations
├── tolerance-observations
├── irritability-states
├── exercise-responses
├── delayed-responses
└── clinician-instructions
```

La frontière importante est :

```text
KB : « quelles dimensions faut-il observer et comment les interpréter prudemment ? »
Runtime : « que rapporte cet utilisateur, à cette date, avec cette charge ? »
Policy : « quelle conduite conservatrice FitTrack applique-t-il ? »
```

## Modèle épistémique consolidé

Ne pas utiliser un score global unique. Les axes suivants doivent rester orthogonaux :

| Axe | Fonction |
|---|---|
| `knowledgeType` | Nature de l’objet : preuve, pratique experte, hypothèse, fait anatomique, observation biomécanique, politique produit |
| `epistemicStatus` | État de la conclusion : établi, probable, incertain, controversé, etc. |
| `confidenceByAspect[]` | Confiance sur la direction, l’ampleur, la généralisation, le seuil ou un autre aspect |
| `directness` | Preuve directe d’outcome, clinique indirecte, biomécanique, EMG, mécanistique, expertise seule |
| `evidenceTypes[]` | Types précis de documents ou d’études |
| `hierarchyRef` | Hiérarchie adaptée au domaine dans lequel l’évaluation est faite |

Une même claim peut recevoir plusieurs `EvidenceAssessment` datées. L’évaluation courante est une projection de l’historique, pas une valeur écrasée.

## Entités indispensables pour la première version

### Provenance et evidence core

- `CorpusFile`
- `CorpusFragment`
- `CitationOccurrence`
- `Source`
- `SourceResolution`
- `Claim`
- `EvidenceAssessment`
- `EvidenceConflict`
- `EvidenceGap`
- `Population`
- `Outcome`
- `ReviewDecision`

### Anatomie et exercices

- `Muscle`
- `MuscleRegion`
- `Joint`
- `JointAction`
- `MovementPattern`
- `Exercise`
- `ExerciseVariant`
- `Equipment`
- `ResistanceProfile`
- `JointLoadObservation`
- `SubstitutionRelation`

### Clinique et politiques

- `Condition`
- `Symptom`
- `ClinicalQuestion`
- `RedFlag`
- `SafetyZone`
- `ToleranceDimensionDefinition`
- `AdaptationRule`
- `Contraindication`
- `ReferralRule`
- `ProductSafetyPolicy`
- `OutputPolicy`

Les observations utilisateur restent hors de cette liste et hors de la KB canonique.

## Politique d’identifiants recommandée

Utiliser un identifiant attribué une fois et conservé par un registre :

```json
{
  "id": "claim.training.volume.0001",
  "slug": "weekly-volume-dose-response",
  "revision": 3,
  "contentHash": "sha256:..."
}
```

- `id` ne dépend pas du texte courant ;
- `slug` peut changer sans casser les relations ;
- `contentHash` détecte une modification ;
- `revision` trace l’évolution ;
- `supersededBy` ou `retiredAt` remplace toute suppression physique.

## Pipeline consolidé

```text
1. snapshot et hash des quatre sources
2. fragmentation avec offsets bruts et chemins de titres
3. extraction déterministe des tableaux, références et JSON
4. extraction LLM des passages en prose vers des candidats uniquement
5. conservation du texte brut extrait
6. classification épistémique sans hausse de certitude
7. normalisation des entités et vocabulaires
8. résolution des sources sur DOI/PMID/URL exacts
9. création de candidats de fusion, sans fusion inter-fichiers automatique
10. création des relations, conflits et lacunes
11. validation JSON Schema et intégrité référentielle
12. contrôles sémantiques et de sécurité
13. revue humaine ciblée
14. publication immutable de la KB curée
15. génération des projections
```

Chaque étape conserve son entrée, sa sortie, sa version, ses hashes et, si un LLM est utilisé, l’identifiant du modèle, le hash du prompt et la réponse brute.

## Contrôles bloquants recommandés

La publication doit échouer si :

- une entité canonique n’a aucune provenance ;
- une référence interne ne résout pas ;
- une métadonnée bibliographique est ajoutée sans provenance ;
- une preuve EMG seule devient un avantage hypertrophique ;
- une observation biomécanique seule devient un risque de blessure démontré ;
- une pratique experte ou une hypothèse devient un fait établi ;
- un `cannotConclude` disparaît d’une projection ;
- une politique produit est présentée comme vérité médicale ;
- une contre-indication n’a pas de justification explicite ;
- une substitution ne possède aucun critère justifiant son équivalence ;
- une règle normative ne référence ni claim justificatif ni décision produit explicite ;
- un red flag actif laisse le flux normal de coaching ignorer son action ou son niveau d’urgence ;
- deux exécutions sur le même corpus modifient la sortie publiée ;
- une entité validée disparaît sans décision de retraite tracée.

## Décisions à figer avant l’extracteur

Les décisions suivantes peuvent être adoptées maintenant :

1. JSONL pour les collections volumineuses, JSON par instance pour les objets fortement révisés individuellement.
2. JSON Schema draft 2020-12.
3. Identifiants attribués et stables, hashes séparés.
4. Français comme langue canonique initiale, aliases et labels localisés séparés.
5. Sources partielles autorisées ; aucune métadonnée inventée.
6. Exercise et ExerciseVariant séparés.
7. Substitution comme relation réifiée et justifiée.
8. Trois espaces séparés : descriptif scientifique, politique produit et runtime utilisateur.
9. Aucune fusion automatique entre claims provenant de fichiers différents.
10. Le clinique est modélisé en dernier et soumis aux contrôles les plus stricts.

Deux décisions méritent un petit prototype avant d’être gelées :

- granularité exacte des claims dans la prose dense du rapport biomécanique ;
- ergonomie du modèle `AttestedValue` par champ d’exercice, qui protège bien la preuve mais peut rendre les objets trop lourds.

## Prochaine phase recommandée

La prochaine phase doit produire un **contrat exécutable**, pas encore l’extracteur complet :

1. arborescence canonique ;
2. politique d’identifiants et de versionnement ;
3. JSON Schema complets pour les entités indispensables ;
4. vocabulaires contrôlés ;
5. mapping champ par champ du JSON clinique existant ;
6. contrats d’extraction déterministe et LLM ;
7. golden set manuel comprenant au minimum :
   - 10 à 15 claims ;
   - 5 sources, dont une ambiguë ;
   - 3 conflits ou lacunes ;
   - 3 exercices ou variantes ;
   - 2 substitutions ;
   - 2 conditions ;
   - les red flags et trois zones ;
   - 2 politiques produit ;
   - exemples valides et invalides pour les invariants critiques ;
8. validation automatique de tous les schemas et fixtures ;
9. revue humaine du golden set ;
10. seulement ensuite, implémentation du pipeline.

## Conclusion opérationnelle

Les trois rapports ont rempli leur rôle. Le travail n’est plus de demander une quatrième opinion, mais de transformer leur convergence en un contrat cohérent.

La direction à suivre est :

```text
Claude comme socle détaillé
+ GPT pour la séparation KB / policy / runtime et les IDs
+ Grok comme matériel de prototype et de test
= architecture consolidée FitTrack
```

Les ZIP d’origine doivent être archivés comme documents de conception. Leurs schemas ne doivent pas être copiés tels quels dans la future KB sans passage par le contrat consolidé et les tests.
