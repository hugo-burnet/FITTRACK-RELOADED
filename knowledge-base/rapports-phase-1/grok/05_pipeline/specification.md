# Spécification du pipeline Markdown/JSON → Knowledge Base FitTrack

## Vue d’ensemble

```
ingestion
→ découpage structurel sans perte des repères
→ extraction des candidats
→ normalisation des entités et vocabulaires
→ résolution des sources
→ déduplication
→ création des relations
→ détection des contradictions
→ validation de schéma
→ contrôles de traçabilité
→ revue humaine ciblée
→ publication versionnée de la KB
```

## Détail par étape

### 1. Ingestion
- **Entrée :** les 4 fichiers source
- **Sortie :** copie immuable + SHA-256 de chaque fichier + métadonnées
- **Déterministe :** oui
- **Risque :** modification accidentelle des sources
- **Contrôle :** hash vérifié avant toute extraction
- **Artefact :** `provenance/corpus-snapshot-{date}/`

### 2. Découpage structurel
- **Entrée :** fichiers Markdown + JSON
- **Sortie :** arbre de sections, tableaux, listes avec ancres (fichier + ligne de début/fin)
- **Déterministe :** oui (regex + parseur Markdown)
- **Risque :** perte de contexte inter-tableaux
- **Contrôle :** couverture 100 % des titres de section
- **Artefact :** `intermediate/structure-{file}.json`

### 3. Extraction des candidats
- **Entrée :** structure + texte
- **Sortie :** candidats Claim / Exercise / Condition / RedFlag / Source
- **Déterministe :** partiel (règles + LLM assisté)
- **LLM :** oui, prompt strict « ne jamais inventer, citer le fragment exact »
- **Risque :** hallucination, fusion de claims
- **Contrôle :** chaque candidat doit contenir le texte source exact
- **Artefact :** `intermediate/candidates-{type}.jsonl`

### 4. Normalisation
- **Entrée :** candidats
- **Sortie :** instances conformes aux schémas + enums
- **Déterministe :** mapping vers `enums.json`
- **Risque :** perte de nuance lors du mapping
- **Contrôle :** validation JSON Schema immédiate
- **Artefact :** `entities/normalized/{type}/`

### 5. Résolution des sources
- **Entrée :** références (DOI, PMID, titre, URL)
- **Sortie :** Source IDs stables
- **Déterministe :** matching exact puis fuzzy contrôlé
- **Risque :** collision de sources, DOI manquant
- **Contrôle :** ne jamais inventer DOI/PMID
- **Artefact :** `entities/sources/`

### 6. Déduplication
- **Entrée :** instances normalisées
- **Sortie :** set unique (hash de statement + sourceIds)
- **Déterministe :** oui
- **Risque :** faux positifs de duplication
- **Contrôle :** revue manuelle des collisions
- **Artefact :** `intermediate/dedup-report.json`

### 7. Création des relations
- **Entrée :** instances + tableaux de contradictions du corpus
- **Sortie :** relations supports / contradicts / targets / substitutableWith
- **Déterministe + LLM :** règles d’abord, LLM pour ambiguïté
- **Risque :** relations erronées
- **Contrôle :** relations redondantes ou cycliques détectées
- **Artefact :** `relations/*.jsonl`

### 8. Détection des contradictions
- **Entrée :** Claims + tableaux « Contradictions majeures »
- **Sortie :** EvidenceConflict records
- **Déterministe :** extraction des tableaux dédiés
- **Risque :** contradiction non détectée
- **Contrôle :** couverture des tableaux de contradictions des 3 MD
- **Artefact :** `entities/contradictions/`

### 9. Validation de schéma
- **Entrée :** toutes les instances
- **Sortie :** rapport de validation
- **Déterministe :** JSON Schema
- **Risque :** schéma trop permissif
- **Contrôle :** 0 erreur bloquante
- **Artefact :** `quality/schema-validation-report.json`

### 10. Contrôles de traçabilité
- **Règle :** chaque Claim / Condition / Exercise / RedFlag a ≥ 1 CorpusFragment valide
- **Contrôle automatique :** oui
- **Artefact :** `quality/traceability-report.json`

### 11. Revue humaine ciblée
- **Cible :** RedFlags, Contradictions, Claims confiance « high », golden set
- **Sortie :** ReviewDecision
- **Artefact :** `reviews/`

### 12. Publication versionnée
- **Sortie :** tag Git + changelog + snapshot KB
- **Artefact :** `versions/vX.Y.Z/`

## Propriétés globales
- **Idempotence :** même entrée → mêmes IDs stables
- **Incrémentalité :** nouvelle version d’un rapport ne casse pas les IDs existants
- **Auditabilité :** tous les artefacts intermédiaires conservés
