# Baseline de refactorisation — 2026-07-28

## Référence Git

- Tag annoté : `refactor-phase-0-start-2026-07-28`.
- Commit ciblé par le tag : `fcfb03ab4cfea6e23c7c74a868feb46b3e219bb5`
  (`docs: planifie la baseline de refactorisation`).
- État juste avant cette tâche de passation : `895e5f8` (`test: mesure les
  lectures d’un historique volumineux`). Les deux commits de la phase entre le
  tag et cet état ajoutent uniquement le dataset déterministe et le benchmark.

## Environnement

- Répertoire : `C:\Users\e6\Documents\FITTRACK RELOADED`.
- Système hôte : Windows PowerShell 5.1.
- Node : `v24.18.0`.
- npm : `11.16.0`.
- Les portes npm sont invoquées avec `npm.cmd` : le shim `npm.ps1` est bloqué
  sur cet hôte.

## Portes qualité initiales

Mesure initiale relancée pour preuve avec `npm.cmd` :

| Commande | Code de sortie | Durée | Résumé observé |
| --- | ---: | ---: | --- |
| `npm.cmd run lint` | 0 | 19 087 ms | ESLint sans diagnostic. |
| `npm.cmd run typecheck` | 0 | 9 727 ms | `tsc --noEmit` sans diagnostic. |
| `npm.cmd run test:run` | 0 | 54 216 ms | Vitest 4.1.10 : 56 fichiers et 764 tests réussis ; durée Vitest 52,52 s. |
| `npm.cmd run build` | 0 | 12 800 ms | `tsc -b && vite build` ; 189 modules transformés ; Vite : 1,23 s. |
| `git diff --check` | 0 | 800 ms | Aucune erreur d’espace blanc. |

Après les tâches 2 et 3, la suite contient 57 fichiers et 766 tests réussis.

## Inventaire du code

Les 40 plus grands fichiers TypeScript/TSX mesurés au tag de référence sont :

| Lignes | Fichier |
| ---: | --- |
| 1290 | `src/data/repositories/workouts.test.ts` |
| 1110 | `src/i18n/fr.ts` |
| 905 | `src/data/repositories/history.test.ts` |
| 713 | `src/features/workout/WorkoutScreen.tsx` |
| 530 | `src/lib/export/projectCoachExport.test.ts` |
| 488 | `src/lib/hevyCsv.test.ts` |
| 476 | `src/data/repositories/hevyImport.test.ts` |
| 429 | `src/features/routines/RoutinesScreen.tsx` |
| 413 | `src/data/repositories/routines.test.ts` |
| 411 | `src/lib/export/serializeMarkdown.test.ts` |
| 411 | `src/data/repositories/history.ts` |
| 391 | `src/features/workout/WorkoutExerciseCard.tsx` |
| 339 | `src/features/routines/RoutineEditorScreen.tsx` |
| 337 | `src/features/history/hevyImportDraft.test.ts` |
| 310 | `src/data/types.ts` |
| 303 | `src/ui/icons.tsx` |
| 298 | `src/features/history/HevyImportScreen.tsx` |
| 295 | `src/features/history/HistoryEditScreen.tsx` |
| 295 | `src/lib/hevyCsvValues.ts` |
| 282 | `src/lib/analytics/volume.test.ts` |
| 282 | `src/features/workout/PlateLoadSheet.tsx` |
| 281 | `src/features/exercises/ExerciseDetailScreen.tsx` |
| 277 | `src/features/workout/WarmupSheet.tsx` |
| 276 | `src/lib/export/serializeMarkdown.ts` |
| 273 | `src/data/repositories/exportQueries.test.ts` |
| 271 | `src/features/workout/WorkoutSetRow.tsx` |
| 270 | `src/lib/measurement.test.ts` |
| 266 | `src/data/repositories/workoutSets.ts` |
| 261 | `src/lib/hevyExerciseMatch.ts` |
| 255 | `src/features/routines/RoutineExerciseCard.tsx` |
| 253 | `src/lib/measurement.ts` |
| 252 | `src/data/repositories/hevyImport.ts` |
| 247 | `src/features/exercises/ExerciseBrowser.tsx` |
| 241 | `src/ui/ReorderableList.tsx` |
| 239 | `src/features/routines/RoutineSetSheet.tsx` |
| 238 | `src/data/repositories/routineLifecycle.ts` |
| 236 | `src/lib/hevyExerciseMatch.test.ts` |
| 235 | `src/features/history/historyDraft.test.ts` |
| 235 | `src/lib/history.test.ts` |
| 235 | `src/features/history/HistoryScreen.tsx` |

## Taille du build

| Fichier | Octets bruts | Octets gzip |
| --- | ---: | ---: |
| `index-BTuHbmwr.js` | 402254 | 106979 |
| `Screen-CiUUu7_x.js` | 260399 | 83787 |
| `index-DkyVjbl3.css` | 32846 | 6874 |
| `ExerciseAnalyticsScreen-D5ezxEP3.js` | 8537 | 2874 |
| `WeeklyVolumeScreen-BQT9tpue.js` | 6726 | 2527 |
| `WeeklySessionsScreen-DHyeSn4I.js` | 6011 | 2169 |
| `MuscleBalanceScreen-pq8SsVfq.js` | 4964 | 1911 |
| `AnalyticsScreen-CbMKLooI.js` | 1223 | 518 |
| `plot-BYtnsxd1.js` | 915 | 500 |
| `weeks-cCxVAera.js` | 762 | 486 |
| `ChartSurface-d6WWsd-I.js` | 679 | 461 |

Total brut : **725316** octets. Total gzip : **209086** octets.

Sous Windows PowerShell 5.1, le membre d’énumération
`CompressionLevel.SmallestSize` manque ; ce n’est pas une absence du
constructeur `GZipStream`. La mesure gzip emploie donc
`GZipStream(buffer, CompressionMode.Compress, true)` : les octets bruts sont
exacts et les tailles gzip sont valides, sans garantie d’être identiques à un
hôte qui prend en charge `SmallestSize`.

## Dataset volumineux

- Source : `src/test/largeHistory.ts`.
- Profil déterministe : 2 000 séances, 16 000 lignes et 64 000 séries.
- Durée de semis observée : 46 839,9 ms.
- Le semis utilise une transaction Dexie de lecture/écriture ; les identifiants,
  horodatages et liens parents sont déterministes.

## Mesures des lectures historiques

Source machine : `.tmp/history-benchmark.json`. Le benchmark est opt-in via
`npm.cmd run bench:history` ; il n’est pas collecté par `test:run`.

| Interface | Échantillons | Médiane exacte (ms) | Moyenne observée (ms) |
| --- | ---: | ---: | ---: |
| `listHistoryPage({}, 0, 20)` — première page | 3 | 657.2546000000002 | 694.767666666669 |
| `listCompletedWorkoutTimestamps()` | 3 | 21.999299999995856 | 25.275733333330816 |
| `listExportSources({ kind: 'period', from, to })` — année bornée | 3 | 44954.7567 | 54151.89506666667 |

La commande de benchmark a terminé avec le code 0 en 303,2 s. Les valeurs
rapportées dans le compte rendu arrondies à deux décimales sont respectivement
694,77 ms, 25,28 ms et 54 151,90 ms pour les moyennes.

## Scan d’architecture

- Rapport HTML temporaire :
  `C:\Users\e6\AppData\Local\Temp\architecture-review-20260728-phase0.html`.
- Deux candidats sont retenus :
  1. **Deepen la projection historique** — recommandation forte, après un
     correctif P0 de performance séparé.
  2. **Concentrer la lecture d’une période analytics** — à explorer, après le
     candidat 1 et après ajout de preuve comportementale.
- Compétences installées et utilisées : `improve-codebase-architecture`,
  `codebase-design` et `refactoring`.
- `reduce-system-complexity` n’était pas installé : aucune source vérifiée n’a
  été trouvée, donc il n’a pas été installé ni prétendu utilisé.

## Limites de la baseline

- Les tests Dexie utilisent `fake-indexeddb` : ils ne démontrent pas le
  comportement sur un téléphone.
- Le navigateur intégré bloque l’ouverture `file://` du rapport d’architecture.
  Le rendu Mermaid, les mass diagrams CSS et l’adaptation mobile sont donc
  **Cannot verify automatically** et demandent un checkpoint manuel.
- Aucune sauvegarde de téléphone n’a été demandée, conformément au choix
  utilisateur.

## Anomalies consignées sans correction

- Le shim PowerShell `npm.ps1` est bloqué ; les portes sont exécutées avec
  `npm.cmd`.
- Le membre `CompressionLevel.SmallestSize` manque dans Windows PowerShell 5.1 ;
  la variante de mesure gzip est documentée ci-dessus.
- Aucun changement de comportement applicatif ou de schéma Dexie n’a été fait
  pour ces constats.
