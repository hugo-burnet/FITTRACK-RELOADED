# E5-LLM BENCHMARK v0

Ce dossier est réservé au premier benchmark froid de l’extracteur E5 sur les
100 `fragmentId` du manifest E5-P0/GOLD. Il ne contient aucune candidate de
production et aucun outil de génération n’ouvre l’adjudication GOLD.

## Chaîne

```text
Fragments E5-P0 + CitationOccurrences E5-P0
  → prompt fermé
  → adapter OpenRouter ou replay
  → E5ProviderPrediction v2 (sémantique + anchors verbatim)
  → matcher exact et unique ou réparation anchors ciblée
  → calcul déterministe des coordonnées UTF-8
  → adapter déterministe provider → canonique inchangé
  → validation canonique, spans, citations et guardrails
  → prédiction benchmark
  → comparateur GOLD séparé
```

L’interface profonde est `extractProseFragment`. Elle cache le prompt, l’unique
réparation ciblée éventuelle, la résolution des spans UTF-8, les contrôles de citations,
les guardrails et les IDs techniques. L’adapter OpenRouter et l’adapter replay sont
les deux implémentations réelles du seam modèle.

Le schéma de prédiction canonique reste l’autorité de validation locale. Le
module `createE5ProviderPredictionSchema` en dérive uniquement les vocabulaires
pour construire un DTO de transport à profondeur maximale 5. Les supports y sont
des anchors textuels exacts qui doivent apparaître une seule fois dans le fragment ;
les confiances multi-aspect restent trois arrays parallèles.
`providerPredictionToCanonical` calcule ensuite sans réseau les coordonnées UTF-8,
relit exactement les octets, rejette les overlaps et reconstruit le schéma canonique,
les IDs temporaires et le `fragmentId`.

Un anchor absent (`ANCHOR_NOT_FOUND`) ou répété
(`AMBIGUOUS_SUPPORT_ANCHOR`) autorise au plus un second appel avec un petit DTO
qui ne contient que les anchors des claims fautives. La fusion locale ne peut
modifier ni claim, ni classification, ni citation. Toute autre erreur rejette la
sortie sans régénération complète.

`projectProviderSchema` applique enfin l’allowlist Structured Outputs au DTO,
vérifie les limites Azure et journalise les contraintes retirées. `minLength`,
`uniqueItems`, les bornes d’arrays, les patterns et tous les invariants restent
appliqués après génération par Ajv et les validations E5. Le DTO n’est ni un
contrat métier ni une source utilisée par le comparateur GOLD.

## Configuration figée avant résultats

`config.gpt-5.json` est le profil principal et fixe explicitement
`openrouter-openai-gpt-5`, le prompt, le schéma, les paramètres de sampling, le
politique de zéro retry complet et d’une réparation anchors au maximum, les commits GOLD et corpus, ainsi que la base
tarifaire utilisée par l’estimation. `config.base.json` conserve le profil Sol
historique avec ses tarifs observés, sans être utilisé par les commandes
principales. Une exécution
écrit le `config.json` auditable avec `runId`, dates, hashes, liste ordonnée des
fragments, `configFile`, `runVariant`, modèle demandé/observé, ainsi que les
appels, tokens et coûts séparés entre génération complète et réparation. Les
artefacts pilote et run sont isolés par `runVariant`.

La clé est lue exclusivement depuis la variable d’environnement
`OPENROUTER_API_KEY`. Aucun fallback vers `OPENAI_API_KEY` ou vers un fichier
local n’est autorisé. La clé n’est jamais incluse dans les requêtes archivées,
les logs ou les artefacts.

## Commandes

```bash
npm run test:e5-llm
npm run benchmark:e5-v0:dry-run
npm run benchmark:e5-v0:probe
npm run benchmark:e5-v0:pilot
npm run benchmark:e5-v0:full
npm run benchmark:e5-v0:evaluate
```

Le dry-run compose et contrôle les 100 prompts sans appel API. Le pilote utilise
exactement trois cas fixés avant résultat : un F2 simple, un F2 multi-claim et
un F3 clinique à seuil numérique. Le run complet exige à la fois
`--approve-cost` et `--pilot-approved` ; ces flags empêchent un lancement massif
accidentel mais ne remplacent pas la revue manuelle du pilote.

## Artefacts

Après le run complet :

```text
benchmark/e5/v0/
  config.json
  raw-responses/<fragment>/attempt-N.json
  predictions/<fragment>.json
  diagnostics/<fragment>.json
  metrics.json
  errors.json
  qualitative-samples.json
  report.md
```

Tous les appels sont conservés avec `callType=full|repair`. Une génération
complète n’est jamais rejouée. Seuls les anchors absents ou ambigus peuvent être
réparés une fois ; un `UNRESOLVED` sémantique ou une violation de sûreté ne
déclenche aucune optimisation du contenu.

Les seuils viennent exclusivement du Design Review : ils ne sont pas ajustés
après observation des résultats. Le comparateur principal est déterministe
(spans, similarité lexicale locale, citations fermées) et n’emploie aucun juge
LLM.

## v0.4 — validation par étages

### Statuts de fragment

v0.3 ne connaissait que `VALIDATED` et `REJECTED` : une seule claim mal ancrée
faisait tomber tout le fragment, y compris ses sœurs valides. v0.4 valide claim
par claim et ajoute `PARTIALLY_VALIDATED`.

| Statut | Sens | Compté dans `rejectedFragments` |
|---|---|---|
| `VALIDATED` | Toutes les claims tentées sont retenues, couverture cohérente | non |
| `PARTIALLY_VALIDATED` | Au moins une claim filtrée, les sûres sont conservées | non |
| `REJECTED` | JSON invalide, DTO non conforme, ou erreur provider | oui |

Les claims filtrées restent au **dénominateur** des taux de sûreté
(`claimAudit.attempted`). C’est délibéré : si filtrer une hallucination la
retirait aussi du dénominateur, plus le filtre marcherait, meilleur paraîtrait
le taux d’hallucination.

### Couverture

Le DTO v3 porte un `coverageLedger` : chaque unité de couverture du fragment
reçoit une décision explicite. `auditCoverageLedger` signale les unités
manquantes, dupliquées, hors bornes, et les décisions `CLAIM_CONTENT` sans claim
correspondante. Ces diagnostics rendent le fragment partiel, jamais rejeté.

Le DTO v2 (legacy) n’a pas de ledger. Le replay v0.3 passe donc par
`legacyClaimSalvage`, qui active le sauvetage claim par claim **sans** contrôle
de couverture : exiger la couverture d’une réponse v0.3 inventerait un échec que
le modèle n’avait aucun moyen d’éviter.

### Étages, approbations et seuils

Chaque étage payant vérifie ses approbations **avant** de construire l’adaptateur
provider : un étage non approuvé ne peut pas échouer après avoir déjà dépensé un
appel.

| Étage | Fragments | Manifeste | Approbations | Seuils |
|---|---:|---|---|---|
| `DEV_20` | 20 (10/10) | `manifests/dev-20.json` | `--approve-cost` | précision ≥ 0,90 ; rappel ≥ 0,80 ; sûreté critique à zéro ; zéro rejet global |
| `DEV_100` | 100 (50/50) | `candidates/e5-prose-golden-manifest.json` | + `--dev20-approved` | gates gelées + `knowledgeType` ≥ 0,90, `epistemicStatus` ≥ 0,85, UNRESOLVED ≥ 0,90, `cannotConclude` ≥ 0,90 |
| `HOLDOUT_30` | 30 (15/15) | `manifests/holdout-30.json` | + `--dev100-frozen` + GOLD holdout validée | identiques à DEV-100 ; une métrique N/A ne passe que si la même gate est mesurée et franchie sur DEV-100 |

Aucun étage v0.4 ne peut sélectionner plus de 100 fragments. Les 207 candidats
sont la sortie de production : ils relèvent du second plan et d’une approbation
distincte.

Un replay ne reçoit **jamais** de verdict de mise en production. Il prouve une
non-régression, rien d’autre.

### Commandes v0.4

```bash
npm run benchmark:e5-v04:replay-v03 -- --source-run <run v0.3>
npm run benchmark:e5-v04:dev20:dry-run
npm run benchmark:e5-v04:dev20 -- --approve-cost
npm run benchmark:e5-v04:dev100:dry-run
npm run benchmark:e5-v04:dev100 -- --approve-cost --dev20-approved
npm run benchmark:e5-v04:holdout30:dry-run
npm run benchmark:e5-v04:holdout30 -- --approve-cost --dev20-approved --dev100-frozen
npm run holdout:e5-v04:scaffold -- --freeze <freeze.json> --output <dir>
npm run holdout:e5-v04:validate <dir>
```

### Disposition des sorties

```text
benchmark/e5/v0/
  dry-run.<STAGE>.<runVariant>.<promptVersion>.json   versionné : pièce d'approbation
  stages/dev-20/<runId>/                              ignoré
  stages/dev-100/<runId>/                             ignoré
  stages/holdout-30/<runId>/                          ignoré
  replays/replay.<sourceRunId>/                       ignoré
```

La racine porte l’étage **et** le `runId` : un run audité n’est jamais écrasé par
le suivant, et `persistResult` refuse déjà d’écrire sur un artefact existant.

### Conditions d’ARRÊT

- Estimation de coût au-dessus de `maxRunCostUsd` → le dry-run sort en `STOP`.
- Approbation manquante → `stage_requires_approval:<STAGE>:<flag>`.
- Manifeste altéré : id dupliqué, id inconnu, découpage F2/F3 faux, hash source
  différent, recouvrement holdout/DEV-100 → refus au chargement.
- `promptVersion` ou `providerDtoVersion` de la config différents de ceux du code
  → refus : on ne saurait plus dire quel protocole le run mesure.
- GOLD du holdout non validée → `holdout_gold_not_validated`.
- Toute clé issue d’une exécution de modèle dans la GOLD du holdout
  (`prediction`, `runId`, `model`, `prompt`, `rawResponse`…) → `holdout_model_data_leak`.

### Piège : fins de ligne

Les manifestes ont été gelés depuis un checkout LF. Les hashes source sont donc
vérifiés **après** normalisation `\r\n` → `\n`. Hacher les octets bruts ferait
échouer tout checkout CRLF, et la réparation évidente — régénérer le manifeste —
détruirait précisément le gel qu’il garantit.

Pour la même raison, `npm run check` réécrit une soixantaine de fichiers sur un
checkout CRLF, dont `golden/e5/manifest.json` (`designReviewHash`, calculé sur
les octets bruts). Ces réécritures ne sont **pas** à indexer : `git checkout --`
après le check. `tests/validation-results.json` est une sortie générée et ne se
commite pas non plus ; son compteur `jsonFiles` dépend en plus des sorties de run
présentes localement.
