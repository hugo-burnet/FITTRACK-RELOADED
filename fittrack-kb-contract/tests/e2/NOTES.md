# E2 — mapping et limites du contrat

## Six axes (inchangés)

| Axe | Porteur | E2 |
|---|---|---|
| `knowledgeType` | claim / assessment | déduit seulement si les types de preuve mappent vers une seule nature |
| `epistemicStatus` | claim | seulement `established_direction` quand direction=high et un autre aspect plus faible |
| `confidenceByAspect[]` | assessment | « X pour Y » si Y est dans le vocabulaire ; sinon UNRESOLVED |
| `directness` | assessment | seulement si un unique type EMG / biomécanique / expert |
| `evidenceTypes[]` | assessment | motifs explicites dans la cellule Type de preuve |
| `hierarchyHint` | assessment | `training` (F1) ou `biomechanics` (F2) — pas d'id métier |

Aucun champ `high_for_direction_moderate_for_curve`.

## Ce qui reste UNRESOLVED volontairement

- Plages `Faible à modéré` / `Modéré à élevé` : `range`, pas une valeur unique.
- Qualificatifs (`qualitativement`, `par inférence`, `surtout ~30–85 % 1RM`).
- Aspects hors vocabulaire (`algorithmes exacts`, `force`, `dose`, `principe`, `hypertrophie`).
- Types de preuve non listés (`revue critique`, `validation observationnelle`, `essais aigus`).
- `knowledgeType` dès que plusieurs natures coexistent dans la même cellule.

## Population

`rawDescription` est l'autorité. On n'écrit jamais `young_men_only`.
« Principalement jeunes hommes entraînés » : warning de représentativité + `trained`, pas de `ageBand`.
