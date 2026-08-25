# E5-LLM — DEV_20

## Run

- Stage: `DEV_20`
- Run ID: `run.e5-llm-v0.a985b0496f8f60a8`
- Code commit: `8050dc889f331b145dd11c10c197dfa43784bda7`
- Provider/model/reasoning: `openrouter` / `openai/gpt-5` / `medium`
- Prompt: `e5-llm-v0.4.2` (`sha256:51bb54da85426975cc20d88855d83ec98f6086fb888cd0135da988841f060739`)
- Provider DTO: `e5-provider-prediction-v3`
- Fragments attempted/validated/rejected: 20 / 18 / 1
- Full retries: 0; targeted anchor repairs: 1
- Golden commit: `4ff2ae6ebf2e0c587e315c527a8fb1f75d05bf2f`
- Corpus commit: `75f49f7e5bda67b1582a9ae5b9f2b8a0f16e74f2`

## Metrics

### GLOBAL

| Metric | Value |
|---|---:|
| Claims attempted | 75 |
| Claims retained | 74 |
| Claims filtered | 1 |
| Fragments validated | 18 |
| Fragments partially validated | 1 |
| Fragments globally rejected | 1 |
| Claim precision | 0.6892 |
| Claim recall | 0.8644 |
| Claim F1 | 0.7669 |
| Mean claims predicted | 3.7000 |
| Mean claims GOLD | 2.9500 |
| Exact claim-count accuracy | 0.3500 |
| Over-fragmentation rate | 0.2542 |
| Merged-claim rate | 0.1216 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.6933 |
| Mean span overlap | 0.7886 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.7308 |
| Citation recall | 0.7308 |
| Citation F1 | 0.7308 |
| knowledgeType accuracy | 0.8400 |
| epistemicStatus accuracy | 0.3958 |
| UNRESOLVED preservation | 0.8411 |
| UNRESOLVED forced rate | 0.1589 |
| cannotConclude fidelity | 0.0769 |

### F2

| Metric | Value |
|---|---:|
| Claims attempted | 37 |
| Claims retained | 37 |
| Claims filtered | 0 |
| Fragments validated | 9 |
| Fragments partially validated | 0 |
| Fragments globally rejected | 1 |
| Claim precision | 0.6757 |
| Claim recall | 0.7813 |
| Claim F1 | 0.7246 |
| Mean claims predicted | 3.7000 |
| Mean claims GOLD | 3.2000 |
| Exact claim-count accuracy | 0.2000 |
| Over-fragmentation rate | 0.2813 |
| Merged-claim rate | 0.1622 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.5946 |
| Mean span overlap | 0.7407 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.8750 |
| Citation recall | 0.8750 |
| Citation F1 | 0.8750 |
| knowledgeType accuracy | 0.8750 |
| epistemicStatus accuracy | 0.5455 |
| UNRESOLVED preservation | 0.8000 |
| UNRESOLVED forced rate | 0.2000 |
| cannotConclude fidelity | 0.1000 |

### F3

| Metric | Value |
|---|---:|
| Claims attempted | 38 |
| Claims retained | 37 |
| Claims filtered | 1 |
| Fragments validated | 9 |
| Fragments partially validated | 1 |
| Fragments globally rejected | 0 |
| Claim precision | 0.7027 |
| Claim recall | 0.9630 |
| Claim F1 | 0.8125 |
| Mean claims predicted | 3.7000 |
| Mean claims GOLD | 2.7000 |
| Exact claim-count accuracy | 0.5000 |
| Over-fragmentation rate | 0.2222 |
| Merged-claim rate | 0.0811 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.7895 |
| Mean span overlap | 0.8347 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.6667 |
| Citation recall | 0.6667 |
| Citation F1 | 0.6667 |
| knowledgeType accuracy | 0.8077 |
| epistemicStatus accuracy | 0.2692 |
| UNRESOLVED preservation | 0.8772 |
| UNRESOLVED forced rate | 0.1228 |
| cannotConclude fidelity | 0.0625 |

## Repairs

- Full calls: 20
- Repair calls: 0
- Repair rate: 0.0000
- Successful fragments after repair: 0
- Repair success rate: n/a
- Repair reasons: {}

## Cost

- Full input/output/reasoning tokens: 83048 / 126757 / 104192
- Repair input/output/reasoning tokens: 0 / 0 / 0
- Full/repair/total cost: $1.305572 / $0 / $1.305572
- Mean cost per completed fragment: $0.06527859999999999
- Projected cost for 207 fragments: $13.512670199999999

## Partial-fragment rejection audit

- Rejected fragments retaining individually valid claims: 0
- Individually valid claims inside rejected fragments: 0
- Individually invalid claims inside rejected fragments: 0
- Global rejection reasons: {"INVALID_JSON":1}

## Safety

- Hallucinations: 0 (0.0000)
- Unsupported inference: 23 (0.3108)
- Evidence inflation: 4
- Invented causality: 0
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
    "established": 1
  },
  "probable": {
    "established_direction": 1,
    "null": 6,
    "established": 1
  },
  "uncertain": {
    "established": 1,
    "uncertain": 2,
    "absence_of_evidence": 1,
    "null": 2
  },
  "mechanistic_only": {
    "mechanistic_only": 3
  },
  "established": {
    "established": 1,
    "null": 4
  },
  "absence_of_evidence": {
    "absence_of_evidence": 2
  },
  "refuted": {
    "null": 3,
    "practice_only": 2,
    "mechanistic_only": 1,
    "absence_of_evidence": 1
  },
  "established_direction": {
    "null": 5
  }
}
```

## Error taxonomy

| Category | Count |
|---|---:|
| MISSED_CLAIM | 8 |
| EXTRA_CLAIM | 23 |
| MERGED_CLAIMS | 9 |
| OVER_FRAGMENTATION | 15 |
| WRONG_SPAN | 23 |
| SPAN_HALLUCINATION | 0 |
| WRONG_CITATION | 6 |
| CITATION_BLEED | 0 |
| INVENTED_CITATION | 0 |
| WRONG_KNOWLEDGE_TYPE | 8 |
| WRONG_EPISTEMIC_STATUS | 29 |
| UNRESOLVED_FORCED | 17 |
| EVIDENCE_INFLATION | 4 |
| UNSUPPORTED_INFERENCE | 0 |
| EMG_HYPERTROPHY_LEAP | 0 |
| BIOMECHANICS_RISK_LEAP | 0 |
| CLINICAL_OVERREACH | 1 |
| INVENTED_DIAGNOSIS | 0 |
| ZERO_CLAIM_FALSE_POSITIVE | 0 |
| ZERO_CLAIM_FALSE_NEGATIVE | 0 |
| INVENTED_SOURCE | 0 |
| INVALID_JSON | 1 |
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
- frag.e5f2.00083542: F1=1.0000, predicted=2, golden=2, errors=WRONG_SPAN
  - prediction: documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée
  - GOLD: Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *ev
- frag.e5f3.00013464: F1=1.0000, predicted=1, golden=1, errors=UNRESOLVED_FORCED
  - prediction: introduire une contraction tolérée, isométrique ou isotone
  - GOLD: introduire une contraction tolérée, isométrique ou isotone
- frag.e5f3.00029088: F1=1.0000, predicted=2, golden=2, errors=UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS
  - prediction: **Squat :** une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées
  - GOLD: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées

### 5 worst examples

- frag.e5f2.00044614: F1=0.0000, predicted=0, golden=5, errors=MISSED_CLAIM, INVALID_JSON
  - prediction: ZERO_CLAIM
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.e5f2.00038965: F1=0.5455, predicted=6, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.e5f3.00014346: F1=0.6667, predicted=8, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: renforcement/endurance du tronc
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.e5f3.00014985: F1=0.6667, predicted=4, golden=2, errors=EXTRA_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, OVER_FRAGMENTATION
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d

### Granularity cases

- frag.e5f2.00038965: F1=0.5455, predicted=6, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f2.00030555: F1=0.7692, predicted=8, golden=5, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: impose une tension relativement constante le long du câble (aux frottements de poulie près)
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
- frag.e5f3.00014346: F1=0.6667, predicted=8, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: renforcement/endurance du tronc
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.f2.0004: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: SMD −0,210 en faveur des poids libres pour les tests en poids libres
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en

### Citation cases

- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f2.00085985: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, OVER_FRAGMENTATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.f3.0002: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_KNOWLEDGE_TYPE, WRONG_CITATION
  - prediction: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base

### F3 clinical cases

- frag.e5f3.00014346: F1=0.6667, predicted=8, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: renforcement/endurance du tronc
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.e5f3.00014985: F1=0.6667, predicted=4, golden=2, errors=EXTRA_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, OVER_FRAGMENTATION
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0002: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_KNOWLEDGE_TYPE, WRONG_CITATION
  - prediction: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base

### All safety violations

- frag.f2.0003: F1=0.8889, predicted=5, golden=4, errors=EXTRA_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: produit une hypertrophie substantiellement plus importante du chef long que le même exercice réalisé bras le long du corps (position neutre)
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0004: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: SMD −0,210 en faveur des poids libres pour les tests en poids libres
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
- frag.f2.0012: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: Deux exercices partageant une fonction musculaire large mais différant sur la longueur musculaire dominante ou la biarticularité de façon qu
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge

## Coverage

- Fragments with a coverage diagnostic: 0
- Coverage diagnostics: 0
- Coverage diagnostics by code: {}

## Frozen gates (DEV_20)

| Gate | Actual | Threshold | Result | Reason |
|---|---:|---:|---|---|
| globalClaimPrecision | 0.6891891891891891 | 0.9 | FAIL |  |
| globalClaimRecall | 0.864406779661017 | 0.8 | PASS |  |
| inventedCitation | 0 | 0 | PASS |  |
| inventedSource | 0 | 0 | PASS |  |
| inventedDiagnosis | 0 | 0 | PASS |  |
| clinicalOverreach | 1 | 0 | FAIL |  |
| emgHypertrophy | 0 | 0 | PASS |  |
| biomechanicsRisk | 0 | 0 | PASS |  |
| rejectedFragments | 1 | 0 | FAIL |  |

## Conclusion

DEV_20 gates passed: NO
