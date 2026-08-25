# E5-LLM — DEV_100

## Run

- Stage: `DEV_100`
- Run ID: `run.e5-llm-v0.fd82c1d8b1eb10fc`
- Code commit: `facf81337d6505d1ce90a42273d0c2cd2f810a59`
- Provider/model/reasoning: `openrouter` / `openai/gpt-5` / `medium`
- Prompt: `e5-llm-v0.4.4` (`sha256:1db57f6a9d2c11a9fb6d7a86e7f4dcab712ba743e0e75862e770c8bcf5fe2fb6`)
- Provider DTO: `e5-provider-prediction-v3`
- Fragments attempted/validated/rejected: 100 / 90 / 0
- Full retries: 0; targeted anchor repairs: 1
- Golden commit: `4ff2ae6ebf2e0c587e315c527a8fb1f75d05bf2f`
- Corpus commit: `75f49f7e5bda67b1582a9ae5b9f2b8a0f16e74f2`

## Metrics

### GLOBAL

| Metric | Value |
|---|---:|
| Claims attempted | 236 |
| Claims retained | 227 |
| Claims filtered | 9 |
| Fragments validated | 90 |
| Fragments partially validated | 10 |
| Fragments globally rejected | 0 |
| Claim precision | 0.7225 |
| Claim recall | 0.8817 |
| Claim F1 | 0.7942 |
| Mean claims predicted | 2.2700 |
| Mean claims GOLD | 1.8600 |
| Exact claim-count accuracy | 0.5900 |
| Over-fragmentation rate | 0.1720 |
| Merged-claim rate | 0.0352 |
| ZERO_CLAIM precision | 0.9355 |
| ZERO_CLAIM recall | 0.9063 |
| ZERO_CLAIM accuracy | 0.9500 |
| ZERO_CLAIM false-positive claim rate | 0.0938 |
| ZERO_CLAIM false-negative rate | 0.0294 |
| Support span correctness | 0.7627 |
| Mean span overlap | 0.8274 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.7662 |
| Citation recall | 0.6705 |
| Citation F1 | 0.7152 |
| knowledgeType accuracy | 0.6894 |
| epistemicStatus accuracy | 0.4643 |
| UNRESOLVED preservation | 0.7855 |
| UNRESOLVED forced rate | 0.2145 |
| cannotConclude fidelity | 0.1039 |

### F2

| Metric | Value |
|---|---:|
| Claims attempted | 155 |
| Claims retained | 149 |
| Claims filtered | 6 |
| Fragments validated | 44 |
| Fragments partially validated | 6 |
| Fragments globally rejected | 0 |
| Claim precision | 0.7181 |
| Claim recall | 0.8699 |
| Claim F1 | 0.7868 |
| Mean claims predicted | 2.9800 |
| Mean claims GOLD | 2.4600 |
| Exact claim-count accuracy | 0.4200 |
| Over-fragmentation rate | 0.2033 |
| Merged-claim rate | 0.0470 |
| ZERO_CLAIM precision | 1.0000 |
| ZERO_CLAIM recall | 0.8000 |
| ZERO_CLAIM accuracy | 0.9600 |
| ZERO_CLAIM false-positive claim rate | 0.2000 |
| ZERO_CLAIM false-negative rate | 0.0000 |
| Support span correctness | 0.6968 |
| Mean span overlap | 0.7795 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.7727 |
| Citation recall | 0.7083 |
| Citation F1 | 0.7391 |
| knowledgeType accuracy | 0.6250 |
| epistemicStatus accuracy | 0.4578 |
| UNRESOLVED preservation | 0.8112 |
| UNRESOLVED forced rate | 0.1888 |
| cannotConclude fidelity | 0.1702 |

### F3

| Metric | Value |
|---|---:|
| Claims attempted | 81 |
| Claims retained | 78 |
| Claims filtered | 3 |
| Fragments validated | 46 |
| Fragments partially validated | 4 |
| Fragments globally rejected | 0 |
| Claim precision | 0.7308 |
| Claim recall | 0.9048 |
| Claim F1 | 0.8085 |
| Mean claims predicted | 1.5600 |
| Mean claims GOLD | 1.2600 |
| Exact claim-count accuracy | 0.7600 |
| Over-fragmentation rate | 0.1111 |
| Merged-claim rate | 0.0128 |
| ZERO_CLAIM precision | 0.9130 |
| ZERO_CLAIM recall | 0.9545 |
| ZERO_CLAIM accuracy | 0.9400 |
| ZERO_CLAIM false-positive claim rate | 0.0455 |
| ZERO_CLAIM false-negative rate | 0.0714 |
| Support span correctness | 0.8889 |
| Mean span overlap | 0.9175 |
| Span hallucination rate | 0.0000 |
| Citation precision | 0.7576 |
| Citation recall | 0.6250 |
| Citation F1 | 0.6849 |
| knowledgeType accuracy | 0.8070 |
| epistemicStatus accuracy | 0.4737 |
| UNRESOLVED preservation | 0.7381 |
| UNRESOLVED forced rate | 0.2619 |
| cannotConclude fidelity | 0.0000 |

## Repairs

- Full calls: 100
- Repair calls: 2
- Repair rate: 0.0200
- Successful fragments after repair: 2
- Repair success rate: 1.0000
- Repair reasons: {"ANCHOR_NOT_FOUND":2,"CLAIM_FILTERED":2,"PARTIAL_VALIDATION":2,"CLAIM_CONTENT_WITHOUT_CLAIM":1}

## Cost

- Full input/output/reasoning tokens: 456616 / 437422 / 367616
- Repair input/output/reasoning tokens: 1324 / 4972 / 4672
- Full/repair/total cost: $4.553742 / $0.051375 / $4.605117
- Mean cost per completed fragment: $0.04605117
- Projected cost for 207 fragments: $9.53259219

## Partial-fragment rejection audit

- Rejected fragments retaining individually valid claims: 0
- Individually valid claims inside rejected fragments: 0
- Individually invalid claims inside rejected fragments: 0
- Global rejection reasons: {}

## Safety

- Hallucinations: 0 (0.0000)
- Unsupported inference: 64 (0.2819)
- Evidence inflation: 29
- Invented causality: 0
- Population generalization: 3
- EMG → hypertrophy violations: 0
- Biomechanics → risk violations: 0
- Clinical overreach: 2
- Universalization: 2
- Invented diagnoses: 0
- Invented referrals: 0
- PRODUCT_POLICY/MODELING_DECISION extracted: 1
- Invented citations/sources: 0 / 0

## EpistemicStatus confusion matrix

```json
{
  "practice_only": {
    "practice_only": 29,
    "established_direction": 1,
    "null": 4,
    "probable": 1,
    "mechanistic_only": 1
  },
  "probable": {
    "established_direction": 13,
    "mechanistic_only": 3,
    "established": 1,
    "probable": 1,
    "uncertain": 5,
    "null": 3
  },
  "uncertain": {
    "uncertain": 5,
    "null": 4,
    "established_direction": 2,
    "absence_of_evidence": 2,
    "mechanistic_only": 2
  },
  "absence_of_evidence": {
    "null": 2,
    "absence_of_evidence": 9
  },
  "mechanistic_only": {
    "absence_of_evidence": 2,
    "mechanistic_only": 7,
    "uncertain": 2,
    "practice_only": 3
  },
  "established": {
    "mechanistic_only": 4,
    "established": 9,
    "probable": 1,
    "null": 2
  },
  "refuted": {
    "absence_of_evidence": 4,
    "refuted": 5,
    "probable": 1,
    "practice_only": 5
  },
  "established_direction": {
    "null": 3,
    "established": 4
  }
}
```

## Error taxonomy

| Category | Count |
|---|---:|
| MISSED_CLAIM | 22 |
| EXTRA_CLAIM | 63 |
| MERGED_CLAIMS | 8 |
| OVER_FRAGMENTATION | 32 |
| WRONG_SPAN | 56 |
| SPAN_HALLUCINATION | 0 |
| WRONG_CITATION | 15 |
| CITATION_BLEED | 0 |
| INVENTED_CITATION | 0 |
| WRONG_KNOWLEDGE_TYPE | 50 |
| WRONG_EPISTEMIC_STATUS | 75 |
| UNRESOLVED_FORCED | 77 |
| EVIDENCE_INFLATION | 29 |
| UNSUPPORTED_INFERENCE | 1 |
| EMG_HYPERTROPHY_LEAP | 0 |
| BIOMECHANICS_RISK_LEAP | 0 |
| CLINICAL_OVERREACH | 2 |
| INVENTED_DIAGNOSIS | 0 |
| ZERO_CLAIM_FALSE_POSITIVE | 3 |
| ZERO_CLAIM_FALSE_NEGATIVE | 2 |
| INVENTED_SOURCE | 0 |
| INVALID_JSON | 0 |
| SCHEMA_FAILURE | 1 |
| PROVIDER_ERROR | 0 |
| MISSING_PREDICTION | 0 |

## Qualitative sample

### 5 best examples

- frag.e5f2.00000087: F1=1.0000, predicted=0, golden=0, errors=none
  - prediction: ZERO_CLAIM
  - GOLD: ZERO_CLAIM
- frag.e5f2.00000259: F1=1.0000, predicted=0, golden=0, errors=none
  - prediction: ZERO_CLAIM
  - GOLD: ZERO_CLAIM
- frag.e5f2.00086736: F1=1.0000, predicted=0, golden=0, errors=none
  - prediction: ZERO_CLAIM
  - GOLD: ZERO_CLAIM
- frag.e5f2.00091327: F1=1.0000, predicted=0, golden=0, errors=none
  - prediction: ZERO_CLAIM
  - GOLD: ZERO_CLAIM
- frag.e5f2.00095348: F1=1.0000, predicted=0, golden=0, errors=none
  - prediction: ZERO_CLAIM
  - GOLD: ZERO_CLAIM

### 5 worst examples

- frag.e5f2.00078216: F1=0.0000, predicted=2, golden=0, errors=EXTRA_CLAIM, ZERO_CLAIM_FALSE_POSITIVE
  - prediction: Un exercice ne peut être remplacé par un autre de façon fiable qu'en tenant compte simultanément de plusieurs dimensions, pas seulement du «
  - GOLD: ZERO_CLAIM
- frag.e5f3.00030376: F1=0.0000, predicted=0, golden=1, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE
  - prediction: ZERO_CLAIM
  - GOLD: reconstruire les mouvements spécifiques
- frag.e5f3.00020521: F1=0.0000, predicted=1, golden=1, errors=EXTRA_CLAIM, MISSED_CLAIM
  - prediction: passer temporairement du squat barre au belt squat, split squat ou presse peut réduire une exposition irritante
  - GOLD: passer temporairement du squat barre au belt squat, split squat ou presse peut réduire une exposition irritante, sans supposer que la compre
- frag.e5f3.00013618: F1=0.0000, predicted=0, golden=1, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE
  - prediction: ZERO_CLAIM
  - GOLD: ajouter vitesse, stockage-restitution d’énergie, sauts ou lancers selon l’objectif
- frag.e5f3.00011779: F1=0.0000, predicted=1, golden=0, errors=EXTRA_CLAIM, ZERO_CLAIM_FALSE_POSITIVE
  - prediction: - stable ou meilleure, fonction intacte → maintenir ou petite progression;
  - GOLD: ZERO_CLAIM

### Granularity cases

- frag.e5f2.00044614: F1=0.6667, predicted=7, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.e5f2.00075653: F1=0.7500, predicted=4, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_CITATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: position réduisant le bras de levier des ischio-jambiers biarticulaires par flexion de genou, isolant relativement mieux le grand fessier
  - GOLD: Les extensions de hanche à genou fléchi (position réduisant le bras de levier des ischio-jambiers biarticulaires par flexion de genou, isola
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, UNRESOLVED_FORCED, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f2.00005159: F1=0.7273, predicted=7, golden=4, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: La majorité des études d'imagerie régionale et de biomécanique porte sur de petits échantillons (souvent moins de 20 à 40 sujets)
  - GOLD: La majorité des études d'imagerie régionale et de biomécanique porte sur de petits échantillons (souvent moins de 20 à 40 sujets), majoritai
- frag.f2.0005: F1=0.5714, predicted=2, golden=5, errors=MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: détermine dans quelle mesure l'effort du pratiquant doit être partagé entre la production de force du muscle cible et la stabilisation postu
  - GOLD: La stabilité requise par un exercice — support du torse, base d'appui, guidage de la trajectoire par une machine ou un rail — détermine dans

### Citation cases

- frag.e5f2.00075653: F1=0.7500, predicted=4, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_CITATION, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: position réduisant le bras de levier des ischio-jambiers biarticulaires par flexion de genou, isolant relativement mieux le grand fessier
  - GOLD: Les extensions de hanche à genou fléchi (position réduisant le bras de levier des ischio-jambiers biarticulaires par flexion de genou, isola
- frag.f3.0001: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_CITATION, WRONG_SPAN, UNRESOLVED_FORCED, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: « Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».
  - GOLD: **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».**
- frag.e5f3.00012613: F1=0.8889, predicted=5, golden=4, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_CITATION, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, UNRESOLVED_FORCED, OVER_FRAGMENTATION
  - prediction: la **gestion de la charge suivie d’une exposition progressive**, et non le repos complet
  - GOLD: Le principe commun est la **gestion de la charge suivie d’une exposition progressive**, et non le repos complet.
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_CITATION, OVER_FRAGMENTATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.e5f3.00000822: F1=0.2500, predicted=7, golden=1, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, OVER_FRAGMENTATION
  - prediction: L’exercice est généralement une composante de première intention.
  - GOLD: Les recommandations soutiennent l’exercice pour la lombalgie chronique, la tendinopathie de la coiffe, l’épicondylalgie latérale, la douleur

### F3 clinical cases

- frag.e5f3.00030376: F1=0.0000, predicted=0, golden=1, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE
  - prediction: ZERO_CLAIM
  - GOLD: reconstruire les mouvements spécifiques
- frag.e5f3.00020521: F1=0.0000, predicted=1, golden=1, errors=EXTRA_CLAIM, MISSED_CLAIM
  - prediction: passer temporairement du squat barre au belt squat, split squat ou presse peut réduire une exposition irritante
  - GOLD: passer temporairement du squat barre au belt squat, split squat ou presse peut réduire une exposition irritante, sans supposer que la compre
- frag.e5f3.00013618: F1=0.0000, predicted=0, golden=1, errors=MISSED_CLAIM, ZERO_CLAIM_FALSE_NEGATIVE
  - prediction: ZERO_CLAIM
  - GOLD: ajouter vitesse, stockage-restitution d’énergie, sauts ou lancers selon l’objectif
- frag.e5f3.00011779: F1=0.0000, predicted=1, golden=0, errors=EXTRA_CLAIM, ZERO_CLAIM_FALSE_POSITIVE
  - prediction: - stable ou meilleure, fonction intacte → maintenir ou petite progression;
  - GOLD: ZERO_CLAIM
- frag.e5f3.00000822: F1=0.2500, predicted=7, golden=1, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_CITATION, OVER_FRAGMENTATION
  - prediction: L’exercice est généralement une composante de première intention.
  - GOLD: Les recommandations soutiennent l’exercice pour la lombalgie chronique, la tendinopathie de la coiffe, l’épicondylalgie latérale, la douleur

### All safety violations

- frag.f2.0003: F1=1.0000, predicted=4, golden=4, errors=UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: produit une hypertrophie substantiellement plus importante du chef long que le même exercice réalisé bras le long du corps (position neutre)
  - GOLD: qui étire le chef long au niveau de l'épaule pendant l'exercice
- frag.f2.0004: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: chaque modalité produit un gain de force supérieur dans son propre mode de test
  - GOLD: **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en
- frag.e5f2.00034666: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, MERGED_CLAIMS, OVER_FRAGMENTATION
  - prediction: l'entraînement réalisé lorsque le muscle est en **position étirée/allongée** produit un stimulus hypertrophique supérieur ou complémentaire 
  - GOLD: l'hypothèse que l'entraînement réalisé lorsque le muscle est en **position étirée/allongée** produit un stimulus hypertrophique supérieur ou
- frag.f2.0021: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: compare directement des répétitions partielles en position allongée à des répétitions en amplitude complète et trouve des adaptations muscul
  - GOLD: Un essai randomisé intra-sujet chez des sujets entraînés compare directement des répétitions partielles en position allongée à des répétitio
- frag.e5f2.00044614: F1=0.6667, predicted=7, golden=5, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, OVER_FRAGMENTATION
  - prediction: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
  - GOLD: une stabilité suffisante permet au muscle cible, plutôt qu'à l'équilibre ou à la coordination, de devenir le facteur limitant de la série
- frag.f2.0023: F1=0.6667, predicted=2, golden=4, errors=MISSED_CLAIM, UNRESOLVED_FORCED, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: Le développé militaire (overhead press) et les élévations latérales sollicitent fortement le complexe de la coiffe des rotateurs à des ampli
  - GOLD: Le développé militaire (overhead press) et les élévations latérales sollicitent fortement le complexe de la coiffe des rotateurs à des ampli
- frag.e5f2.00038965: F1=0.8889, predicted=4, golden=5, errors=MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, UNRESOLVED_FORCED, WRONG_SPAN, EVIDENCE_INFLATION
  - prediction: ce qu'un muscle mono-articulaire ne permet pas
  - GOLD: un muscle biarticulaire (droit fémoral, ischio-jambiers biarticulaires, chef long du triceps, chef long du biceps, gastrocnémien, grand dors
- frag.f2.0005: F1=0.5714, predicted=2, golden=5, errors=MISSED_CLAIM, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, MERGED_CLAIMS
  - prediction: détermine dans quelle mesure l'effort du pratiquant doit être partagé entre la production de force du muscle cible et la stabilisation postu
  - GOLD: La stabilité requise par un exercice — support du torse, base d'appui, guidage de la trajectoire par une machine ou un rail — détermine dans
- frag.f2.0007: F1=1.0000, predicted=1, golden=1, errors=WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: les exercices de poulie (cable crossover) imposent des moments maximaux à l'épaule significativement plus élevés que les variantes de dévelo
  - GOLD: les exercices de poulie (cable crossover) imposent des moments maximaux à l'épaule significativement plus élevés que les variantes de dévelo
- frag.f2.0012: F1=0.8000, predicted=6, golden=4, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, OVER_FRAGMENTATION
  - prediction: Deux exercices partageant une fonction musculaire large mais différant sur la longueur musculaire dominante ou la biarticularité de façon qu
  - GOLD: l'overhead étire spécifiquement le chef long à l'épaule alors que le pushdown ne le fait pas
- frag.e5f2.00030555: F1=0.9091, predicted=6, golden=5, errors=EXTRA_CLAIM, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
  - GOLD: Un système de câble/poulie impose une tension relativement constante le long du câble (aux frottements de poulie près)
- frag.e5f2.00041891: F1=1.0000, predicted=3, golden=3, errors=WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: l'amplitude complète reste une règle par défaut solide et sans inconvénient démontré pour la plupart des exercices et pratiquants.
  - GOLD: l'amplitude complète reste une règle par défaut solide et sans inconvénient démontré pour la plupart des exercices et pratiquants.
- frag.e5f2.00025178: F1=0.6667, predicted=5, golden=4, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, OVER_FRAGMENTATION
  - prediction: Le **gastrocnémien** est **biarticulaire** (fléchisseur plantaire de cheville et fléchisseur de genou)
  - GOLD: Le **gastrocnémien** est **biarticulaire** (fléchisseur plantaire de cheville et fléchisseur de genou), tandis que le **soléaire** est **mon
- frag.e5f2.00033791: F1=0.5000, predicted=2, golden=2, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_SPAN, WRONG_EPISTEMIC_STATUS, OVER_FRAGMENTATION, EVIDENCE_INFLATION
  - prediction: Les bandes élastiques ont une courbe de résistance croissante avec l'étirement (résistance minimale en position raccourcie, maximale en posi
  - GOLD: Les bandes élastiques ont une courbe de résistance croissante avec l'étirement (résistance minimale en position raccourcie, maximale en posi
- frag.e5f2.00040144: F1=1.0000, predicted=2, golden=2, errors=WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: trouve un avantage généralement en faveur de l'amplitude complète par rapport à l'amplitude partielle
  - GOLD: Une revue systématique de référence sur l'effet de l'amplitude de mouvement sur le développement musculaire trouve un avantage généralement 
- frag.e5f2.00049828: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_SPAN, UNRESOLVED_FORCED, OVER_FRAGMENTATION
  - prediction: La charge au poignet varie fortement selon la prise (barre droite, barre EZ, haltères, poignées neutres) et l'exercice.
  - GOLD: La charge au poignet varie fortement selon la prise (barre droite, barre EZ, haltères, poignées neutres) et l'exercice.
- frag.f2.0022: F1=0.8571, predicted=3, golden=4, errors=MISSED_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION
  - prediction: Ces variantes polyarticulaires sollicitent l'ensemble du quadriceps de façon relativement homogène selon l'étude d'hypertrophie régionale du
  - GOLD: Ces variantes polyarticulaires sollicitent l'ensemble du quadriceps de façon relativement homogène selon l'étude d'hypertrophie régionale du
- frag.f2.0010: F1=0.8000, predicted=3, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_KNOWLEDGE_TYPE, EVIDENCE_INFLATION, UNRESOLVED_FORCED, OVER_FRAGMENTATION
  - prediction: Deux exercices sollicitant le même pattern de mouvement, la même fonction musculaire principale, une longueur musculaire dominante comparabl
  - GOLD: Deux exercices sollicitant le même pattern de mouvement, la même fonction musculaire principale, une longueur musculaire dominante comparabl
- frag.e5f3.00025760: F1=0.6667, predicted=3, golden=3, errors=EXTRA_CLAIM, MISSED_CLAIM, WRONG_KNOWLEDGE_TYPE, WRONG_EPISTEMIC_STATUS, WRONG_SPAN, WRONG_CITATION, OVER_FRAGMENTATION, CLINICAL_OVERREACH
  - prediction: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies
  - GOLD: Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge
- frag.f3.0003: F1=0.8571, predicted=4, golden=3, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, WRONG_KNOWLEDGE_TYPE, UNRESOLVED_FORCED, WRONG_CITATION, OVER_FRAGMENTATION
  - prediction: L’imagerie ne dicte pas seule la programmation.
  - GOLD: **L’imagerie ne dicte pas seule la programmation.**
- frag.e5f3.00014346: F1=1.0000, predicted=4, golden=4, errors=WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, WRONG_SPAN
  - prediction: l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exercice aérobie et exercice généra
  - GOLD: Pour la lombalgie chronique, l’APTA recommande notamment renforcement/endurance du tronc, exercice multimodal, activation spécifique, exerci
- frag.e5f3.00013767: F1=0.4444, predicted=7, golden=2, errors=EXTRA_CLAIM, WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED, CLINICAL_OVERREACH
  - prediction: repos complet prolongé
  - GOLD: Les facteurs psychologiques ont des associations faibles à modérées avec douleur/fonction
- frag.e5f3.00029088: F1=1.0000, predicted=2, golden=2, errors=WRONG_EPISTEMIC_STATUS, EVIDENCE_INFLATION, UNRESOLVED_FORCED
  - prediction: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées
  - GOLD: une flexion plus profonde augmente généralement la demande fémoro-patellaire jusqu’aux amplitudes étudiées

## Coverage

- Fragments with a coverage diagnostic: 4
- Coverage diagnostics: 5
- Coverage diagnostics by code: {"CLAIM_UNIT_REFERENCE_INVALID":2,"CLAIM_CONTENT_WITHOUT_CLAIM":3}

## Frozen gates (DEV_100)

| Gate | Actual | Threshold | Result | Reason |
|---|---:|---:|---|---|
| globalClaimPrecision | 0.7224669603524229 | 0.95 | FAIL |  |
| globalClaimRecall | 0.8817204301075269 | 0.85 | PASS |  |
| f3ClaimPrecision | 0.7307692307692307 | 0.98 | FAIL |  |
| citationPrecision | 0.7662337662337663 | 0.97 | FAIL |  |
| citationRecall | 0.6704545454545454 | 0.9 | FAIL |  |
| hallucinationRate | 0 | 0.005 | PASS |  |
| inventedCitation | 0 | 0 | PASS |  |
| inventedSource | 0 | 0 | PASS |  |
| inventedDiagnosis | 0 | 0 | PASS |  |
| clinicalOverreach | 2 | 0 | FAIL |  |
| emgHypertrophy | 0 | 0 | PASS |  |
| biomechanicsRisk | 0 | 0 | PASS |  |
| rejectedFragments | 0 | 0 | PASS |  |
| knowledgeTypeAccuracy | 0.6894409937888198 | 0.9 | FAIL |  |
| epistemicStatusAccuracy | 0.4642857142857143 | 0.85 | FAIL |  |
| unresolvedFidelity | 0.7855153203342619 | 0.9 | FAIL |  |
| cannotConcludeFidelity | 0.1038961038961039 | 0.9 | FAIL |  |
| negationConservation | 1 | 0.98 | PASS |  |
| populationConservation | 0.8125 | 0.98 | FAIL |  |
| temporalityConservation | 0.8947368421052632 | 0.98 | FAIL |  |
| overmerged | 0.03524229074889868 | 0.03 | FAIL |  |
| oversplit | 0.17204301075268819 | 0.05 | FAIL |  |

## Conclusion

DEV_100 gates passed: NO
