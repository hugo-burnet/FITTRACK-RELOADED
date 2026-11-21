> Cartographie du 2026-11-21 (v2.18.0). Les constats 2 (meilleure série assistée) et 3 (séances lues par la fiche) sont corrigés en v2.19.0 ; le reste est le plan de la v3.0.

# Cartographie objets × écrans — FitTrack (2026-11-21)

Analyse en lecture seule de `src/` (routeur, 14 dossiers `features/`, dépôts `src/data/repositories/`).
Aucun fichier du dépôt n'a été modifié.

## Résumé (10 lignes)

1. Le constat de départ tient, avec une nuance : l'appli est découpée par **fonction et par lot** (Lot 3 fiche, Lot 12 courbes, Lot 13 records, coach v2 R6 volume…), chaque lot ayant ajouté *son* écran au lieu d'enrichir celui de l'objet.
2. **L'exercice est l'objet le plus éclaté** : 5 écrans racontent son histoire (fiche, courbe, records, historique filtré, journal coach) et la fiche n'est joignable **que** depuis l'onglet Exercices et la feuille d'un muscle — ni depuis une séance passée, ni depuis un record, ni depuis la courbe, ni depuis une routine.
3. **Le volume par muscle est calculé trois fois, différemment** : moyenne sur la période (Séries par muscle), médiane de 6 semaines complètes + 7 jours glissants (Volume par muscle, Réglages), pondération primaire + secondaires sur 12 semaines (carte du corps de l'accueil). Le mot « Volume » désigne en plus deux grandeurs (tonnage et séries par muscle).
4. **La séance passée est pauvre** : `HistoryWorkoutDetail` ne montre ni ses records (la requête existe, `listRecordsForWorkout`, utilisée seulement en direct), ni ce que le coach en a conclu (`sourceWorkoutId` existe), ni son contexte de bloc (`programId`, semaine, phase), et ses exercices ne mènent nulle part.
5. **Trois résumés différents d'« un exercice dans une séance »** : série la plus lourde (fiche), dernière série validée (fin de séance), métrique choisie (courbe). Pour un exercice assisté, la fiche affiche comme meilleure série celle qui a **le plus** d'assistance — un défaut réel.
6. Les liens manquent dans le sens objet → contexte : un palier ne mène pas à sa séance, une recommandation pas à la séance qui l'a produite, une séance d'un bloc pas à sa fiche d'historique. Les records, eux, mènent bien à leur séance (contrairement à l'hypothèse de départ).
7. Proposition : **cinq pages d'objet** — Exercice (fusion fiche + courbe + records + journal), Séance passée (enrichie), Muscle (fusion Séries par muscle + Volume par muscle + feuille du muscle), Semaine (fusion Rythme + Volume d'entraînement + carte accueil), Bloc (enrichi). Corps/Mensurations est déjà presque une page d'objet.
8. À **ne pas** intégrer : la séance en direct (reste épurée, règle n° 5), l'écran de fin (un geste, pas une page de lecture), la revue des cibles de routine, les Réglages (structure décidée), le Wiki.
9. Progression devient un **tableau de bord de tuiles d'entrée** vers ces pages (règle « tuile ou ligne », écart n° 2 de `DESIGN.md`), plus une copie des écrans.
10. Ordre : liens et contenus manquants d'abord (petit, aucune route cassée), puis fusion Exercice, puis Muscle, puis Semaine ; chaque étape livre seule.

---

## 1. Inventaire des écrans

Onglets (`src/app/BottomNav.tsx:18-25`) : Accueil `/`, Planifier `/routines` (+ `/programs`, `/knowledge/programmation` via `PlanningTabs`), Historique `/history`, Progression `/analytics`, Exercices `/exercises`. Réglages dans l'en-tête de l'accueil.

| Code | Route / composant | Lot / spec d'origine | Objet(s) principal(aux) |
|---|---|---|---|
| ACC | `/` `HomeScreen` : `ProgramHeroCard` ou `HomeSuggestionCard`, `HomeProgramsRow`, `HomeBackupNudge`, `HomeVolumeCard`, `HomeMilestoneCard`, `HomeBodyCard` (+`HomeMuscleMap`), `HomeStatsIsland`, `HomeRecentWorkouts` | Lot 1 puis refontes accueil | tout, en résumé |
| ROU | `/routines` `RoutinesScreen` | Lot 4 | routine, dossier |
| ROU-E | `/routines/:id` éditeur (+ `/add`, `RoutineExerciseSheet`, `RoutineSetSheet`) | Lot 4 | routine |
| ROU-R | `/routines/:id/review` revue des cibles | coach / routineTargets | routine × exercice |
| PRG | `/programs`, `/programs/:id`, `/programs/:id/edit`, `/programs/new` | Lot 17 | bloc, semaine de bloc |
| SEA | `/workout` (+ `add`, `replace/:rowId`, feuilles `WorkoutSheets`, `CoachCard`, `RecordNote`) | Lot 5-6, 18, 21 | séance en cours |
| FIN | `/workout/finish` | Lot 5, 18 | séance qui se termine |
| HIS | `/history` (journal, calendrier, filtre exercice, `WeeklyGoalSheet`) | Lot 7 | séances, semaine (objectif) |
| HIS-D | `/history/:id` (+ `/edit`) | Lot 7 | séance passée |
| HIS-I | `/history/import` | import Hevy | séances importées |
| BEN | `/benchmark/:workoutId` (+ `BenchmarkLaunchSheet`, `ProgramBenchmarkCard`) | spec 2026-10-15 | séance benchmark |
| PROG | `/analytics` `AnalyticsScreen` (7 lignes + liste d'exercices) | Lot 12 | index |
| P-EX | `/analytics/exercises/:exerciseId` courbe | Lot 12 (RF-41) | exercice |
| P-REC | `/analytics/records` | Lot 13 | record |
| P-PAL | `/analytics/milestones` | spec 2026-08-30/31 | palier |
| P-MES | `/analytics/measurements`, `/analytics/measurements/:type` | Lot 11, spec 2026-10-14 | corps |
| P-SEM | `/analytics/weekly` Séances par semaine | Lot 12 (G2) | semaine |
| P-VOL | `/analytics/volume` Volume d'entraînement (tonnage/durée par semaine) | Lot 12 (G4) | semaine |
| P-MUS | `/analytics/muscles` Séries par muscle | Lot 12 (RF-42) | muscle |
| P-MOI | `/analytics/months` Rapport mensuel | Lot 12 (RF-44) | mois |
| EXO | `/exercises` bibliothèque | Lot 3 | exercice |
| EXO-D | `/exercises/:id` fiche (Suivi / Documentation) | Lot 3, + records Lot 13, + journal coach Lot 18 | exercice |
| EXO-F | `/exercises/new`, `/:id/edit` | Lot 3 | exercice perso |
| MUS-S | `MuscleExercisesSheet` (depuis carte du corps et fiche exercice) | Lot 5bis | muscle |
| REG | `/settings` + 5 pages (décidé, en cours de refonte par un autre agent) | Lot 8 | réglages |
| REG-V | `/settings/volume` Volume par muscle + `VolumeBoundsSheet` | coach v2 R6 (2026-10-04) | muscle |
| REG-C | `/settings/coach` | Lot 18 | coach |
| REG-B | `/settings/backup` | Lot 8 | sauvegarde |
| WIKI | `/knowledge/*` | spec 2026-08-26 | savoir |

## 2. Objets du domaine

| Objet (vu par l'utilisateur) | Table(s) Dexie | Dépôt(s) |
|---|---|---|
| Exercice | `exercises`, `externalExerciseBindings` | `exercises.ts`, `exerciseSnapshot.ts`, `workoutHistory.ts` (`listSessionsForExercise`, `getLastPerformance`) |
| Séance (en cours / passée) | `workouts`, `workoutExercises`, `workoutSets` | `workouts.ts`, `workoutLifecycle.ts`, `workoutSets.ts`, `workoutDetail.ts`, `history.ts`, `historicalWorkouts.ts` |
| Routine | `routines`, `routineFolders`, `routineExercises`, `routineSets` | `routines.ts`, `routineExercises.ts`, `routineSets.ts`, `routineFolders.ts`, `routineTargetReview.ts` |
| Bloc (programme) | `programs`, `programWeeks`, `programScheduleRevisions`, `programScheduleEntries` | `programs.ts`, `programSchedules.ts`, `programLifecycle.ts`, `programWorkout.ts` |
| Semaine | *aucune table* : dérivée de `workouts.startedAt` + réglage objectif hebdo (`settings`) | `home.ts`, `history.ts`, `lib/history.ts`, `lib/analytics/weeks.ts`, `lib/coach/volume.ts` |
| Muscle | *aucune table* : `MuscleGroup` sur l'exercice et l'instantané de séance ; bornes dans `settings` | `coachVolume.ts`, `settings.ts` (`getCoachVolumeBounds`), `lib/analytics/muscles.ts` |
| Corps / mensurations | `bodyMeasurements`, `progressPhotos`, `photoBlobs` | `bodyMeasurements.ts` (poids), `measurements.ts` (le reste, délègue le poids : `measurements.ts:121-124`) |
| Record | `personalRecords` (projection) | `personalRecords.ts`, `recordTimeline.ts`, `recordSources.ts`, `recordReconciliation.ts` |
| Palier | `milestones` (projection) | `milestones.ts` |
| Recommandation du coach | `coachRecommendations` | `coachRecommendations.ts`, `coachEvaluate.ts`, `coachApply.ts`, `coachVolume.ts` |
| Sauvegarde | `settings` (horodatage) | `backup.ts`, `backupStatus.ts` |

## 3. Matrice objets × écrans

Légende : **L** lecture, **É** édition, **A** action, **→** lien vers, **∅** absent alors qu'attendu. Seules les cases non vides sont écrites.

### 3a. Exercice

| Écran | Ce qu'il montre / permet de l'exercice |
|---|---|
| EXO | L liste filtrable ; A créer ; → EXO-D |
| EXO-D Suivi | L muscles (carte), **records actuels** (lecture), **historique** (une ligne par bloc de séance : date + série la plus lourde), **journal du coach** ; É notes, repos par défaut, pas de charge, chargement/coefficient ; A supprimer (perso) ; → P-REC filtré, → P-EX. ∅ lien d'une ligne d'historique vers sa séance (`ExerciseDetailScreen.tsx:315`, `ListRow` sans `onClick`) ; ∅ lien d'une recommandation vers sa séance |
| EXO-D Documentation | L wiki de l'exercice ; → WIKI |
| P-EX | L **courbe** (métrique au choix) + **table des séances** ; A export PNG. ∅ lien vers la fiche, ∅ lien d'une séance vers HIS-D (`ExerciseAnalyticsScreen.tsx:194` ne fait que sélectionner le point) |
| PROG | L **seconde liste d'exercices** (ceux pratiqués) → P-EX (`AnalyticsScreen.tsx:22,87-104`) |
| P-REC | L frise des records filtrée par exercice ; → HIS-D ou SEA. ∅ lien vers la fiche ; retour figé sur `/analytics` même quand on vient de la fiche (`RecordsScreen.tsx:116`) |
| HIS | L journal filtré par exercice (`HistoryScreen.tsx:45-79`) — **troisième** liste « séances de cet exercice » |
| HIS-D | L l'exercice dans la séance (séries, notes). ∅ lien vers la fiche (`HistoryWorkoutDetail.tsx:209-221`) |
| SEA | L séries, valeurs fantômes, `CoachCard` objectif, `RecordNote` ; É séries, notes ; A remplacer, échauffement, cadence. ∅ accès à la fiche (volontaire, voir §6) |
| FIN | L dernière série validée par exercice (`WorkoutFinishScreen.tsx:294`) ; L signaux du coach |
| ROU-E / ROU-R | É cibles par exercice dans la routine. ∅ lien vers la fiche |
| MUS-S | L exercices d'un muscle → EXO-D |
| REG-C | É pas de charge **par défaut** (l'exception par exercice est sur EXO-D) |

### 3b. Séance

| Écran | Ce qu'il montre / permet de la séance |
|---|---|
| SEA | L/É tout ; A terminer, abandonner ; L records de la séance (`useActiveWorkout.ts:65`, `listRecordsForWorkout`) |
| FIN | L totaux (séries, tonnage, reps), muscles, signaux coach, dernière série par exercice ; É nom, notes. ∅ records de la séance |
| HIS | L journal, calendrier → HIS-D |
| HIS-D | L métadonnées, notes, totaux, muscles, exercices et séries ; A modifier, supprimer, partager (export coach Markdown), → BEN. ∅ records de la séance, ∅ conclusions du coach (`CoachRecommendation.sourceWorkoutId`, `types.ts:516`), ∅ bloc/semaine/phase (`Workout.programId/programWeekIndex/programPhase`, `types.ts:317-323`), ∅ liens vers les exercices |
| ACC | L 3 dernières séances (`HomeRecentWorkouts`) → HIS ; L régularité de la semaine |
| P-REC | → HIS-D depuis un record (`RecordsScreen.tsx:186-192`) |
| P-PAL | ∅ lien vers la séance du palier (`Milestone.workoutId`, `types.ts:464` ; `MilestonesScreen.tsx:93` ouvre seulement l'aperçu) |
| PRG détail | L séances faites cette semaine (état « fait »). ∅ lien vers HIS-D (`ProgramSessionList.tsx:170` sélectionne pour lancer) |
| P-SEM, P-VOL, P-MOI | L agrégats ; P-SEM → HIS (liste entière, pas la semaine) |
| BEN | L bilan d'un benchmark ; A appliquer aux routines |

### 3c. Semaine, muscle, volume

| Écran | Semaine | Muscle / volume |
|---|---|---|
| ACC `HomeStatsIsland` | L « n / objectif » cette semaine (semaine **locale du lecteur**, `lib/history.ts:54-66`) → P-SEM | |
| ACC `HomeBodyCard` | → P-SEM « Rythme », → P-VOL « Volume » | L carte du corps 12 semaines, **primaire + secondaires pondérés** (`HomeMuscleMap.tsx:29,57`) → MUS-S ; → P-MUS « Muscles » |
| ACC `HomeVolumeCard` « Volume bas » | | L muscles sous le plancher 2 semaines complètes → REG-V (`HomeVolumeCard.tsx:51`) |
| HIS `HistorySummaryCard` | L régularité + É objectif hebdo (`WeeklyGoalSheet`) | |
| P-SEM | L séances par semaine vs objectif (semaine **dans le fuseau de la séance**, `lib/analytics/weeks.ts:41-60`) | |
| P-VOL « Volume d'entraînement » | L tonnage / durée par semaine | |
| P-MUS « Séries par muscle » | | L séries de travail **primaires** sur la période, « x par semaine » = total ÷ semaines de la période (`MuscleBalanceScreen.tsx:43-61`, `MuscleBalanceCard.tsx:53`) + carte du corps pondérée |
| REG-V « Volume par muscle » | | L « Semaine : 7 jours glissants · médiane · max » sur **6 semaines complètes**, semaine **locale du lecteur** (`coachVolume.ts:34-50`, `lib/coach/volume.ts:95-132`) ; É plancher / plafond |
| HIS-D, FIN | | L carte du corps de la séance |
| MUS-S | | L exercices du muscle → EXO-D, → EXO filtré |
| SEA (coach) | | L contexte de volume dans les signaux (plafond) |

### 3d. Routine, bloc, records, paliers, corps, coach, sauvegarde

| Objet | Écrans qui le portent |
|---|---|
| Routine | ROU (L, A lancer, dossiers), ROU-E (É), ROU-R (É cibles depuis l'historique), ACC suggestion + `HomeRoutineContextSheet` (A lancer), PRG (référence), BEN (A appliquer). ∅ « dernières séances de cette routine » sur ROU-E |
| Bloc | ACC `ProgramHeroCard` (L semaine, A lancer, → PRG), ACC `HomeProgramsRow`, PRG liste/détail/éditeur, `ProgramBenchmarkCard`. ∅ volume ou tonnage du bloc, ∅ lien vers ses séances passées |
| Record | SEA `RecordNote` (au moment), EXO-D (actuels), P-REC (frise, → séance). ∅ FIN, ∅ HIS-D |
| Palier | ACC `HomeMilestoneCard`, P-PAL. ∅ lien séance |
| Corps | ACC tuile poids → `HomeBodyWeightSheet` → P-MES poids ; P-MES (+ `MeasurementSheet`). Deux feuilles de saisie du poids, mais une seule écriture (`measurements.ts:121-124`) : pas de divergence |
| Recommandation coach | SEA `CoachCard`, FIN (signaux), EXO-D (journal), REG-C (réglages), REG-V (bornes), ROU-R (cibles). ∅ HIS-D |
| Sauvegarde | ACC `HomeBackupNudge`, REG (bandeau du sommaire, décidé), REG-B. Doublon **voulu** (même `useBackupStatus`) |

---

## 4. Constats classés

### 4.1 Doublons — même information, calcul différent (défauts réels)

**D1. « Combien je travaille ce muscle » : trois réponses.**
- P-MUS : total des séries primaires sur 12 semaines ÷ nombre de semaines de la fenêtre, semaine dans le fuseau de la séance (`MuscleBalanceScreen.tsx:43-61`, `MuscleBalanceCard.tsx:53`).
- REG-V : semaine en cours = **7 jours glissants**, médiane et max sur **6 semaines complètes**, semaines au fuseau du lecteur (`lib/coach/volume.ts:95-132`, `settings/volumeText.ts:16-28`).
- ACC carte du corps : 12 semaines, **secondaires pondérés** (`HomeMuscleMap.tsx`, `lib/analytics/involvement.ts`), alors que `lib/analytics/muscles.ts` (en tête) justifie longuement de **ne pas** compter les secondaires.
Chacun est défendable, mais ils ne disent pas lesquels ils sont : « 9,5 par semaine » sur P-MUS et « médiane 11 » sur REG-V pour le même muscle, sans que l'un renvoie à l'autre. P-MUS et REG-V ne se lient pas.

**D2. « Volume » nomme deux grandeurs.** `HomeBodyCard.tsx:43` « Volume » ouvre le **tonnage** (P-VOL « Volume d'entraînement ») ; `HomeVolumeCard` « Volume bas » parle de **séries par muscle** et ouvre REG-V « Volume par muscle », qui est la même grandeur que P-MUS « Séries par muscle ». Trois libellés pour deux grandeurs, croisés.

**D3. Le résumé d'« un exercice dans une séance » : trois règles.**
- EXO-D : série la plus lourde (`ExerciseDetailScreen.tsx:65-87`). **Défaut** : pour `assisted_weight_reps`, `weight` est l'assistance ; la « meilleure » série affichée est celle qui a le plus d'aide, l'inverse du record `min_assistance` et de la métrique `lowestAssist` de P-EX.
- FIN : `best = done.at(-1)`, la **dernière** série validée, nommée « best » (`WorkoutFinishScreen.tsx:294`).
- P-EX : la métrique choisie (1re par défaut, `topWeight` pour charge × reps, `lib/analytics/metrics.ts:53`).

**D4. Les séances d'un exercice : deux requêtes qui ne voient pas la même chose.**
- EXO-D, `listSessionsForExercise` (`workoutHistory.ts:115-144`) : toutes les séries validées, **séance en cours comprise** (aucun filtre sur `workouts.status`), un bloc par `workoutExerciseId` (un exercice fait deux fois = deux lignes), daté par la première série.
- P-EX, `listHistoricalWorkouts({kind:'exercise'})` (`historicalWorkouts.ts:28-33,60-75`) : séances **terminées** seulement, une par séance, datée par `startedAt`.
Pendant une séance, la fiche montre une ligne « aujourd'hui » que la courbe n'a pas ; un superset répété compte double sur la fiche.

**D5. « Ma semaine » : deux découpages.** Tuile d'accueil et HIS (`lib/history.ts:54-66`, `startOfLocalWeek` du lecteur) vs P-SEM (`lib/analytics/weeks.ts:58`, fuseau de la séance) ; REG-V au fuseau du lecteur. La tuile d'accueil ouvre P-SEM : après un voyage, les deux chiffres de la semaine peuvent différer. Cas rare, mais la tuile et l'écran qu'elle ouvre doivent dire le même nombre.

**D6. La construction des `VolumeEntry` est réécrite quatre fois.** `lib/volumeSource.ts:19-36` (fait pour être l'unique), `HistoryWorkoutDetail.tsx:83-100`, `WorkoutFinishScreen.tsx:112-126` (sans `timed` ni `repSeconds`), `recordSources.ts:106-111`. Le tonnage concorde aujourd'hui ; le temps de travail diverge déjà entre FIN et HIS-D (FIN ne l'affiche pas, donc invisible). C'est exactement le risque que `volumeSource.ts:9-14` décrit.

**D7. Trois index d'exercices.** EXO (bibliothèque), PROG (« Exercices » pratiqués → courbe), filtres de P-REC et de HIS. Le même exercice ouvre deux pages différentes selon l'onglet par lequel on le cherche.

### 4.2 Éclatements — un objet, N écrans

**E1. Exercice : 5 écrans** (EXO-D, P-EX, P-REC filtré, HIS filtré, journal coach dans EXO-D) + 2 endroits de réglage (EXO-D pour son pas, REG-C pour le pas par défaut). Les deux pages sont nées de deux lots (Lot 3 fiche, Lot 12 courbe) et de la règle « pas de sixième onglet » (§12.1) qui a fait loger la courbe sous Progression.

**E2. Muscle : 4 écrans** sans page à lui (P-MUS, REG-V, carte du corps de l'accueil → MUS-S, `HomeVolumeCard`). Les bornes sont rangées dans Réglages › Coach alors qu'elles ne se comprennent qu'à côté du chiffre qu'elles bornent.

**E3. Semaine : 4 endroits** (tuile accueil, HIS résumé + objectif, P-SEM, P-VOL) ; l'objectif se règle depuis HIS, se lit sur ACC et P-SEM.

**E4. Coach : 6 endroits** (SEA, FIN, EXO-D, REG-C, REG-V, ROU-R), mais ici l'éclatement est en partie juste : une recommandation est un événement d'un exercice *dans* une séance. Ce qui manque est son reflet dans HIS-D (A2).

### 4.3 Absences

- **A1. Records de la séance dans HIS-D et FIN.** `listRecordsForWorkout` (`personalRecords.ts:37`) n'est lu qu'en direct (`useActiveWorkout.ts:65`). On ne retrouve « ce que j'ai battu ce jour-là » qu'en filtrant P-REC par exercice et en cherchant la date.
- **A2. Ce que le coach a conclu, dans HIS-D.** Les lignes `coachRecommendations` portent `sourceWorkoutId` (`types.ts:516`) ; aucune lecture par séance n'existe côté UI (seul `retirePendingRecommendationsFrom` filtre dessus, `coachRecommendations.ts:233`). Le champ n'est pas indexé : lecture par filtre, ou index en v14 si le volume l'exige.
- **A3. Contexte de bloc dans HIS-D** : semaine n, phase (`programPhase`), décharge — stockés sur la séance, jamais affichés.
- **A4. Historique d'une routine** sur ROU-E (dernières séances lancées depuis elle) — la donnée est là (`workouts.routineId` indexé).
- **A5. Bilan d'un bloc** sur PRG : séances faites (liées), tonnage par semaine du bloc.
- **A6. Bornes de volume à côté du chiffre** (P-MUS n'a ni plancher ni plafond ; REG-V n'a pas de courbe).

### 4.4 Liens manquants

| De | Vers | Où |
|---|---|---|
| Ligne d'historique de la fiche | HIS-D | `ExerciseDetailScreen.tsx:315` |
| Recommandation du journal | séance source | `ExerciseDetailScreen.tsx:343-355` |
| Table des séances de la courbe | HIS-D | `ExerciseAnalyticsScreen.tsx:194` |
| Courbe, record, exercice d'une séance passée, ligne de routine | fiche exercice | P-EX, `RecordRail`, `HistoryWorkoutDetail.tsx:211`, `RoutineExerciseCard` — la fiche n'est atteinte que par `ExercisesScreen.tsx:60` et `MuscleExercisesSheet.tsx:92` |
| Palier | séance | `MilestonesScreen.tsx:93` |
| Séance faite d'un bloc | HIS-D | `ProgramSessionList.tsx:170` |
| P-MUS ↔ REG-V | l'un l'autre | aucun |
| Retours figés | — | `RecordsScreen.tsx:116` revient sur `/analytics` même depuis la fiche ; `VolumeScreen.tsx:26` revient sur `/settings/coach` même depuis la carte « Volume bas » de l'accueil |
| P-SEM | HIS filtré sur la semaine | `WeeklySessionsScreen.tsx:70` ouvre tout l'historique |

---

## 5. Propositions de pages par objet

Règle appliquée (`DESIGN.md:130-138` + compléments) : tuiles pour ce qui porte un chiffre (petite = un chiffre, large = chiffre + tendance/phrase, grande = mini-courbe ou liste courte, **une seule grande par écran**), lignes pour les liens et états en un mot ; pas de tuile orpheline (la plus importante s'élargit) ; regroupement par question sous un titre ; deux petits chiffres du même sujet empilés dans une seule tuile.

### 5.1 Page Exercice — `/exercises/:id` (fusion EXO-D + P-EX + journal + accès records)

Ordre, du plus regardé au moins : la dernière fois et le record (ce qu'on vient chercher en salle), la courbe, les séances, le coach, les réglages, la doc.

```
← Développé couché                      [Suivi | Documentation]
  Pectoraux · Barre
┌ La dernière fois ────────┬ Record ──────────┐   (2 tuiles : petite empilée + large)
│ 80 kg × 6   (12 nov.)    │ 1RM est. 96 kg   │
│ 3 séries                 │ max 85 kg × 3 →  │   → frise des records filtrée
└──────────────────────────┴──────────────────┘
┌ Progression (grande tuile, la seule) ───────┐
│ ╱╲_╱‾‾ mini-courbe 12 sem.  [Charge max ▾]  │   → plein écran = l'actuelle P-EX
└─────────────────────────────────────────────┘
SÉANCES
  12 nov. 2026        80 kg × 6       >        → /history/:id
  8 nov. 2026         77,5 kg × 7     >
COACH
  12 nov. · Objectif 82,5 kg · en attente  >   → séance source
MUSCLES   (carte actuelle)
TES RÉGLAGES   notes · repos · pas · chargement
```
- Arrivées : EXO, MUS-S, **et désormais** HIS-D (nom d'exercice), P-REC, ROU-E, PROG (sa liste d'exercices pointe ici, plus vers P-EX), FIN.
- Écrans actuels : P-EX **gardé comme vue plein écran** de la tuile Progression (même route conservée en redirection ou en sous-route `/exercises/:id/progress`) ; liste d'exercices de PROG **supprimée** ou remplacée par une ligne « Exercices » vers EXO ; P-REC **gardé** (vue transversale), ouvert filtré depuis la tuile Record.
- Unifier : une seule requête de séances (celle de `listHistoricalWorkouts`, terminées), une seule règle de « meilleure série » qui suit la métrique (corrige D3/D4).
- Le bascule Suivi/Documentation reste : c'est une séparation juste (le commentaire `ExerciseDetailScreen.tsx:228-230` le dit bien).

### 5.2 Page Séance passée — `/history/:id` (enrichie, pas fusionnée)

```
← Push A · jeu. 12 nov.                         ⋯
  Bloc Force · semaine 3 · Construction           (ligne d'état, → bloc)
┌ Durée ─┬ Séries ─┬ Tonnage ────────┐            (3 petites)
│ 1 h 05 │ 18      │ 6 420 kg        │
└────────┴─────────┴─────────────────┘
RECORDS DE CETTE SÉANCE                           (absent si aucun)
  Développé couché · 1RM est. 96 kg   >          → fiche exercice
CE QUE LE COACH EN A CONCLU                       (absent si rien)
  Développé couché · objectif 82,5 kg · suivi
MUSCLES (carte)
EXERCICES  — titre de chaque carte = lien vers la fiche
```
- Données toutes déjà en base ; `listRecordsForWorkout` existe ; une lecture `coachRecommendations` par `sourceWorkoutId` à écrire dans le dépôt.
- FIN reçoit seulement la ligne « records de cette séance » (un rappel, pas une page).

### 5.3 Page Muscle — nouvelle `/muscles/:muscle` + index `/muscles` (fusion P-MUS + REG-V + MUS-S)

```
← Ischio-jambiers
┌ Cette semaine ─────────┬ Tes bornes ─────────┐  (large + petite empilée)
│ 4 séries  ↓ sous 8     │ plancher 8          │
│ médiane 6 sem. : 7     │ plafond auto 11  >  │  → feuille des bornes
└────────────────────────┴─────────────────────┘
┌ 12 semaines (grande) — barres par semaine, ligne du plancher ┐
EXERCICES QUI LE TRAVAILLENT        (la liste de MUS-S)
  Soulevé de terre roumain   >      → fiche exercice
```
- Index `/muscles` = P-MUS actuel (carte du corps + classement), chaque ligne → page du muscle.
- **Une seule définition** affichée de la semaine et du volume (celle du coach, qui gouverne les alertes), et la moyenne de période dite comme telle. Le nom unique : « Séries par muscle ». « Volume » reste au tonnage.
- REG-V devient une ligne de Réglages › Coach qui ouvre l'index `/muscles` (route conservée en redirection), ou disparaît de Réglages : à trancher avec la décision du sommaire (la spec garde `/settings/volume` ; ne pas la casser pendant la refonte en cours).
- `HomeVolumeCard` → page du muscle concerné (un muscle) ou l'index (plusieurs). La carte du corps de l'accueil → page du muscle plutôt que la feuille.

### 5.4 Page Semaine — `/analytics/weekly` élargie (fusion P-SEM + P-VOL)

```
← Ta semaine                          [12 sem. ▾]
┌ Séances ───────────┬ Tonnage ───────────┐   (2 larges)
│ 3 / 4   série : 5  │ 18,2 t  ↑ 6 %      │
└────────────────────┴────────────────────┘
┌ grande : barres séances/semaine, objectif ; bascule Tonnage | Durée ┐
SEMAINES
  semaine du 9 nov.   3 séances · 18,2 t   >   → /history filtré sur la semaine
```
- La tuile d'accueil ouvre cette page et **affiche le même nombre** (un seul découpage de semaine, D5).
- Rapport mensuel gardé à part : autre unité, décision documentée au Lot 12.

### 5.5 Bloc — `/programs/:id` (enrichi)
Ajouter : séances faites liées à HIS-D, tonnage/séries par semaine du bloc (petite tuile empilée). Pas de fusion.

### 5.6 Progression devient l'entrée — `/analytics`
Tuiles d'entrée vers les pages d'objet, chacune avec son chiffre (corrige l'écart n° 2 de `DESIGN.md`) :
```
┌ Cette semaine (large) 3/4 · 18,2 t ┐┌ Records (petite) dernier 12 nov. ┐
┌ Muscles (large) 2 sous le plancher ┐┌ Paliers (petite) 14        ┐
┌ Corps (large) 82,4 kg ↓ 0,6 ──────────────────────────────────────┐
  Rapport du mois   >      (ligne)
```
Plus de liste d'exercices ici : l'objet Exercice a son onglet. Pas de « records ce mois » : le Lot 12 a écarté ce chiffre parce qu'un record battu disparaît de son mois (`00-ROADMAP.md`, Lot 12).

### 5.7 Routine
ROU-E reçoit une ligne « Dernières séances » (3, → HIS-D). Rien d'autre : l'éditeur est la page de l'objet et c'est juste (`router.tsx` le commente).

---

## 6. Ce qu'il ne faut pas intégrer

- **Séance en direct (`/workout`)** : l'écran le plus important (règle n° 5). Pas de lien vers la fiche, pas de courbe, pas de journal coach — la carte objectif et la note de record suffisent. Le chunk paresseux des analyses ne doit pas y entrer (§12.2).
- **Écran de fin** : un geste de clôture, pas une page de lecture ; il ne reçoit qu'une ligne « records ».
- **Revue des cibles** (`/routines/:id/review`) : un geste du canapé, séparé à dessein (`router.tsx`) ; ne pas la verser dans la page Exercice.
- **Réglages** : structure décidée (sommaire + 5 pages). Seul REG-V est candidat à déménager, et seulement après la refonte en cours.
- **Wiki / Documentation** : lecture froide ; la fiche y renvoie déjà par un onglet interne.
- **P-REC et P-PAL** : vues transversales légitimes (« tous mes records ») ; ils restent, ils gagnent des liens.
- **Rapport mensuel** : unité calendaire différente, assumée au Lot 12.
- **Sauvegarde** : le doublon accueil / Réglages est voulu (même état, deux moments).

---

## 7. Coût et ordre de réalisation

| # | Étape | Ampleur | Ce qu'elle casse | Valeur immédiate |
|---|---|---|---|---|
| 1 | **Liens** : ligne d'historique fiche → HIS-D ; titre d'exercice HIS-D → fiche ; table P-EX → HIS-D ; P-EX → fiche ; palier → séance ; séance de bloc faite → HIS-D ; retours de P-REC et REG-V en `navigate(-1)` | petite | rien (aucune route) ; tests unitaires des écrans touchés | les objets se rejoignent tout de suite |
| 2 | **Corriger D3/D4** : une règle de meilleure série (suit la métrique, assistance = min) ; fiche lue via `listHistoricalWorkouts` ; FIN « best » renommé ou aligné | petite | tests de `workoutHistory` / fiche ; `listSessionsForExercise` n'a qu'un consommateur | chiffres justes |
| 3 | **HIS-D enrichie** (records, coach, contexte de bloc) ; FIN : ligne records | petite à moyenne (une lecture coach par séance à ajouter au dépôt) | rien ; `e2e/seance.spec.ts` à étendre | répond à « qu'est-ce que le coach a conclu ce jour-là » |
| 4 | **Page Exercice** : tuiles + mini-courbe ; P-EX devient sa vue plein écran ; PROG pointe vers la fiche | moyenne | route `/analytics/exercises/:id` (garder en redirection) ; `ExerciseAnalyticsScreen.test.tsx`, `AnalyticsScreen.test.tsx` ; `mise-en-page.spec.ts` (nouvelle page à mesurer dans les 4 thèmes) ; chunk : la mini-courbe ne doit pas tirer le module graphique dans EXO-D si la fiche est ouverte en séance (elle ne l'est pas aujourd'hui) | une page par exercice |
| 5 | **Page Muscle** + vocabulaire unique ; `HomeVolumeCard` et carte du corps y mènent ; unifier le découpage de semaine du coach et de l'analyse | moyenne à grosse (une décision de définition à prendre avec l'utilisateur, D1) | `/settings/volume` (redirection), `e2e/volume.spec.ts` (parcours Réglages › Coach › Volume par muscle et bouton « Régler »), `mise-en-page.spec.ts` ; **à faire après** la refonte des Réglages | fin du « 9,5 ici, 11 là » |
| 6 | **Page Semaine** (fusion P-SEM + P-VOL), un seul découpage de semaine (D5) ; HIS filtrable par semaine | moyenne | `/analytics/volume` (redirection), `WeeklyVolumeScreen.test.tsx`, liens `HomeBodyCard` | tuile et page disent le même nombre |
| 7 | **Progression en tuiles d'entrée** ; extraire un composant `Tile` partagé (`DESIGN.md` écart n° 3) | moyenne | `AnalyticsScreen.test.tsx`, `mise-en-page.spec.ts` | le tableau de bord devient un tableau de bord |
| 8 | Factoriser les `VolumeEntry` sur `volumeSource` (D6) | petite | tests unitaires seulement | prévient la prochaine divergence |

Les étapes 1 à 3 ne déplacent aucune route et livrent chacune seule ; 4 donne la première page d'objet ; 5 attend la fin de la refonte des Réglages et une décision de l'utilisateur sur la définition du volume par muscle.
