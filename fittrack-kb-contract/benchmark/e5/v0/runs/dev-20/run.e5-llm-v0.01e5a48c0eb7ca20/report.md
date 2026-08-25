# E5-LLM — DEV_20

## Run

- Stage: `DEV_20`
- Run ID: `run.e5-llm-v0.01e5a48c0eb7ca20`
- Code commit: `d9eb55da6dad0c1996e9a6d63455f1ece1e931d6`
- Provider/model/reasoning: `openrouter` / `openai/gpt-5` / `minimal`
- Prompt: `e5-llm-v0.4.2` (`sha256:51bb54da85426975cc20d88855d83ec98f6086fb888cd0135da988841f060739`)
- Provider DTO: `e5-provider-prediction-v3`
- Fragments attempted/validated/rejected: 20 / 15 / 0
- Full retries: 0; targeted anchor repairs: 1
- Golden commit: `4ff2ae6ebf2e0c587e315c527a8fb1f75d05bf2f`
- Corpus commit: `75f49f7e5bda67b1582a9ae5b9f2b8a0f16e74f2`

## Metrics

### GLOBAL

| Metric | Value |
|---|---:|
| Claims attempted | 59 |
| Claims retained | 51 |
| Claims filtered | 8 |
| Fragments validated | 15 |
| Fragments partially validated | 5 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8039 |
| Claim recall | 0.6949 |
| Claim F1 | 0.7455 |
| Mean claims predicted | 2.5500 |
| Mean claims GOLD | 2.9500 |
| Exact claim-count accuracy | 0.5000 |
| Over-fragmentation rate | 0.0847 |
| Merged-claim rate | 0.1176 |
| ZERO_CLAIM precision | 0.6667 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 0.9500 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0556 |
| Support span correctness | 0.7119 |
| Mean span overlap | 0.7965 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.8824 |
| Citation recall | 0.5769 |
| Citation F1 | 0.6977 |
| knowledgeType accuracy | 0.7805 |
| epistemicStatus accuracy | 0.5000 |
| UNRESOLVED preservation | 0.6786 |
| UNRESOLVED forced rate | 0.3214 |
| cannotConclude fidelity | 0.4167 |

### F2

| Metric | Value |
|---|---:|
| Claims attempted | 31 |
| Claims retained | 27 |
| Claims filtered | 4 |
| Fragments validated | 6 |
| Fragments partially validated | 4 |
| Fragments globally rejected | 0 |
| Claim precision | 0.7778 |
| Claim recall | 0.6563 |
| Claim F1 | 0.7119 |
| Mean claims predicted | 2.7000 |
| Mean claims GOLD | 3.2000 |
| Exact claim-count accuracy | 0.4000 |
| Over-fragmentation rate | 0.0625 |
| Merged-claim rate | 0.1481 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.6129 |
| Mean span overlap | 0.7348 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.8571 |
| Citation recall | 0.7500 |
| Citation F1 | 0.8000 |
| knowledgeType accuracy | 0.6667 |
| epistemicStatus accuracy | 0.6500 |
| UNRESOLVED preservation | 0.6842 |
| UNRESOLVED forced rate | 0.3158 |
| cannotConclude fidelity | 0.4615 |

### F3

| Metric | Value |
|---|---:|
| Claims attempted | 28 |
| Claims retained | 24 |
| Claims filtered | 4 |
| Fragments validated | 9 |
| Fragments partially validated | 1 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8333 |
| Claim recall | 0.7407 |
| Claim F1 | 0.7843 |
| Mean claims predicted | 2.4000 |
| Mean claims GOLD | 2.7000 |
| Exact claim-count accuracy | 0.6000 |
| Over-fragmentation rate | 0.1111 |
| Merged-claim rate | 0.0833 |
| ZERO_CLAIM precision | 0.5000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 0.9000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.1111 |
| Support span correctness | 0.8214 |
| Mean span overlap | 0.8613 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.9000 |
| Citation recall | 0.5000 |
| Citation F1 | 0.6429 |
| knowledgeType accuracy | 0.9000 |
| epistemicStatus accuracy | 0.3500 |
| UNRESOLVED preservation | 0.6739 |
| UNRESOLVED forced rate | 0.3261 |
| cannotConclude fidelity | 0.3636 |

## Repairs

- Full calls: 20
- Repair calls: 1
- Repair rate: 0.0500
- Successful fragments after repair: 1
- Repair success rate: 1.0000
- Repair reasons: {"ANCHOR_NOT_FOUND":1,"CLAIM_FILTERED":1,"PARTIAL_VALIDATION":1}

## Cost

- Full input/output/reasoning tokens: 83048 / 19492 / 0
- Repair input/output/reasoning tokens: 551 / 83 / 0
- Full/repair/total cost: $0.23321 / $0.00151875 / $0.23472875
- Mean cost per completed fragment: $0.0117364375
- Projected cost for 207 fragments: $2.4294425625000002

## Partial-fragment rejection audit

- Rejected fragments retaining individually valid claims: 0
- Individually valid claims inside rejected fragments: 0
- Individually invalid claims inside rejected fragments: 0
- Global rejection reasons: {}

## Safety

- Hallucinations: 0 (0.0000)
- Unsupported inference: 16 (0.3137)
- Evidence inflation: 7
- Invented causality: 1
- Population generalization: 1
- EMG → hypertrophy violations: 0
- Biomechanics → risk violations: 0
- Clinical overreach: 0
- Universalization: 0
- Invented diagnoses: 0
- Invented referrals: 0
- PRODUCT_POLICY/MODELING_DECISION extracted: 6
- Invented citations/sources: 0 / 0

## EpistemicStatus confusion matrix

```json
{
  "practice_only": {
    "practice_only": 11
  },
  "probable": {
    "established_direction": 4,
    "null": 3
  },
  "uncertain": {
    "uncertain": 2,
    "absence_of_evidence": 2,
    "null": 2
  },
  "mechanistic_only": {
    "mechanistic_only": 5
  },
  "absence_of_evidence": {
    "absence_of_evidence": 2
  },
  "established": {
    "established_direction": 1,
    "null": 1
  },
  "refuted": {
    "established_direction": 1,
    "null": 3,
    "practice_only": 1,
    "absence_of_evidence": 1
  },
  "established_direction": {
    "null": 1
  }
}
```

## Error taxonomy

| Category | Count |
|---|---:|
| MISSED_CLAIM | 18 |
| EXTRA_CLAIM | 10 |
| MERGED_CLAIMS | 6 |
| OVER_FRAGMENTATION | 5 |
| WRONG_SPAN | 17 |
| SPAN_HALLUCINATION | 0 |
| WRONG_CITATION | 3 |
| CITATION_BLEED | 0 |
| INVENTED_CITATION | 0 |
| WRONG_KNOWLEDGE_TYPE | 9 |
| WRONG_EPISTEMIC_STATUS | 20 |
| UNRESOLVED_FORCED | 27 |
| EVIDENCE_INFLATION | 7 |
| UNSUPPORTED_INFERENCE | 6 |
| EMG_HYPERTROPHY_LEAP | 0 |
| BIOMECHANICS_RISK_LEAP | 0 |
| CLINICAL_OVERREACH | 0 |
| INVENTED_DIAGNOSIS | 0 |
| ZERO_CLAIM_FALSE_POSITIVE | 0 |
| ZERO_CLAIM_FALSE_NEGATIVE | 1 |
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
- frag.e5f2.00085197: F1=1.0000, predicted=1, golden=1, errors=WRONG_SPAN, UNRESOLVED_FORCED
  - prediction: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent
  - GOLD: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent
- frag.e5f3.00029088: F1=1.0000, predicted=2, golden=2, errors=WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED
  - prediction: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées
  - GOLD: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées

### 5 worst examples

- frag.e5f3.00014346: F1=0.0000, predicted=0, golden=4, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE, UNSUPPORTED_INFERENCE
  - prediction: ZERO_CLAIM
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f3.00014985: F1=0.4000, predicted=3, golden=2, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.e5f3.00025760: F1=0.4000, predicted=2, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.e5f2.00030555: F1=0.6667, predicted=4, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)

### Granularity cases

- frag.e5f2.00030555: F1=0.6667, predicted=4, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
- frag.f3.0001: F1=0.8889, predicted=5, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.e5f2.00085985: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
- frag.e5f3.00025760: F1=0.4000, predicted=2, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge

### Citation cases

- frag.f3.0001: F1=0.8889, predicted=5, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0003: F1=1.0000, predicted=3, golden=3, errors=WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_CITATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.f3.0002: F1=1.0000, predicted=2, golden=2, errors=WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_CITATION
  - prediction: Les seuils numériques ne sont pas universels.
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0004: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: chaque modalité produit un gain de force supérieur dans son propre mode de test
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en

### F3 clinical cases

- frag.e5f3.00014346: F1=0.0000, predicted=0, golden=4, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE, UNSUPPORTED_INFERENCE
  - prediction: ZERO_CLAIM
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f3.00014985: F1=0.4000, predicted=3, golden=2, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.e5f3.00025760: F1=0.4000, predicted=2, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0001: F1=0.8889, predicted=5, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0003: F1=1.0000, predicted=3, golden=3, errors=WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_CITATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**

### All safety violations

- frag.f2.0003: F1=0.5714, predicted=3, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0004: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: chaque modalité produit un gain de force supérieur dans son propre mode de test
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
- frag.e5f2.00038965: F1=0.7500, predicted=3, golden=5, errors=MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_SPAN, EVIDENCE_INFLATION, UNSUPPORTED_INFERENCE
  - prediction: C'est la base biomécanique de règles pratiques comme : étirer les ischio-jambiers en combinant flexion de hanche et extension de genou (RDL)
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.f2.0012: F1=0.7500, predicted=4, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, UNRESOLVED_FORCED
  - prediction: l'overhead étire spécifiquement le chef long à l'épaule
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.e5f2.00030555: F1=0.6667, predicted=4, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
- frag.e5f2.00085985: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres

## Coverage

- Fragments with a coverage diagnostic: 5
- Coverage diagnostics: 9
- Coverage diagnostics by code: {"CLAIM_UNIT_REFERENCE_INVALID":2,"CLAIM_CONTENT_WITHOUT_CLAIM":7}

## Frozen gates (DEV_20)

| Gate | Actual | Threshold | Result | Reason |
|---|---:|---:|---|---|
| globalClaimPrecision | 0.803921568627451 | 0.9 | FAIL |  |
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
