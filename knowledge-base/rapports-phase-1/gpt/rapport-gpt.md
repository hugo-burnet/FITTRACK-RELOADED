# Rapport GPT — Architecture de la Knowledge Base FitTrack

## 1. Conclusion générale

Le JSON clinique actuel ne doit **pas** devenir le squelette global de la base de connaissances.

Les trois rapports Markdown sont beaucoup plus riches sur le plan épistémique : ils distinguent preuve directe, biomécanique, EMG, pratique experte, hypothèse, limites, contradictions et éléments qu’on ne peut pas conclure.

Le cœur de la KB doit donc être construit autour de :

- **claims atomiques**
- **provenance**
- **évaluations de preuve**
- **conflits et lacunes**
- **entités de domaine**
- **règles de décision**
- **projections dérivées**

La KB doit rester indépendante de ses usages :

```text
Sources scientifiques / corpus
            ↓
     Extraction structurée
            ↓
  Knowledge Base canonique
      ↙       ↓        ↘
   Wiki    IA locale   Dataset futur
```

Le moteur IA, le wiki, la recherche vectorielle et le futur dataset ne doivent jamais devenir la source de vérité.

---

# 2. Cartographie du corpus

## Programmation hypertrophie

### Rôle

Décrit :

- volume
- fréquence
- charge
- proximité de l’échec
- repos
- ROM
- longueur musculaire
- sélection d’exercices
- progression
- autorégulation
- périodisation
- deload
- fatigue
- récupération
- spécialisation

### Granularité

Le document contient principalement :

- des affirmations scientifiques
- des niveaux de confiance
- des limites
- des populations
- des contradictions
- des interprétations pratiques
- des éléments `cannotConclude`

### Particularité

Une valeur numérique ne doit jamais être transformée en vérité universelle.

Exemples :

- ~10 séries/semaine = point de départ raisonnable, pas optimum universel
- 1–4 RIR = recommandation pratique plausible, pas loi biologique
- 2–3 min de repos = heuristique pratique, pas seuil universel
- MEV / MRV = concepts pratiques, pas constantes scientifiques

---

## Anatomie, biomécanique et sélection d’exercices

### Rôle

Décrit :

- anatomie musculaire
- fonctions
- actions articulaires
- profils de résistance
- longueur musculaire
- stabilité
- contraintes mécaniques
- familles d’exercices
- substitutions

### Types de connaissance

Doivent rester séparés :

- anatomie
- biomécanique
- hypertrophie directe
- EMG
- mécanismes
- pratique experte

### Guardrail central

> Une différence d’EMG ne suffit jamais à conclure à une différence d’hypertrophie.

De même :

```text
charge mécanique ≠ lésion
contrainte articulaire ≠ danger
modèle biomécanique ≠ risque clinique démontré
```

---

## Coaching clinique adaptatif

### Rôle

Décrit :

- symptômes
- évolution
- irritabilité
- tolérances
- red flags
- zones GREEN / ORANGE / RED
- adaptations
- reprise graduée
- critères de réévaluation
- orientation vers professionnel

### Principe

Le moteur reste :

```text
non diagnostique
non médical
adaptatif
conservateur en présence de red flags
```

RED doit toujours avoir priorité sur les adaptations normales.

---

## JSON clinique existant

### Rôle actuel

Le JSON encode déjà :

- sources
- evidence ratings
- red flags
- zone rules
- tolerance dimensions
- modifications
- condition records

### Limite architecturale majeure

Le schéma mélange actuellement :

1. connaissances générales
2. état dynamique d’un utilisateur

Exemples de champs runtime :

```text
testedLoad
symptomDuring
symptomAfter24h
irritability
```

Ces données ne doivent pas vivre dans la KB scientifique canonique.

---

# 3. Architecture canonique proposée

## Domaines

```text
provenance/
evidence/
training/
anatomy/
exercises/
clinical/
policy/
```

`policy/` contient les choix de sécurité du produit qui ne sont pas directement des vérités scientifiques.

Exemple :

```text
douleur ≤ 3/10
```

peut être une politique conservatrice FitTrack sans être présentée comme un seuil universel validé.

---

# 4. Entités principales

## Evidence / provenance

- Claim
- Source
- EvidenceAssessment
- EvidenceConflict
- EvidenceGap
- CorpusFile
- CorpusFragment
- ReviewDecision

## Programmation

- Population
- Outcome
- TrainingVariable
- PracticalRule
- DecisionRule

## Anatomie / exercices

- Muscle
- MuscleRegion
- JointAction
- MovementPattern
- Exercise
- ExerciseVariant
- Equipment
- ResistanceProfile
- ExerciseConstraint
- SubstitutionRelation

## Clinique

- Condition
- Symptom
- RedFlag
- SafetyZone
- ToleranceDimension
- AdaptationRule
- Contraindication

## Produit

- ProductSafetyPolicy

---

# 5. Principe clé : Claim atomique

Une `Claim` représente **une seule affirmation**.

Exemple conceptuel :

```json
{
  "id": "claim.training.volume.001",
  "canonicalStatement": "L’augmentation du volume hebdomadaire tend à augmenter l’hypertrophie jusqu’à un point de rendements décroissants.",
  "domain": "training",
  "subject": "weekly_volume",
  "knowledgeType": "EVIDENCE",
  "epistemicStatus": "ESTABLISHED_DIRECTION",
  "confidence": "HIGH",
  "directness": "DIRECT_OUTCOME",
  "population": ["resistance_training_adults"],
  "conditions": [],
  "exceptions": [],
  "limitations": [
    "Le volume optimal individuel n’est pas établi.",
    "Les bénéfices marginaux diminuent à mesure que le volume augmente."
  ],
  "practicalInterpretation": "Utiliser le volume comme variable progressive et individualisable.",
  "cannotConclude": [
    "Il n’existe pas un nombre universel optimal de séries par muscle et par semaine."
  ],
  "supportingSources": [],
  "contradictingSources": [],
  "contextSources": [],
  "corpusFragments": [],
  "validationState": "NORMALIZED",
  "revision": 1
}
```

---

# 6. Enums épistémiques

## knowledgeType

```text
EVIDENCE
EXPERT_PRACTICE
HYPOTHESIS
ANATOMICAL_FACT
BIOMECHANICAL_OBSERVATION
PRODUCT_POLICY
```

---

## epistemicStatus

```text
ESTABLISHED
ESTABLISHED_DIRECTION
PROBABLE
UNCERTAIN
CONTROVERSIAL
MECHANISTIC
EMPIRICAL
UNKNOWN
```

---

## directness

```text
DIRECT_OUTCOME
DIRECT_CLINICAL
INDIRECT_CLINICAL
BIOMECHANICAL
EMG_ONLY
MECHANISTIC
EXPERT_ONLY
```

---

# 7. Source

Le schéma Source doit accepter les références incomplètes.

Il ne faut jamais inventer :

- année
- DOI
- PMID
- auteurs
- URL
- journal

Exemple :

```json
{
  "id": "source.001",
  "title": "Titre disponible dans le corpus",
  "authors": [],
  "year": null,
  "journal": null,
  "doi": null,
  "pmid": null,
  "officialUrl": null,
  "documentType": "UNKNOWN",
  "resolutionStatus": "UNRESOLVED",
  "isOld": null,
  "notes": []
}
```

Valeurs possibles :

```text
RESOLVED
PARTIALLY_RESOLVED
UNRESOLVED
AMBIGUOUS
DUPLICATE_CANDIDATE
```

---

# 8. Provenance complète

Chaîne recommandée :

```text
Source publication
        ↑
CitationOccurrence
        ↑
CorpusFragment
        ↑
Claim
        ↑
Entity / Rule / View
```

Un `CorpusFragment` doit conserver :

```text
corpusFileId
headingPath
startLine
endLine
rawText
contentHash
```

Cela permet de remonter depuis une règle générée jusqu’au texte exact du corpus.

---

# 9. Exercise et ExerciseVariant

Il faut séparer :

## Exercise

Concept général.

Exemple :

```text
Triceps extension
Bench press
Lat pulldown
Squat
```

## ExerciseVariant

Exécution précise.

Exemple :

```text
Overhead cable triceps extension
Neutral-grip lat pulldown
High-bar back squat
45-degree leg press
```

---

# 10. Exemple ExerciseVariant

```json
{
  "id": "exercise_variant.triceps.overhead_cable_extension",
  "exerciseId": "exercise.triceps_extension",
  "canonicalName": "Overhead cable triceps extension",
  "aliases": [],
  "movementPattern": ["elbow_extension"],
  "jointActions": [
    "elbow_extension"
  ],
  "equipment": ["cable"],
  "bodyPosition": "standing_or_seated",
  "support": null,
  "resistanceProfile": {
    "type": "cable",
    "claimRefs": []
  },
  "muscleRelations": [
    {
      "muscle": "triceps_long_head",
      "relation": "target",
      "claimRefs": []
    }
  ],
  "lengthenedBias": {
    "status": "SUPPORTED",
    "claimRefs": []
  },
  "axialLoad": "LOW",
  "lumbarDemand": "UNKNOWN",
  "progressionPotential": {
    "value": "HIGH",
    "knowledgeType": "EXPERT_PRACTICE"
  },
  "unknowns": [],
  "claimRefs": []
}
```

Les champs dérivés comme `primaryMuscles` peuvent être matérialisés dans une projection, mais la KB canonique doit conserver les claims qui les justifient.

---

# 11. EvidenceAssessment

Une même Claim peut avoir plusieurs évaluations dans le temps.

```json
{
  "id": "assessment.claim001.rev1",
  "claimId": "claim.training.volume.001",
  "confidence": "HIGH",
  "directness": "DIRECT_OUTCOME",
  "evidenceHierarchy": "SYSTEMATIC_REVIEW",
  "reviewer": "pipeline",
  "reviewDate": "2026-08-23",
  "rationale": "Plusieurs synthèses convergent sur une relation dose-réponse avec rendements décroissants.",
  "revision": 1
}
```

La certitude historique ne doit jamais être écrasée.

---

# 12. EvidenceConflict

Les contradictions doivent être conservées explicitement.

```json
{
  "id": "conflict.rom.001",
  "claimIds": [
    "claim.rom.001",
    "claim.rom.002"
  ],
  "dimensions": [
    "INTERVENTION",
    "EXERCISE",
    "OUTCOME_MEASUREMENT"
  ],
  "status": "ACTIVE",
  "explanation": "Les résultats diffèrent selon le mouvement, la portion de ROM étudiée et la méthode de mesure."
}
```

Dimensions possibles :

```text
POPULATION
TRAINING_STATUS
SEX
AGE
INTERVENTION
COMPARATOR
VOLUME
LOAD
EFFORT
FREQUENCY
EXERCISE
MODALITY
DURATION
OUTCOME
OUTCOME_MEASUREMENT
STATISTICAL_POWER
EVIDENCE_TYPE
OTHER
UNKNOWN
```

---

# 13. EvidenceGap

L’absence d’étude doit être distinguée d’un résultat négatif.

```json
{
  "id": "gap.elbow_load.001",
  "topic": "elbow_joint_load_recreational_resistance_training",
  "status": "NO_DIRECT_EVIDENCE_IDENTIFIED",
  "notes": [
    "Le corpus ne fournit pas de preuve directe suffisante permettant d’établir un seuil de charge lésionnelle."
  ]
}
```

---

# 14. SubstitutionRelation

Les substitutions ne doivent pas être de simples listes.

```json
{
  "id": "substitution.001",
  "fromExerciseVariantId": "exercise_variant.a",
  "toExerciseVariantId": "exercise_variant.b",
  "equivalenceLevel": "ACCEPTABLE",
  "matchedDimensions": [
    "movement_pattern",
    "target_region",
    "stability"
  ],
  "differentDimensions": [
    "resistance_profile"
  ],
  "claimRefs": []
}
```

Niveaux :

```text
QUASI_DIRECT
ACCEPTABLE
PARTIAL
```

---

# 15. Joint constraints

Les contraintes articulaires ne doivent jamais être encodées comme :

```text
safe
dangerous
```

Mais comme :

```text
charge_mecanique
inconfort_rapporte
risque_demontre
risque_suppose
```

Exemple :

```json
{
  "joint": "shoulder",
  "constraintType": "charge_mecanique",
  "description": "Position associée à une modification de la demande mécanique.",
  "claimRefs": []
}
```

---

# 16. Clinique : séparation KB / runtime

## KB canonique

Contient :

```text
Condition
Symptom
RedFlag
AdaptationRule
SafetyZone
ToleranceDimension definition
Contraindication
DecisionRule
```

## Runtime utilisateur

Contient :

```text
ToleranceObservation
SymptomObservation
IrritabilityState
ExerciseResponse
DelayedResponse
ClinicianInstruction
```

---

# 17. Exemple runtime

```json
{
  "userId": "local-user",
  "exerciseVariantId": "exercise_variant.example",
  "toleranceDimension": "lumbar_extension",
  "status": "CONDITIONALLY_TOLERATED",
  "testedLoad": "40 kg",
  "symptomDuring": 2,
  "symptomAfter24h": 1,
  "basis": "USER_REPORT",
  "timestamp": "2026-08-23T00:00:00Z"
}
```

Cette donnée ne fait pas partie de la vérité scientifique globale.

---

# 18. Condition

```json
{
  "id": "condition.low_back_pain_nonspecific",
  "canonicalName": "Non-specific low back pain",
  "aliases": [],
  "scope": "SYMPTOM_PATTERN",
  "diagnosticRole": "NON_DIAGNOSTIC_REFERENCE",
  "claimRefs": [],
  "redFlagRefs": [],
  "adaptationRuleRefs": [],
  "uncertaintyRefs": []
}
```

---

# 19. RedFlag

```json
{
  "id": "redflag.progressive_neurological_deficit",
  "question": "Présence d’une faiblesse neurologique nouvelle ou progressive ?",
  "positiveExamples": [],
  "action": "STOP_AND_REFER",
  "urgency": "URGENT",
  "claimRefs": [],
  "policyRefs": []
}
```

---

# 20. AdaptationRule

```json
{
  "id": "adaptation.pain.reduce_rom",
  "trigger": {
    "type": "SYMPTOM_RESPONSE"
  },
  "action": {
    "type": "MODIFY_ROM"
  },
  "monitoring": [
    "during_session",
    "immediate_post",
    "delayed_24_48h"
  ],
  "stopCriteria": [],
  "claimRefs": [],
  "policyRefs": []
}
```

---

# 21. ProductSafetyPolicy

Certaines règles sont des choix de prudence du produit.

Exemple :

```json
{
  "id": "policy.pain.default_green_threshold",
  "type": "PRODUCT_SAFETY_POLICY",
  "statement": "FitTrack peut utiliser un seuil conservateur de douleur faible pour la zone GREEN.",
  "scientificStatus": "NOT_UNIVERSAL_THRESHOLD",
  "claimRefs": [],
  "notes": [
    "Ce seuil ne doit pas être présenté comme une frontière médicale ou biologique universelle."
  ]
}
```

---

# 22. Migration du JSON clinique existant

| Élément actuel | Nouveau modèle |
|---|---|
| `globalSafety.disclaimer` | `ProductSafetyPolicy` / metadata |
| `redFlags` | `RedFlag` |
| `zoneLogic` | `SafetyZone` + `DecisionRule` |
| `source` | `Source` |
| `evidenceRating` | `EvidenceAssessment` |
| `toleranceDimension` | définition KB + observation runtime |
| `modification` | `AdaptationRule` |
| `condition` | `Condition` |
| `aliases` | conservé |
| `diagnosticCertainty` | conservé |
| `questions` | `DecisionRule.inputRequirements` |
| références red flags | refs vers `RedFlag` |
| `irritability` | runtime |
| sensitivities / tolerances | claims population + runtime utilisateur |
| recommendations | `AdaptationRule` |
| contraindications | `Contraindication` |
| referral | `DecisionRule` |
| progression | `DecisionRule` |
| regression | `DecisionRule` |
| `evidenceLevel` global | supprimé au profit d’évaluations par assertion |
| `sources` répétées | registre global `Source` |
| `uncertainty` | `Claim` / `EvidenceGap` |
| `expertPractice` | `Claim` avec `knowledgeType = EXPERT_PRACTICE` |

---

# 23. Stockage canonique

## Décision de modélisation recommandée

Utiliser :

```text
JSONL par type d’entité
JSON pour vocabulaires/configuration
JSON Schema pour validation
```

Exemple :

```text
canonical/
├── claims.jsonl
├── sources.jsonl
├── evidence-assessments.jsonl
├── evidence-conflicts.jsonl
├── evidence-gaps.jsonl
├── exercises.jsonl
├── exercise-variants.jsonl
├── conditions.jsonl
├── red-flags.jsonl
└── adaptation-rules.jsonl
```

---

# 24. Séparation des couches

```text
raw/
extracted/
canonical/
projections/
```

## raw

Copie immuable du corpus.

## extracted

Sortie intermédiaire brute du parser / LLM.

## canonical

Entités validées et normalisées.

## projections

Wiki, index vectoriel, graphes, packs de contexte IA, etc.

---

# 25. Stable IDs

Les IDs ne doivent pas dépendre entièrement du contenu.

Recommandation :

```text
ID métier stable
+
contentHash technique
+
revision
```

Exemple :

```json
{
  "id": "claim.training.volume.001",
  "revision": 3,
  "contentHash": "sha256:..."
}
```

Une modification du texte n’entraîne pas automatiquement un nouvel ID.

---

# 26. Versioning

Version globale possible :

```text
2026.08.23.1
```

Avec :

```text
Git commit
Git tag
KB version
entity revision
review history
```

---

# 27. États de revue

```text
EXTRACTED
NORMALIZED
AUTO_VALIDATED
REVIEW_REQUIRED
APPROVED
REJECTED
SUPERSEDED
```

---

# 28. Pipeline d’ingestion

```text
1. ingestion
2. structural parsing
3. citation extraction
4. candidate extraction
5. epistemic classification
6. entity normalization
7. source resolution
8. deduplication
9. relation generation
10. conflict detection
11. JSON Schema validation
12. integrity validation
13. targeted human review
14. versioned publication
15. projections
```

---

# 29. Responsabilités du pipeline

## 1 — Ingestion

Entrée :

```text
Markdown / JSON source
```

Sortie :

```text
CorpusFile
```

Déterministe.

---

## 2 — Structural parsing

Découpe :

```text
titre
section
sous-section
table
paragraphe
liste
citation
```

Sortie :

```text
CorpusFragment
```

Principalement déterministe.

---

## 3 — Citation extraction

Détecte :

```text
auteurs
année
DOI
PMID
URL
référence textuelle
```

Ne remplit jamais une donnée manquante par intuition.

---

## 4 — Candidate extraction

Le LLM peut proposer :

```text
ClaimCandidate
EntityCandidate
RuleCandidate
```

Mais ce ne sont pas encore des objets canoniques.

---

## 5 — Epistemic classification

Classe :

```text
EVIDENCE
EMG_ONLY
BIOMECHANICAL
EXPERT_PRACTICE
HYPOTHESIS
...
```

---

## 6 — Normalization

Transforme les candidats vers les schemas.

Règle :

```text
certainty(output) ≤ certainty(source)
```

---

## 7 — Source resolution

Fusion / résolution des citations.

Cas possibles :

```text
resolved
partial
ambiguous
unresolved
duplicate
```

---

## 8 — Deduplication

Ne pas fusionner automatiquement deux claims uniquement parce qu’ils semblent similaires.

Comparer :

```text
population
intervention
comparison
outcome
conditions
certainty
directness
```

---

## 9 — Relations

Création des liens :

```text
Claim → Source
Claim → Population
Claim → Exercise
Claim → Muscle
Claim → Outcome
Rule → Claim
Conflict → Claim
```

---

## 10 — Conflict detection

Les divergences sont enregistrées, pas écrasées.

---

## 11 — Schema validation

Validation JSON Schema stricte.

---

## 12 — Integrity validation

Contrôles sémantiques.

---

## 13 — Human review

Uniquement sur les objets à risque :

```text
ambiguïté source
contradiction importante
contraindication
red flag
règle clinique
claim à forte conséquence
fusion incertaine
```

---

## 14 — Publication

Création d’une version immuable de la KB.

---

## 15 — Projection

Génération :

```text
wiki
search index
vector index
graph
AI context packs
runtime decision tables
```

---

# 30. Ce qu’un LLM ne doit jamais faire seul

Le LLM ne doit jamais :

- supprimer un conflit
- inventer une citation
- compléter arbitrairement un DOI
- transformer EMG → hypertrophie
- transformer charge mécanique → danger
- transformer pratique experte → preuve établie
- transformer hypothèse → règle forte
- créer une contraindication absolue sans justification
- augmenter le niveau de certitude
- fusionner automatiquement des sources ambiguës

---

# 31. Invariants / tests qualité

## QC-001

Chaque Claim canonique doit référencer au moins un `CorpusFragment`.

## QC-002

Chaque `sourceRef` doit résoudre vers une Source connue.

## QC-003

Aucune métadonnée bibliographique absente ne peut être inventée.

## QC-004

Une preuve `EMG_ONLY` ne peut générer :

```text
greaterHypertrophy = true
```

## QC-005

Une observation biomécanique seule ne peut produire automatiquement :

```text
injuryRisk = HIGH
contraindicated = true
```

## QC-006

`EXPERT_PRACTICE` ne peut devenir `ESTABLISHED`.

## QC-007

`HYPOTHESIS` ne peut devenir une règle normative forte.

## QC-008

Une contraindication absolue exige :

```text
red flag
ou instruction professionnelle
ou justification explicite dans le corpus
```

## QC-009

Une projection ne peut pas augmenter la certitude.

## QC-010

`cannotConclude` doit être préservé.

## QC-011

Un seuil numérique présenté comme heuristique dans le corpus ne peut devenir un seuil universel.

## QC-012

La zone RED prévaut toujours sur les adaptations normales.

---

# 32. Critères d’acceptation V1

La V1 est acceptable si :

- 100 % des claims ont une provenance
- toutes les références internes résolvent
- les sources incomplètes restent incomplètes
- aucun EMG-only n’est présenté comme preuve directe d’hypertrophie
- aucune charge biomécanique seule n’est convertie en danger
- aucune pratique experte n’est présentée comme fait établi
- aucune hypothèse n’est transformée en vérité
- RED override fonctionne
- les contraindications sont justifiées
- les contradictions sont conservées
- les inconnues restent inconnues
- la reconstruction est idempotente
- l’extraction est incrémentale
- l’historique de revue est conservé
- toutes les projections peuvent être reconstruites depuis le canonique

---

# 33. Projections

## Wiki

Le wiki doit être généré depuis la KB.

Il ne doit pas être édité comme source principale.

---

## Recherche vectorielle

La vector DB est un index secondaire.

Elle doit pouvoir être supprimée et reconstruite.

Elle ne contient pas la vérité canonique.

---

## IA locale

Le moteur IA peut recevoir des context packs structurés :

```text
user state
+
relevant claims
+
exercise definitions
+
decision rules
+
safety rules
```

---

## Règles exécutables

Certaines règles peuvent être compilées de manière déterministe :

```text
RedFlag
SafetyZone
DecisionRule
AdaptationRule
```

---

# 34. Décisions ouvertes recommandées

| Sujet | Recommandation |
|---|---|
| format canonique | JSONL |
| cœur du modèle | Claim central, mais pas unique |
| exercice | séparer Exercise / ExerciseVariant |
| muscles primaires | matérialisation + claim refs |
| langue canonique | français au départ |
| traduction | labels localisés séparément |
| Source required fields | minimum faible |
| métadonnées absentes | null / unresolved |
| runtime clinique | hors KB |
| score global de preuve | éviter |
| contradictions | entité dédiée |
| stable IDs | registre stable |
| hash | utilisé pour changements, pas comme identité |
| vector DB | projection secondaire |
| sécurité produit | séparée des faits scientifiques |

---

# 35. Plan d’implémentation par étapes

## Phase A — Contrat

Créer :

```text
IDs
enums
schemas
invariants
arborescence
policies
```

Pas d’extracteur.

---

## Phase B — Provenance

Créer :

```text
CorpusFile
CorpusFragment
Source
CitationOccurrence
```

---

## Phase C — Evidence Core

Créer :

```text
Claim
EvidenceAssessment
EvidenceConflict
EvidenceGap
Population
Outcome
```

---

## Phase D — Domaines

Ordre recommandé :

```text
training
anatomy
exercise
clinical
```

Le clinique passe en dernier car il a le plus de conséquences de sécurité.

---

## Phase E — Review system

Créer :

```text
ReviewDecision
review queue
history
```

---

## Phase F — Extracteur

Seulement une fois les schemas stabilisés.

---

## Phase G — Projections

Créer ensuite :

```text
wiki
AI index
vector DB
graph
runtime rules
```

---

# 36. Contrat de sortie exact pour la phase suivante

```text
fittrack-kb/
├── README.md
├── ARCHITECTURE.md
├── ID_POLICY.md
├── VERSIONING.md
├── REVIEW_WORKFLOW.md
├── schemas/
│   ├── common.schema.json
│   ├── claim.schema.json
│   ├── source.schema.json
│   ├── evidence-assessment.schema.json
│   ├── evidence-conflict.schema.json
│   ├── evidence-gap.schema.json
│   ├── population.schema.json
│   ├── outcome.schema.json
│   ├── training-variable.schema.json
│   ├── decision-rule.schema.json
│   ├── exercise.schema.json
│   ├── exercise-variant.schema.json
│   ├── anatomy.schema.json
│   ├── substitution-relation.schema.json
│   ├── condition.schema.json
│   ├── symptom.schema.json
│   ├── red-flag.schema.json
│   ├── safety-zone.schema.json
│   ├── adaptation-rule.schema.json
│   ├── contraindication.schema.json
│   ├── corpus-file.schema.json
│   ├── corpus-fragment.schema.json
│   ├── review-decision.schema.json
│   └── product-safety-policy.schema.json
├── vocab/
│   ├── knowledge-types.json
│   ├── epistemic-statuses.json
│   ├── evidence-modalities.json
│   ├── directness.json
│   ├── confidence-levels.json
│   ├── document-types.json
│   ├── movement-patterns.json
│   ├── joint-actions.json
│   ├── equipment.json
│   ├── constraint-types.json
│   ├── substitution-levels.json
│   ├── safety-zones.json
│   ├── diagnostic-certainty.json
│   └── conflict-dimensions.json
├── mappings/
│   ├── legacy-clinical-schema-migration.json
│   ├── source-field-mapping.json
│   └── corpus-section-routing.json
├── policies/
│   ├── epistemic-guardrails.md
│   ├── clinical-safety-guardrails.md
│   ├── provenance-policy.md
│   └── projection-certainty-policy.md
├── extraction-contract/
│   ├── fragment-contract.schema.json
│   ├── claim-candidate.schema.json
│   ├── entity-candidate.schema.json
│   ├── citation-candidate.schema.json
│   └── review-queue-item.schema.json
└── tests/
    ├── acceptance-criteria.md
    ├── invariants.json
    └── fixtures/
```

---

# 37. Principe final

La qualité de cette KB ne dépend pas principalement du nombre de documents ingérés.

Elle dépend surtout de sa capacité à **ne pas perdre la nuance** pendant la transformation :

```text
limitations
conflicts
evidence type
directness
population
uncertainty
cannotConclude
expert practice
hypothesis
provenance
```

Le pire échec serait de transformer des rapports scientifiques nuancés en une base de données plus simple mais plus certaine que les sources.

Le modèle doit donc être conçu pour préserver l’incertitude plutôt que pour la supprimer.

---

# Fin du rapport
