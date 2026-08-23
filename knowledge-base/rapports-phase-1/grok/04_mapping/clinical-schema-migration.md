# Table de correspondance détaillée — Schéma JSON clinique original → modèle unifié

**Fichier source :** `Schéma de données IA coaching.json` (version 1.0.0)  
**Cible :** modèle unifié FitTrack KB (v1.1.0 clinique)

| Élément original | Type | Destination unifiée | Transformation | Notes de migration |
|---|---|---|---|---|
| `schemaVersion` | string const "1.0.0" | `kb-root.kbVersion` + `clinical.schemaVersion` = "1.1.0" | Incrémenter | Ajout de champs de provenance |
| `lastEvidenceReview` | date | `kb-root.lastEvidenceReview` | Copie | — |
| `globalSafetyRules.disclaimer` | string | `globalSafetyRules.disclaimer` | Copie | Conserver mot pour mot |
| `globalSafetyRules.redFlags[]` | array of redFlag | Entité `RedFlag` + relation | Migrer + ajouter `corpusFragments` | Priorité absolue conservée |
| `globalSafetyRules.zoneLogic.green/orange/red` | zoneRule | `SafetyZone` (GREEN/ORANGE/RED) | Renommer clés en majuscules | Alignement Base clinique |
| `$defs.source` | object | Entité `Source` | Étendre avec `corpusFragments` | Quasi identique |
| `$defs.evidenceRating` | object | Entité `EvidenceAssessment` | Lier à Claim | — |
| `$defs.redFlag` | object | Entité `RedFlag` | Ajouter `corpusFragments` | — |
| `$defs.zoneRule` | object | Entité `SafetyZone` | Copie | — |
| `$defs.toleranceDimension` | object | Entité `ToleranceDimension` | Copie | — |
| `$defs.modification` | object | Entité `Modification` / `Adaptation` | Copie | — |
| `$defs.conditionRecord` | object | Entité `Condition` | Ajouter `corpusFragments`, `knowledgeType`, `validationStatus` | diagnosticCertaintyRequired reste, mais non bloquant pour symptom_pattern |
| `conditionRecord.contraindications` | array | Entité `Contraindication` | Scope strict conservé | Ne pas convertir sensibilité fréquente en interdiction |
| (absent) | — | `Claim` | Nouveau | Issu des tableaux Markdown |
| (absent) | — | `Exercise` | Nouveau | Issu d’Anatomie §10 |
| (absent) | — | `Muscle` / `MovementPattern` | Nouveau | — |
| (absent) | — | `CorpusFragment` | Nouveau | Traçabilité obligatoire |
| (absent) | — | `Contradiction` / `EvidenceConflict` | Nouveau | Issu des tableaux de contradictions |

## Règles de migration non négociables
1. Aucun red flag ne perd sa priorité.
2. Aucun champ `expert_practice` n’est promu en `EVIDENCE`.
3. Toute instance migrée doit porter au moins un `corpusFragment`.
4. Les enums sont normalisés (GREEN vs green).
5. Le schéma original reste archivé dans `versions/original/` pour audit.
