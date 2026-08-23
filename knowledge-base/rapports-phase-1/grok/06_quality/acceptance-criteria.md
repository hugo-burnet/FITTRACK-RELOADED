# Critères d’acceptation et contrôles qualité — KB FitTrack

## Critères bloquants (must-pass)

1. **Traçabilité 100 %**  
   Tout Claim, Condition, Exercise, RedFlag possède au moins un `corpusFragment` pointant vers un fichier source existant et un hash de texte cohérent.

2. **Aucune invention**  
   Aucun DOI, PMID, URL, auteur ou référence n’est fabriqué. Les champs manquants restent `null` ou absents.

3. **Séparation épistémique**  
   Aucun objet de type `EXPERT_PRACTICE` ou `HYPOTHESIS` n’a `epistemicStatus = "established"`.

4. **Priorité des red flags**  
   Test unitaire : si un RedFlag est actif, aucune Adaptation / Modification n’est autorisée pour la région concernée.

5. **EMG ≠ hypertrophie**  
   Aucun champ d’avantage hypertrophique n’est alimenté uniquement par une différence EMG.

6. **Schéma valide**  
   100 % des instances passent la validation JSON Schema (draft 2020-12).

7. **Couverture des tableaux de claims**  
   ≥ 95 % des lignes des tableaux d’affirmations des trois Markdown sont extraites en Claims.

8. **Revue humaine obligatoire**  
   Tous les RedFlags et toutes les Contradictions ont un `ReviewDecision` avant publication.

## Contrôles automatiques recommandés

| Contrôle | Type | Fréquence |
|---|---|---|
| Hash des fichiers source inchangés | Intégrité | Chaque run |
| Validation JSON Schema | Structure | Chaque run |
| Présence de corpusFragment | Traçabilité | Chaque run |
| Enums stricts | Vocabulaire | Chaque run |
| Absence de DOI inventés | Intégrité | Chaque run |
| RedFlag overrides Adaptation | Sécurité | Chaque run |
| Pas de primaryMuscles par défaut depuis le nom | Qualité | Chaque run |
| Couverture des tableaux de contradictions | Completeness | Chaque run |

## Checklist revue humaine

- [ ] Red flags : formulation « nécessite évaluation » (jamais diagnostic)
- [ ] Claims « high » : formulation fidèle au tableau source
- [ ] Contradictions : cause probable correctement capturée
- [ ] Exercises : lengthenedBias et equivalenceLevel justifiés par le corpus
- [ ] Conditions : diagnosticCertaintyRequired cohérent avec la Base clinique
- [ ] Aucune restriction définitive injustifiée
- [ ] Niveaux de confiance non surévalués

## Critères d’acceptation de la phase suivante (golden set)

Le golden set (10 Claims + 5 Exercises + 3 Conditions + relations) doit :
- passer tous les contrôles automatiques,
- être validé manuellement par un relecteur,
- servir de non-régression pour les futures extractions.
