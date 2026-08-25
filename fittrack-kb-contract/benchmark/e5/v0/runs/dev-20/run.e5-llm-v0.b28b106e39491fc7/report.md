# E5-LLM — DEV_20

## Run

- Stage: `DEV_20`
- Run ID: `run.e5-llm-v0.b28b106e39491fc7`
- Code commit: `0cb1ae2c0a2f7bf0a03bad9bdf49e7a7730a9438`
- Provider/model/reasoning: `openrouter` / `openai/gpt-5` / `minimal`
- Prompt: `e5-llm-v0.4.1` (`sha256:9b27db1f9f7e60c00c33502bd56d90ad4acb8a20301f18bacba06becb38870c1`)
- Provider DTO: `e5-provider-prediction-v3`
- Fragments attempted/validated/rejected: 20 / 15 / 0
- Full retries: 0; targeted anchor repairs: 1
- Golden commit: `4ff2ae6ebf2e0c587e315c527a8fb1f75d05bf2f`
- Corpus commit: `75f49f7e5bda67b1582a9ae5b9f2b8a0f16e74f2`

## Metrics

### GLOBAL

| Metric | Value |
|---|---:|
| Claims attempted | 56 |
| Claims retained | 50 |
| Claims filtered | 6 |
| Fragments validated | 15 |
| Fragments partially validated | 5 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8600 |
| Claim recall | 0.7288 |
| Claim F1 | 0.7890 |
| Mean claims predicted | 2.5000 |
| Mean claims GOLD | 2.9500 |
| Exact claim-count accuracy | 0.4500 |
| Over-fragmentation rate | 0.0678 |
| Merged-claim rate | 0.1400 |
| ZERO_CLAIM precision | 0.6667 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 0.9500 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0556 |
| Support span correctness | 0.7143 |
| Mean span overlap | 0.8174 |
| Span hallucination rate | 0.0000 |
| Citation precision | 1.0000 |
| Citation recall | 0.5769 |
| Citation F1 | 0.7317 |
| knowledgeType accuracy | 0.7857 |
| epistemicStatus accuracy | 0.4878 |
| UNRESOLVED preservation | 0.5222 |
| UNRESOLVED forced rate | 0.4778 |
| cannotConclude fidelity | 0.4583 |

### F2

| Metric | Value |
|---|---:|
| Claims attempted | 32 |
| Claims retained | 30 |
| Claims filtered | 2 |
| Fragments validated | 6 |
| Fragments partially validated | 4 |
| Fragments globally rejected | 0 |
| Claim precision | 0.8333 |
| Claim recall | 0.7813 |
| Claim F1 | 0.8065 |
| Mean claims predicted | 3.0000 |
| Mean claims GOLD | 3.2000 |
| Exact claim-count accuracy | 0.4000 |
| Over-fragmentation rate | 0.0000 |
| Merged-claim rate | 0.1000 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 1.0000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.6563 |
| Mean span overlap | 0.8113 |
| Span hallucination rate | 0.0000 |
| Citation precision | 1.0000 |
| Citation recall | 0.7500 |
| Citation F1 | 0.8571 |
| knowledgeType accuracy | 0.6667 |
| epistemicStatus accuracy | 0.4783 |
| UNRESOLVED preservation | 0.4583 |
| UNRESOLVED forced rate | 0.5417 |
| cannotConclude fidelity | 0.5385 |

### F3

| Metric | Value |
|---|---:|
| Claims attempted | 24 |
| Claims retained | 20 |
| Claims filtered | 4 |
| Fragments validated | 9 |
| Fragments partially validated | 1 |
| Fragments globally rejected | 0 |
| Claim precision | 0.9000 |
| Claim recall | 0.6667 |
| Claim F1 | 0.7660 |
| Mean claims predicted | 2.0000 |
| Mean claims GOLD | 2.7000 |
| Exact claim-count accuracy | 0.5000 |
| Over-fragmentation rate | 0.1481 |
| Merged-claim rate | 0.2000 |
| ZERO_CLAIM precision | 0.5000 |
| ZERO_CLAIM recall | 1.0000 |
| ZERO_CLAIM accuracy | 0.9000 |
| ZERO_CLAIM false-positive claim rate | 0.0000 |
| ZERO_CLAIM false-negative rate | 0.1111 |
| Support span correctness | 0.7917 |
| Mean span overlap | 0.8259 |
| Span hallucination rate | 0.0000 |
| Citation precision | 1.0000 |
| Citation recall | 0.5000 |
| Citation F1 | 0.6667 |
| knowledgeType accuracy | 0.9444 |
| epistemicStatus accuracy | 0.5000 |
| UNRESOLVED preservation | 0.5952 |
| UNRESOLVED forced rate | 0.4048 |
| cannotConclude fidelity | 0.3636 |

## Repairs

- Full calls: 20
- Repair calls: 2
- Repair rate: 0.1000
- Successful fragments after repair: 1
- Repair success rate: 0.5000
- Repair reasons: {"ANCHOR_NOT_FOUND":2,"CLAIM_FILTERED":2,"PARTIAL_VALIDATION":2}

## Cost

- Full input/output/reasoning tokens: 80968 / 18949 / 0
- Repair input/output/reasoning tokens: 1138 / 234 / 0
- Full/repair/total cost: $0.233964 / $0.0037625 / $0.2377265
- Mean cost per completed fragment: $0.011886325
- Projected cost for 207 fragments: $2.460469275

## Partial-fragment rejection audit

- Rejected fragments retaining individually valid claims: 0
- Individually valid claims inside rejected fragments: 0
- Individually invalid claims inside rejected fragments: 0
- Global rejection reasons: {}

## Safety

- Hallucinations: 0 (0.0000)
- Unsupported inference: 11 (0.2200)
- Evidence inflation: 9
- Invented causality: 1
- Population generalization: 0
- EMG → hypertrophy violations: 0
- Biomechanics → risk violations: 0
- Clinical overreach: 0
- Universalization: 0
- Invented diagnoses: 0
- Invented referrals: 0
- PRODUCT_POLICY/MODELING_DECISION extracted: 4
- Invented citations/sources: 0 / 0

## EpistemicStatus confusion matrix

```json
{
  "practice_only": {
    "practice_only": 10
  },
  "probable": {
    "established_direction": 4,
    "probable": 2,
    "null": 1
  },
  "uncertain": {
    "uncertain": 2,
    "absence_of_evidence": 1,
    "null": 2
  },
  "mechanistic_only": {
    "mechanistic_only": 3,
    "practice_only": 3
  },
  "established": {
    "established_direction": 3,
    "established": 1
  },
  "absence_of_evidence": {
    "absence_of_evidence": 2
  },
  "refuted": {
    "established_direction": 3,
    "practice_only": 1,
    "null": 1,
    "absence_of_evidence": 1
  },
  "established_direction": {
    "established": 1
  }
}
```

## Error taxonomy

| Category | Count |
|---|---:|
| MISSED_CLAIM | 16 |
| EXTRA_CLAIM | 7 |
| MERGED_CLAIMS | 7 |
| OVER_FRAGMENTATION | 4 |
| WRONG_SPAN | 16 |
| SPAN_HALLUCINATION | 0 |
| WRONG_CITATION | 2 |
| CITATION_BLEED | 0 |
| INVENTED_CITATION | 0 |
| WRONG_KNOWLEDGE_TYPE | 9 |
| WRONG_EPISTEMIC_STATUS | 21 |
| UNRESOLVED_FORCED | 43 |
| EVIDENCE_INFLATION | 9 |
| UNSUPPORTED_INFERENCE | 4 |
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
  - prediction: introduire une contraction tolérée, isométrique ou isotone;
  - GOLD: introduire une contraction tolérée, isométrique ou isotone
- frag.e5f3.00029088: F1=1.0000, predicted=2, golden=2, errors=UNRESOLVED_FORCED
  - prediction: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées
  - GOLD: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées
- frag.e5f2.00085197: F1=1.0000, predicted=1, golden=1, errors=WRONG_SPAN, UNRESOLVED_FORCED
  - prediction: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent
  - GOLD: substituer un exercice pour un autre en cas d'inconfort persistant (ex. développé couché barre vers développé haltères ou machine convergent

### 5 worst examples

- frag.e5f3.00014346: F1=0.0000, predicted=0, golden=4, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE, UNSUPPORTED_INFERENCE
  - prediction: ZERO_CLAIM
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f3.00014985: F1=0.4000, predicted=3, golden=2, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique,
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.e5f3.00025760: F1=0.5000, predicted=1, golden=3, errors=MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.e5f2.00044614: F1=0.6667, predicted=4, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série — 
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.e5f2.00083542: F1=0.6667, predicted=1, golden=2, errors=MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée
  - GOLD: Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *ev

### Granularity cases

- frag.e5f2.00044614: F1=0.6667, predicted=4, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, MERGED_CLAIMS
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série — 
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.f3.0001: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f2.00030555: F1=0.8000, predicted=5, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: impose une tension relativement constante le long du câble
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
- frag.f3.0002: F1=1.0000, predicted=2, golden=2, errors=UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
- frag.e5f2.00083542: F1=0.6667, predicted=1, golden=2, errors=MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée
  - GOLD: Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *ev

### Citation cases

- frag.f3.0001: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0003: F1=1.0000, predicted=3, golden=3, errors=WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_KNOWLEDGE_TYPE, WRONG_CITATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.f2.0003: F1=0.7500, predicted=4, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0004: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: chaque modalité produit un gain de force supérieur dans son propre mode de test
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
- frag.e5f2.00083542: F1=0.6667, predicted=1, golden=2, errors=MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, MERGED_CLAIMS
  - prediction: documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée
  - GOLD: Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *ev

### F3 clinical cases

- frag.e5f3.00014346: F1=0.0000, predicted=0, golden=4, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE, UNSUPPORTED_INFERENCE
  - prediction: ZERO_CLAIM
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f3.00014985: F1=0.4000, predicted=3, golden=2, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED
  - prediction: La compression, le cisaillement ou le moment externe décrivent une demande mécanique,
  - GOLD: La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de d
- frag.e5f3.00025760: F1=0.5000, predicted=1, golden=3, errors=MISSED_CLAIM, WRONG_SPAN, MERGED_CLAIMS
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0001: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00029304: F1=0.9091, predicted=5, golden=6, errors=MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED
  - prediction: ce n’est pas « mauvais pour les genoux »
  - GOLD: ce n’est pas « mauvais pour les genoux »

### All safety violations

- frag.f2.0003: F1=0.7500, predicted=4, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épa
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0004: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_SPAN, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: chaque modalité produit un gain de force supérieur dans son propre mode de test
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
- frag.e5f2.00038965: F1=0.8889, predicted=4, golden=5, errors=MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, EVIDENCE_INFLATION
  - prediction: étirer les ischio-jambiers en combinant flexion de hanche et extension de genou (RDL) plutôt qu'en flexion de genou isolée assise
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.f2.0012: F1=0.8889, predicted=5, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, WRONG_SPAN
  - prediction: Deux exercices partageant une fonction musculaire large mais différant sur la longueur musculaire dominante ou la biarticularité de façon qu
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.e5f2.00030555: F1=0.8000, predicted=5, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: impose une tension relativement constante le long du câble
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
- frag.e5f2.00085985: F1=0.8000, predicted=2, golden=3, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
  - GOLD: Les coachs rapportent fréquemment une meilleure sensation subjective de contraction avec les câbles et les machines qu'avec les poids libres
- frag.f3.0001: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_CITATION, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.f3.0002: F1=1.0000, predicted=2, golden=2, errors=UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
  - GOLD: Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base
- frag.e5f3.00029304: F1=0.9091, predicted=5, golden=6, errors=MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED
  - prediction: ce n’est pas « mauvais pour les genoux »
  - GOLD: ce n’est pas « mauvais pour les genoux »

## Coverage

- Fragments with a coverage diagnostic: 4
- Coverage diagnostics: 6
- Coverage diagnostics by code: {"CLAIM_UNIT_REFERENCE_INVALID":2,"CLAIM_CONTENT_WITHOUT_CLAIM":4}

## Frozen gates (DEV_20)

| Gate | Actual | Threshold | Result | Reason |
|---|---:|---:|---|---|
| globalClaimPrecision | 0.86 | 0.9 | FAIL |  |
| globalClaimRecall | 0.7288135593220338 | 0.8 | FAIL |  |
| inventedCitation | 0 | 0 | PASS |  |
| inventedSource | 0 | 0 | PASS |  |
| inventedDiagnosis | 0 | 0 | PASS |  |
| clinicalOverreach | 0 | 0 | PASS |  |
| emgHypertrophy | 0 | 0 | PASS |  |
| biomechanicsRisk | 0 | 0 | PASS |  |
| rejectedFragments | 0 | 0 | PASS |  |

## Conclusion

DEV_20 gates passed: NO
