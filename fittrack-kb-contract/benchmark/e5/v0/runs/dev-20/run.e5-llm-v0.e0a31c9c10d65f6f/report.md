# E5-LLM — DEV_20

## Run

- Stage: `DEV_20`
- Run ID: `run.e5-llm-v0.e0a31c9c10d65f6f`
- Code commit: `4b5cccb7895eca497b737dcc28c257df2567c6ff`
- Provider/model/reasoning: `openrouter` / `openai/gpt-5` / `medium`
- Prompt: `e5-llm-v0.4.3` (`sha256:263e1d7293a770faa61631d784e13b17ebc67a3591f0a4e8a1eb4f8ec31cc38f`)
- Provider DTO: `e5-provider-prediction-v3`
- Fragments attempted/validated/rejected: 20 / 17 / 0
- Full retries: 0; targeted anchor repairs: 1
- Golden commit: `4ff2ae6ebf2e0c587e315c527a8fb1f75d05bf2f`
- Corpus commit: `75f49f7e5bda67b1582a9ae5b9f2b8a0f16e74f2`

## Metrics

### GLOBAL

| Metric | Value |
|---|---:|
| Claims attempted | 66 |
| Claims retained | 63 |
| Claims filtered | 3 |
| Fragments validated | 17 |
| Fragments partially validated | 3 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8571 |
| Claim recall | 0.9153 |
| Claim F1 | 0.8852 |
| Mean claims predicted | 3.1500 |
| Mean claims GOLD | 2.9500 |
| Exact claim-count accuracy | 0.7500 |
| Over-fragmentation rate | 0.1017 |
| Merged-claim rate | 0.0159 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.7879 |
| Mean span overlap | 0.8665 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.9000 |
| Citation recall | 0.6923 |
| Citation F1 | 0.7826 |
| knowledgeType accuracy | 0.7547 |
| epistemicStatus accuracy | 0.4314 |
| UNRESOLVED preservation | 0.7838 |
| UNRESOLVED forced rate | 0.2162 |
| cannotConclude fidelity | 0.1379 |

### F2

| Metric | Value |
|---|---:|
| Claims attempted | 33 |
| Claims retained | 31 |
| Claims filtered | 2 |
| Fragments validated | 8 |
| Fragments partially validated | 2 |
| Fragments globally rejected | 0 |
| Claim precision | 0.9032 |
| Claim recall | 0.8750 |
| Claim F1 | 0.8889 |
| Mean claims predicted | 3.1000 |
| Mean claims GOLD | 3.2000 |
| Exact claim-count accuracy | 0.9000 |
| Over-fragmentation rate | 0.0625 |
| Merged-claim rate | 0.0000 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.8182 |
| Mean span overlap | 0.8939 |
| Span hallucination rate | 0.0000 |
| Citation precision | 1.0000 |
| Citation recall | 0.7500 |
| Citation F1 | 0.8571 |
| knowledgeType accuracy | 0.6296 |
| epistemicStatus accuracy | 0.6000 |
| UNRESOLVED preservation | 0.7778 |
| UNRESOLVED forced rate | 0.2222 |
| cannotConclude fidelity | 0.2308 |

### F3

| Metric | Value |
|---|---:|
| Claims attempted | 33 |
| Claims retained | 32 |
| Claims filtered | 1 |
| Fragments validated | 9 |
| Fragments partially validated | 1 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8125 |
| Claim recall | 0.9630 |
| Claim F1 | 0.8814 |
| Mean claims predicted | 3.2000 |
| Mean claims GOLD | 2.7000 |
| Exact claim-count accuracy | 0.6000 |
| Over-fragmentation rate | 0.1481 |
| Merged-claim rate | 0.0313 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.7576 |
| Mean span overlap | 0.8371 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.8571 |
| Citation recall | 0.6667 |
| Citation F1 | 0.7500 |
| knowledgeType accuracy | 0.8846 |
| epistemicStatus accuracy | 0.2692 |
| UNRESOLVED preservation | 0.7895 |
| UNRESOLVED forced rate | 0.2105 |
| cannotConclude fidelity | 0.0625 |

## Repairs

- Full calls: 20
- Repair calls: 0
- Repair rate: 0.0000
- Successful fragments after repair: 0
- Repair success rate: n/a
- Repair reasons: {}

## Cost

- Full input/output/reasoning tokens: 87408 / 112284 / 93184
- Repair input/output/reasoning tokens: 0 / 0 / 0
- Full/repair/total cost: $1.17162 / $0 / $1.17162
- Mean cost per completed fragment: $0.05858100000000001
- Projected cost for 207 fragments: $12.126267000000002

## Partial-fragment rejection audit

- Rejected fragments retaining individually valid claims: 0
- Individually valid claims inside rejected fragments: 0
- Individually invalid claims inside rejected fragments: 0
- Global rejection reasons: {}

## Safety

- Hallucinations: 0 (0.0000)
- Unsupported inference: 9 (0.1429)
- Evidence inflation: 10
- Invented causality: 1
- Population generalization: 2
- EMG → hypertrophy violations: 0
- Biomechanics → risk violations: 0
- Clinical overreach: 1
- Universalization: 1
- Invented diagnoses: 0
- Invented referrals: 0
- PRODUCT_POLICY/MODELING_DECISION extracted: 0
- Invented citations/sources: 0 / 0

## EpistemicStatus confusion matrix

```json
{
  "practice_only": {
    "practice_only": 11,
    "null": 1
  },
  "probable": {
    "established": 3,
    "uncertain": 2,
    "null": 1
  },
  "uncertain": {
    "uncertain": 4,
    "absence_of_evidence": 1,
    "null": 2
  },
  "mechanistic_only": {
    "mechanistic_only": 2,
    "absence_of_evidence": 1,
    "practice_only": 3
  },
  "established": {
    "mechanistic_only": 2,
    "established": 3,
    "null": 1
  },
  "absence_of_evidence": {
    "absence_of_evidence": 2
  },
  "refuted": {
    "null": 5,
    "mechanistic_only": 1,
    "practice_only": 1
  },
  "established_direction": {
    "established": 4,
    "null": 1
  }
}
```

## Error taxonomy

| Category | Count |
|---|---:|
| MISSED_CLAIM | 5 |
| EXTRA_CLAIM | 9 |
| MERGED_CLAIMS | 1 |
| OVER_FRAGMENTATION | 6 |
| WRONG_SPAN | 14 |
| SPAN_HALLUCINATION | 0 |
| WRONG_CITATION | 6 |
| CITATION_BLEED | 0 |
| INVENTED_CITATION | 0 |
| WRONG_KNOWLEDGE_TYPE | 13 |
| WRONG_EPISTEMIC_STATUS | 29 |
| UNRESOLVED_FORCED | 24 |
| EVIDENCE_INFLATION | 10 |
| UNSUPPORTED_INFERENCE | 0 |
| EMG_HYPERTROPHY_LEAP | 0 |
| BIOMECHANICS_RISK_LEAP | 0 |
| CLINICAL_OVERREACH | 1 |
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
- frag.e5f2.00085197: F1=1.0000, predicted=1, golden=1, errors=UNRESOLVED_FORCED
  - prediction: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent
  - GOLD: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent
- frag.e5f3.00013464: F1=1.0000, predicted=1, golden=1, errors=UNRESOLVED_FORCED
  - prediction: introduire une contraction tolérée, isométrique ou isotone
  - GOLD: introduire une contraction tolérée, isométrique ou isotone
- frag.e5f2.00083542: F1=1.0000, predicted=2, golden=2, errors=WRONG_SPAN
  - prediction: documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée
  - GOLD: Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *ev

### 5 worst examples

- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.e5f2.00085985: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, OVER_FRAGMENTATION, EVIDENCE_INFLATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00014985: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.f3.0002: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION
  - prediction: Les seuils numériques ne sont pas universels.
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base

### Granularity cases

- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f2.00044614: F1=0.8000, predicted=5, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, OVER_FRAGMENTATION
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série — 
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.e5f2.00085985: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, OVER_FRAGMENTATION, EVIDENCE_INFLATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge

### Citation cases

- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.e5f2.00085985: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, OVER_FRAGMENTATION, EVIDENCE_INFLATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0002: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION
  - prediction: Les seuils numériques ne sont pas universels.
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base

### F3 clinical cases

- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00014985: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.f3.0002: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION
  - prediction: Les seuils numériques ne sont pas universels.
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**

### All safety violations

- frag.f2.0003: F1=1.0000, predicted=4, golden=4, errors=UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0012: F1=1.0000, predicted=4, golden=4, errors=WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, WRONG_SPAN
  - prediction: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.e5f2.00085985: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, OVER_FRAGMENTATION, EVIDENCE_INFLATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.e5f3.00014346: F1=1.0000, predicted=4, golden=4, errors=WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED
  - prediction: l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exercice aérobie et exercice généra
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci

## Coverage

- Fragments with a coverage diagnostic: 1
- Coverage diagnostics: 1
- Coverage diagnostics by code: {"CLAIM_CONTENT_WITHOUT_CLAIM":1}

## Frozen gates (DEV_20)

| Gate | Actual | Threshold | Result | Reason |
|---|---:|---:|---|---|
| globalClaimPrecision | 0.8571428571428571 | 0.9 | FAIL |  |
| globalClaimRecall | 0.9152542372881356 | 0.8 | PASS |  |
| inventedCitation | 0 | 0 | PASS |  |
| inventedSource | 0 | 0 | PASS |  |
| inventedDiagnosis | 0 | 0 | PASS |  |
| clinicalOverreach | 1 | 0 | FAIL |  |
| emgHypertrophy | 0 | 0 | PASS |  |
| biomechanicsRisk | 0 | 0 | PASS |  |
| rejectedFragments | 0 | 0 | PASS |  |

## Conclusion

DEV_20 gates passed: NO
