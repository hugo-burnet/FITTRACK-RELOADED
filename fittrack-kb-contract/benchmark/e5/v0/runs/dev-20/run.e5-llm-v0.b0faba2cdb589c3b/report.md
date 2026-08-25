# E5-LLM — DEV_20

## Run

- Stage: `DEV_20`
- Run ID: `run.e5-llm-v0.b0faba2cdb589c3b`
- Code commit: `b6b8071488636ab61aa6fe81a5fccb2166aea0af`
- Provider/model/reasoning: `openrouter` / `openai/gpt-5` / `minimal`
- Prompt: `e5-llm-v0.4.0` (`sha256:ca9d01e80ae512b603b009963fdf0c3b214abbbe7a02b49e5f2c15dbbf925174`)
- Provider DTO: `e5-provider-prediction-v3`
- Fragments attempted/validated/rejected: 20 / 18 / 0
- Full retries: 0; targeted anchor repairs: 1
- Golden commit: `4ff2ae6ebf2e0c587e315c527a8fb1f75d05bf2f`
- Corpus commit: `75f49f7e5bda67b1582a9ae5b9f2b8a0f16e74f2`

## Metrics

### GLOBAL

| Metric | Value |
|---|---:|
| Claims attempted | 50 |
| Claims retained | 48 |
| Claims filtered | 2 |
| Fragments validated | 18 |
| Fragments partially validated | 2 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8542 |
| Claim recall | 0.6949 |
| Claim F1 | 0.7664 |
| Mean claims predicted | 2.4000 |
| Mean claims GOLD | 2.9500 |
| Exact claim-count accuracy | 0.4500 |
| Over-fragmentation rate | 0.0508 |
| Merged-claim rate | 0.2292 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.6000 |
| Mean span overlap | 0.7594 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.9412 |
| Citation recall | 0.6154 |
| Citation F1 | 0.7442 |
| knowledgeType accuracy | 0.6750 |
| epistemicStatus accuracy | 0.5385 |
| UNRESOLVED preservation | 0.5060 |
| UNRESOLVED forced rate | 0.4940 |
| cannotConclude fidelity | 0.5000 |

### F2

| Metric | Value |
|---|---:|
| Claims attempted | 28 |
| Claims retained | 26 |
| Claims filtered | 2 |
| Fragments validated | 8 |
| Fragments partially validated | 2 |
| Fragments globally rejected | 0 |
| Claim precision | 0.7692 |
| Claim recall | 0.6250 |
| Claim F1 | 0.6897 |
| Mean claims predicted | 2.6000 |
| Mean claims GOLD | 3.2000 |
| Exact claim-count accuracy | 0.5000 |
| Over-fragmentation rate | 0.0000 |
| Merged-claim rate | 0.1923 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.5714 |
| Mean span overlap | 0.7233 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.8333 |
| Citation recall | 0.6250 |
| Citation F1 | 0.7143 |
| knowledgeType accuracy | 0.5789 |
| epistemicStatus accuracy | 0.5556 |
| UNRESOLVED preservation | 0.3243 |
| UNRESOLVED forced rate | 0.6757 |
| cannotConclude fidelity | 0.4000 |

### F3

| Metric | Value |
|---|---:|
| Claims attempted | 22 |
| Claims retained | 22 |
| Claims filtered | 0 |
| Fragments validated | 10 |
| Fragments partially validated | 0 |
| Fragments globally rejected | 0 |
| Claim precision | 0.9545 |
| Claim recall | 0.7778 |
| Claim F1 | 0.8571 |
| Mean claims predicted | 2.2000 |
| Mean claims GOLD | 2.7000 |
| Exact claim-count accuracy | 0.4000 |
| Over-fragmentation rate | 0.1111 |
| Merged-claim rate | 0.2727 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.6364 |
| Mean span overlap | 0.7938 |
| Span hallucination rate | 0.0000 |
| Citation precision | 1.0000 |
| Citation recall | 0.6111 |
| Citation F1 | 0.7586 |
| knowledgeType accuracy | 0.7619 |
| epistemicStatus accuracy | 0.5238 |
| UNRESOLVED preservation | 0.6522 |
| UNRESOLVED forced rate | 0.3478 |
| cannotConclude fidelity | 0.5714 |

## Repairs

- Full calls: 20
- Repair calls: 1
- Repair rate: 0.0500
- Successful fragments after repair: 0
- Repair success rate: 0.0000
- Repair reasons: {"ANCHOR_NOT_FOUND":1,"CLAIM_FILTERED":1,"PARTIAL_VALIDATION":1}

## Cost

- Full input/output/reasoning tokens: 77462 / 17939 / 0
- Repair input/output/reasoning tokens: 585 / 150 / 0
- Full/repair/total cost: $0.2284095 / $0.00223125 / $0.23064075
- Mean cost per completed fragment: $0.0115320375
- Projected cost for 207 fragments: $2.3871317625

## Partial-fragment rejection audit

- Rejected fragments retaining individually valid claims: 0
- Individually valid claims inside rejected fragments: 0
- Individually invalid claims inside rejected fragments: 0
- Global rejection reasons: {}

## Safety

- Hallucinations: 0 (0.0000)
- Unsupported inference: 7 (0.1458)
- Evidence inflation: 6
- Invented causality: 1
- Population generalization: 0
- EMG → hypertrophy violations: 0
- Biomechanics → risk violations: 0
- Clinical overreach: 0
- Universalization: 0
- Invented diagnoses: 0
- Invented referrals: 0
- PRODUCT_POLICY/MODELING_DECISION extracted: 0
- Invented citations/sources: 0 / 0

## EpistemicStatus confusion matrix

```json
{
  "probable": {
    "established_direction": 2,
    "null": 1,
    "probable": 1
  },
  "uncertain": {
    "uncertain": 3,
    "established_direction": 1,
    "mechanistic_only": 1
  },
  "mechanistic_only": {
    "mechanistic_only": 4,
    "practice_only": 3
  },
  "practice_only": {
    "practice_only": 8
  },
  "established": {
    "established_direction": 1,
    "established": 3
  },
  "refuted": {
    "probable": 3,
    "practice_only": 1,
    "mechanistic_only": 1,
    "absence_of_evidence": 1
  },
  "absence_of_evidence": {
    "absence_of_evidence": 1
  },
  "established_direction": {
    "practice_only": 3,
    "established_direction": 1
  }
}
```

## Error taxonomy

| Category | Count |
|---|---:|
| MISSED_CLAIM | 18 |
| EXTRA_CLAIM | 7 |
| MERGED_CLAIMS | 11 |
| OVER_FRAGMENTATION | 3 |
| WRONG_SPAN | 20 |
| SPAN_HALLUCINATION | 0 |
| WRONG_CITATION | 4 |
| CITATION_BLEED | 0 |
| INVENTED_CITATION | 0 |
| WRONG_KNOWLEDGE_TYPE | 13 |
| WRONG_EPISTEMIC_STATUS | 18 |
| UNRESOLVED_FORCED | 41 |
| EVIDENCE_INFLATION | 6 |
| UNSUPPORTED_INFERENCE | 0 |
| EMG_HYPERTROPHY_LEAP | 0 |
| BIOMECHANICS_RISK_LEAP | 0 |
| CLINICAL_OVERREACH | 0 |
| INVENTED_DIAGNOSIS | 0 |
| ZERO_CLAIM_FALSE_POSITIVE | 0 |
| ZERO_CLAIM_FALSE_NEGATIVE | 0 |
| INVENTED_SOURCE | 0 |
| INVALID_JSON | 0 |
| SCHEMA_FAILURE | 0 |
| PROVIDER_ERROR | 0 |
| MISSING_PREDICTION | 0 |

## Qualitative sample

### 5 best examples

- frag.e5f2.00000087: F1=1.0000, predicted=0, golden=0, errors=none
  - prediction: ZERO_CLAIM
  - GOLD: ZERO_CLAIM
- frag.e5f3.00000076: F1=1.0000, predicted=0, golden=0, errors=none
  - prediction: ZERO_CLAIM
  - GOLD: ZERO_CLAIM
- frag.e5f3.00013464: F1=1.0000, predicted=1, golden=1, errors=UNRESOLVED_FORCED
  - prediction: introduire une contraction tolérée, isométrique ou isotone
  - GOLD: introduire une contraction tolérée, isométrique ou isotone
- frag.e5f3.00029088: F1=1.0000, predicted=2, golden=2, errors=UNRESOLVED_FORCED
  - prediction: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées
  - GOLD: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées
- frag.e5f2.00085197: F1=1.0000, predicted=1, golden=1, errors=WRONG_SPAN, UNRESOLVED_FORCED
  - prediction: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent
  - GOLD: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent

### 5 worst examples

- frag.e5f2.00030555: F1=0.5000, predicted=3, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: impose une tension relativement constante le long du câble (aux frottements de poulie près)
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
- frag.e5f2.00083542: F1=0.5000, predicted=2, golden=2, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée, avec des domaines où l'expérienc
  - GOLD: Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *ev
- frag.e5f3.00025760: F1=0.5000, predicted=1, golden=3, errors=MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge; un consensus d
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0012: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, MERGED_CLAIMS
  - prediction: Deux exercices partageant une fonction musculaire large mais différant sur la longueur musculaire dominante ou la biarticularité de façon qu
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas

### Granularity cases

- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0012: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, MERGED_CLAIMS
  - prediction: Deux exercices partageant une fonction musculaire large mais différant sur la longueur musculaire dominante ou la biarticularité de façon qu
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.f3.0001: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00014346: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f2.00030555: F1=0.5000, predicted=3, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: impose une tension relativement constante le long du câble (aux frottements de poulie près)
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)

### Citation cases

- frag.f2.0012: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, MERGED_CLAIMS
  - prediction: Deux exercices partageant une fonction musculaire large mais différant sur la longueur musculaire dominante ou la biarticularité de façon qu
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.f3.0001: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0003: F1=0.8000, predicted=2, golden=3, errors=MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_CITATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: Bombements, protrusions et autres signes dégénératifs sont fréquents chez les personnes asymptomatiques et augmentent avec l’âge; ils doiven
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.f3.0002: F1=1.0000, predicted=2, golden=2, errors=UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, WRONG_CITATION
  - prediction: Les seuils numériques ne sont pas universels.
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice

### F3 clinical cases

- frag.e5f3.00025760: F1=0.5000, predicted=1, golden=3, errors=MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge; un consensus d
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.e5f3.00014985: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.f3.0003: F1=0.8000, predicted=2, golden=3, errors=MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_CITATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: Bombements, protrusions et autres signes dégénératifs sont fréquents chez les personnes asymptomatiques et augmentent avec l’âge; ils doiven
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.f3.0001: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00014346: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci

### All safety violations

- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0004: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, WRONG_SPAN
  - prediction: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
- frag.e5f2.00044614: F1=0.8000, predicted=5, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série — 
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.e5f2.00038965: F1=0.8889, predicted=4, golden=5, errors=MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, EVIDENCE_INFLATION
  - prediction: C'est la base biomécanique de règles pratiques comme : étirer les ischio-jambiers en combinant flexion de hanche et extension de genou (RDL)
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.e5f2.00085985: F1=0.8000, predicted=2, golden=3, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres

## Coverage

- Fragments with a coverage diagnostic: 1
- Coverage diagnostics: 1
- Coverage diagnostics by code: {"CLAIM_CONTENT_WITHOUT_CLAIM":1}

## Frozen gates (DEV_20)

| Gate | Actual | Threshold | Result | Reason |
|---|---:|---:|---|---|
| globalClaimPrecision | 0.8541666666666666 | 0.9 | FAIL |  |
| globalClaimRecall | 0.6949152542372882 | 0.8 | FAIL |  |
| inventedCitation | 0 | 0 | PASS |  |
| inventedSource | 0 | 0 | PASS |  |
| inventedDiagnosis | 0 | 0 | PASS |  |
| clinicalOverreach | 0 | 0 | PASS |  |
| emgHypertrophy | 0 | 0 | PASS |  |
| biomechanicsRisk | 0 | 0 | PASS |  |
| rejectedFragments | 0 | 0 | PASS |  |

## Conclusion

DEV_20 gates passed: NO
