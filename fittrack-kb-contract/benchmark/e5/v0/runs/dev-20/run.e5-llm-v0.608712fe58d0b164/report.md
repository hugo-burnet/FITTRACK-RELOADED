# E5-LLM — DEV_20

## Run

- Stage: `DEV_20`
- Run ID: `run.e5-llm-v0.608712fe58d0b164`
- Code commit: `f53f52cf96bde9e168174537d5acd120816d271f`
- Provider/model/reasoning: `openrouter` / `openai/gpt-5` / `medium`
- Prompt: `e5-llm-v0.4.4` (`sha256:1db57f6a9d2c11a9fb6d7a86e7f4dcab712ba743e0e75862e770c8bcf5fe2fb6`)
- Provider DTO: `e5-provider-prediction-v3`
- Fragments attempted/validated/rejected: 20 / 17 / 0
- Full retries: 0; targeted anchor repairs: 1
- Golden commit: `4ff2ae6ebf2e0c587e315c527a8fb1f75d05bf2f`
- Corpus commit: `75f49f7e5bda67b1582a9ae5b9f2b8a0f16e74f2`

## Metrics

### GLOBAL

| Metric | Value |
|---|---:|
| Claims attempted | 68 |
| Claims retained | 66 |
| Claims filtered | 2 |
| Fragments validated | 17 |
| Fragments partially validated | 3 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8182 |
| Claim recall | 0.9153 |
| Claim F1 | 0.8640 |
| Mean claims predicted | 3.3000 |
| Mean claims GOLD | 2.9500 |
| Exact claim-count accuracy | 0.6000 |
| Over-fragmentation rate | 0.1186 |
| Merged-claim rate | 0.0606 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.7500 |
| Mean span overlap | 0.8359 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.9000 |
| Citation recall | 0.6923 |
| Citation F1 | 0.7826 |
| knowledgeType accuracy | 0.8302 |
| epistemicStatus accuracy | 0.4902 |
| UNRESOLVED preservation | 0.7807 |
| UNRESOLVED forced rate | 0.2193 |
| cannotConclude fidelity | 0.1071 |

### F2

| Metric | Value |
|---|---:|
| Claims attempted | 34 |
| Claims retained | 33 |
| Claims filtered | 1 |
| Fragments validated | 8 |
| Fragments partially validated | 2 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8485 |
| Claim recall | 0.8750 |
| Claim F1 | 0.8615 |
| Mean claims predicted | 3.3000 |
| Mean claims GOLD | 3.2000 |
| Exact claim-count accuracy | 0.6000 |
| Over-fragmentation rate | 0.0938 |
| Merged-claim rate | 0.1212 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.6765 |
| Mean span overlap | 0.7949 |
| Span hallucination rate | 0.0000 |
| Citation precision | 1.0000 |
| Citation recall | 0.6250 |
| Citation F1 | 0.7692 |
| knowledgeType accuracy | 0.7778 |
| epistemicStatus accuracy | 0.4800 |
| UNRESOLVED preservation | 0.7544 |
| UNRESOLVED forced rate | 0.2456 |
| cannotConclude fidelity | 0.2500 |

### F3

| Metric | Value |
|---|---:|
| Claims attempted | 34 |
| Claims retained | 33 |
| Claims filtered | 1 |
| Fragments validated | 9 |
| Fragments partially validated | 1 |
| Fragments globally rejected | 0 |
| Claim precision | 0.7879 |
| Claim recall | 0.9630 |
| Claim F1 | 0.8667 |
| Mean claims predicted | 3.3000 |
| Mean claims GOLD | 2.7000 |
| Exact claim-count accuracy | 0.6000 |
| Over-fragmentation rate | 0.1481 |
| Merged-claim rate | 0.0000 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.8235 |
| Mean span overlap | 0.8800 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.8667 |
| Citation recall | 0.7222 |
| Citation F1 | 0.7879 |
| knowledgeType accuracy | 0.8846 |
| epistemicStatus accuracy | 0.5000 |
| UNRESOLVED preservation | 0.8070 |
| UNRESOLVED forced rate | 0.1930 |
| cannotConclude fidelity | 0.0000 |

## Repairs

- Full calls: 20
- Repair calls: 1
- Repair rate: 0.0500
- Successful fragments after repair: 1
- Repair success rate: 1.0000
- Repair reasons: {"ANCHOR_NOT_FOUND":1,"CLAIM_FILTERED":1,"PARTIAL_VALIDATION":1}

## Cost

- Full input/output/reasoning tokens: 93108 / 112199 / 92928
- Repair input/output/reasoning tokens: 551 / 1618 / 1536
- Full/repair/total cost: $1.169255 / $0.01686875 / $1.18612375
- Mean cost per completed fragment: $0.059306187499999996
- Projected cost for 207 fragments: $12.2763808125

## Partial-fragment rejection audit

- Rejected fragments retaining individually valid claims: 0
- Individually valid claims inside rejected fragments: 0
- Individually invalid claims inside rejected fragments: 0
- Global rejection reasons: {}

## Safety

- Hallucinations: 0 (0.0000)
- Unsupported inference: 12 (0.1818)
- Evidence inflation: 8
- Invented causality: 1
- Population generalization: 1
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
    "practice_only": 10,
    "null": 1
  },
  "probable": {
    "established_direction": 3,
    "uncertain": 3,
    "null": 2
  },
  "uncertain": {
    "uncertain": 5,
    "absence_of_evidence": 1
  },
  "mechanistic_only": {
    "mechanistic_only": 2,
    "absence_of_evidence": 1,
    "practice_only": 3
  },
  "refuted": {
    "refuted": 5,
    "null": 2,
    "practice_only": 1
  },
  "established": {
    "null": 5
  },
  "absence_of_evidence": {
    "absence_of_evidence": 2
  },
  "established_direction": {
    "established": 4,
    "established_direction": 1
  }
}
```

## Error taxonomy

| Category | Count |
|---|---:|
| MISSED_CLAIM | 5 |
| EXTRA_CLAIM | 12 |
| MERGED_CLAIMS | 4 |
| OVER_FRAGMENTATION | 7 |
| WRONG_SPAN | 17 |
| SPAN_HALLUCINATION | 0 |
| WRONG_CITATION | 7 |
| CITATION_BLEED | 0 |
| INVENTED_CITATION | 0 |
| WRONG_KNOWLEDGE_TYPE | 9 |
| WRONG_EPISTEMIC_STATUS | 26 |
| UNRESOLVED_FORCED | 25 |
| EVIDENCE_INFLATION | 8 |
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
- frag.e5f3.00029304: F1=1.0000, predicted=6, golden=6, errors=none
  - prediction: ce n’est pas « mauvais pour les genoux ».
  - GOLD: ce n’est pas « mauvais pour les genoux »
- frag.e5f2.00083542: F1=1.0000, predicted=2, golden=2, errors=WRONG_SPAN
  - prediction: documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée
  - GOLD: Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *ev
- frag.e5f2.00085197: F1=1.0000, predicted=1, golden=1, errors=UNRESOLVED_FORCED
  - prediction: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent
  - GOLD: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent

### 5 worst examples

- frag.e5f2.00038965: F1=0.6667, predicted=4, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.e5f2.00044614: F1=0.6667, predicted=7, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.e5f3.00014985: F1=0.6667, predicted=4, golden=2, errors=EXTRA_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, OVER_FRAGMENTATION
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**

### Granularity cases

- frag.e5f2.00044614: F1=0.6667, predicted=7, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.e5f2.00038965: F1=0.6667, predicted=4, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00014985: F1=0.6667, predicted=4, golden=2, errors=EXTRA_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, OVER_FRAGMENTATION
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge

### Citation cases

- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, EVIDENCE_INFLATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.f2.0004: F1=1.0000, predicted=3, golden=3, errors=UNRESOLVED_FORCED, WRONG_SPAN, WRONG_CITATION, WRONG_EPISTEMIC_STATUS
  - prediction: chaque modalité produit un gain de force supérieur dans son propre mode de test
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
- frag.e5f2.00085985: F1=1.0000, predicted=3, golden=3, errors=UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres

### F3 clinical cases

- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.e5f3.00014985: F1=0.6667, predicted=4, golden=2, errors=EXTRA_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, OVER_FRAGMENTATION
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0002: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS
  - prediction: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, EVIDENCE_INFLATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**

### All safety violations

- frag.f2.0003: F1=1.0000, predicted=4, golden=4, errors=UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0012: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, EVIDENCE_INFLATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.e5f3.00014346: F1=1.0000, predicted=4, golden=4, errors=WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED
  - prediction: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci

## Coverage

- Fragments with a coverage diagnostic: 2
- Coverage diagnostics: 2
- Coverage diagnostics by code: {"CLAIM_UNIT_REFERENCE_INVALID":1,"CLAIM_CONTENT_WITHOUT_CLAIM":1}

## Frozen gates (DEV_20)

| Gate | Actual | Threshold | Result | Reason |
|---|---:|---:|---|---|
| globalClaimPrecision | 0.8181818181818182 | 0.9 | FAIL |  |
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
