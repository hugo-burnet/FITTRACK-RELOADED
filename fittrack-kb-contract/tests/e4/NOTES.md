# E4 — F4 est un JSON Schema, pas un recueil de fiches

Le fichier F4 (`Schéma de données IA coaching.json`) décrit des **types**
(`$defs.redFlag`, `$defs.toleranceDimension`, …) et des **propriétés racine**
(`globalSafetyRules`, `conditionRecords`). Il ne contient pas d'instances du
genre `conditionRecords[3].recommendedModifications[1]`.

E4 parcourt donc le document JSON tel quel. Chaque nœud devient une candidate
`json_path` avec JSON Pointer, type JSON et valeur brute du schema.

`irritating` reste une valeur d'enum de `status`. Elle ne devient pas
`forbidden`.

Les `$defs.source` restent des définitions de schema, pas des Sources curated.
Aucune fusion avec les 57 URL E3.

Les `sourceIds` de F4 sont des **types** `array of string`, pas des identifiants
d'instance : le contrôle d'orphelins n'a pas d'objet à E4.
