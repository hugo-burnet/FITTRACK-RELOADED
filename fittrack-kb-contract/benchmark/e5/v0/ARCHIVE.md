# Archive des exécutions E5-LLM v0.4 — 2026-08-25

Branche orpheline : elle ne contient **que** les sorties brutes des runs, sans le code.
Le code vit sur `claude/task-7-complete-06d6ff` ; le corpus produit vit dans
`candidates/e5-corpus.json` sur cette même branche.

Ces fichiers sont ignorés par le `.gitignore` du dépôt principal — le plan interdit de
les versionner à côté du contrat. Ils sont archivés ici parce qu'ils constituent la
**trace d'audit** de tout ce qui a été affirmé sur les coûts et les scores : chaque
chiffre est recalculable depuis ces fichiers.

## Contenu

| Dossier | Ce qu'il contient |
|---|---|
| `corpus/` | l'extraction de production des 107 fragments sans annotation humaine |
| `runs/dev-100/` | le benchmark de référence, 100 fragments, 186 claims de GOLD |
| `runs/dev-20/` | les cinq itérations successives sur le lot difficile |
| `replays/` | le rejeu hors ligne des réponses v0.3 à travers le validateur v0.4 |
| `pilot/openrouter-openai-gpt-5/` | le pilote qui a mesuré le coût de la réflexion |

Chaque run contient :

- `raw-responses/<fragment>/attempt-N.json` — la réponse brute du fournisseur, le prompt
  envoyé, les tokens, la latence et le coût de l'appel
- `predictions/<fragment>.json` — la prédiction validée et matérialisée
- `diagnostics/<fragment>.json` — l'audit claim par claim : ce qui a été retenu, ce qui a
  été filtré et pourquoi
- `budget-ledger.json` — chaque appel avec son coût réel et le plafond restant
- `metrics.json`, `errors.json`, `report.md` sur les runs évalués

## Ce qui n'y est pas

Aucune clé d'API. Vérifié avant archivage : ni le préfixe `sk-or-v1-`, ni la valeur de
`OPENROUTER_API_KEY`, ni aucun en-tête `authorization`. L'adaptateur ne journalise jamais
le secret.

## Repères de coût

| Run | Fragments | Coût |
|---|---:|---:|
| DEV-20 v0.4.0 → v0.4.4 (cinq runs) | 20 chacun | 3,19 USD |
| Pilotes de réflexion | 3 + 3 | 0,35 USD |
| DEV-100 | 100 | 4,61 USD |
| Extraction du corpus | 107 | 4,90 USD |
| **Total** | | **≈ 14,23 USD** |
