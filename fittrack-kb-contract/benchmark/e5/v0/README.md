# E5-LLM BENCHMARK v0

Ce dossier est réservé au premier benchmark froid de l’extracteur E5 sur les
100 `fragmentId` du manifest E5-P0/GOLD. Il ne contient aucune candidate de
production et aucun outil de génération n’ouvre l’adjudication GOLD.

## Chaîne

```text
Fragments E5-P0 + CitationOccurrences E5-P0
  → prompt fermé
  → adapter OpenRouter ou replay
  → E5ProviderPrediction shallow (transport uniquement)
  → validation Provider DTO
  → adapter déterministe provider → canonique
  → validation canonique, spans, citations et guardrails
  → prédiction benchmark
  → comparateur GOLD séparé
```

L’interface profonde est `extractProseFragment`. Elle cache le prompt, les
retries techniques, la résolution des spans UTF-8, les contrôles de citations,
les guardrails et les IDs techniques. L’adapter OpenRouter et l’adapter replay sont
les deux implémentations réelles du seam modèle.

Le schéma de prédiction canonique reste l’autorité de validation locale. Le
module `createE5ProviderPredictionSchema` en dérive uniquement les vocabulaires
pour construire un DTO de transport à profondeur maximale 5. Les spans y sont
des offsets UTF-8 parallèles et les confiances multi-aspect trois arrays
parallèles ; `providerPredictionToCanonical` reconstruit ensuite sans réseau le
schéma canonique, les textes, les IDs temporaires et le `fragmentId`.

`projectProviderSchema` applique enfin l’allowlist Structured Outputs au DTO,
vérifie les limites Azure et journalise les contraintes retirées. `minLength`,
`uniqueItems`, les bornes d’arrays, les patterns et tous les invariants restent
appliqués après génération par Ajv et les validations E5. Le DTO n’est ni un
contrat métier ni une source utilisée par le comparateur GOLD.

## Configuration figée avant résultats

`config.base.json` fixe le provider, le modèle snapshot, le prompt, le schéma,
les paramètres de sampling, le nombre maximal de retries, les commits GOLD et
corpus, ainsi que la base tarifaire utilisée par l’estimation. Une exécution
écrit le `config.json` auditable avec `runId`, dates, hashes, liste ordonnée des
fragments, version modèle observée, usages et bilan des retries.

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

Toutes les tentatives sont conservées. Une sortie techniquement invalide peut
être réparée au plus deux fois ; un `UNRESOLVED` sémantique ou une violation de
sûreté ne déclenche aucune optimisation du contenu.

Les seuils viennent exclusivement du Design Review : ils ne sont pas ajustés
après observation des résultats. Le comparateur principal est déterministe
(spans, similarité lexicale locale, citations fermées) et n’emploie aucun juge
LLM.
