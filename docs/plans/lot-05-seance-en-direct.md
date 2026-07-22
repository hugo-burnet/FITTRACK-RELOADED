# Lot 5 — Séance en direct, cœur (M4)

> Plan détaillé généré au début de la session, à partir du code réellement existant (procédé des
> Lots 3 et 4). Le cadrage figé est dans `00-ROADMAP.md § Lot 5`.

**Objectif :** l'écran que l'utilisateur regardera 60 fois par séance, essoufflé, d'une main.

**RF couverts :** RF-17 (séance vide ou depuis une routine), RF-18 (saisie série par série),
RF-19 (valeur précédente, tapable), RF-21 (ajout/suppression de séries et d'exercices),
RF-24 (sauvegarde), RF-25 (reprise après interruption).

**Dépend de :** Lots 3 et 4. **Budget :** 3 sessions — le lot le plus lourd du projet.

**Ce lot n'est pas fini quand il est vert.** Le Lot 4 est passé typecheck + lint + 148 tests +
contrastes mesurés, et l'utilisateur a trouvé **sept défauts en deux essais au doigt**. Un
aller-retour de correctifs après le premier essai réel fait partie du lot, pas de l'après-lot.

---

## Ce qui existe déjà (à ne pas réécrire)

| Acquis | Où | Usage ici |
|---|---|---|
| `startWorkout`, `addSet`, `completeSet`, `finishWorkout`, `deleteWorkout` | `data/repositories/workouts.ts` | Socle — mais **`addSet` a un bug d'`order`**, cf. Tâche 3 |
| `getLastPerformance` | idem | RF-19 — **incomplet**, cf. le piège n°1 |
| `listSessionsForExercise` | idem | Rien ici, c'est le Lot 7 |
| `getRoutineDetail(id)` | `repositories/routines.ts` | Démarrer une séance depuis une routine |
| `moveItem`, `normalizeSupersets`, `toBlocks` | `lib/routineOrder.ts` | Réorganiser **pendant** la séance |
| `ReorderableList`, `edgeScrollDelta` | `ui/` | Idem, au doigt |
| `measurementShape`, `targetParts` | `lib/measurement.ts` | Quels champs afficher, et comment les lire |
| `isWorkingSet`, `setVolume`, `bestSets` | `lib/records.ts` | Totaux de fin de séance |
| `ActionSheet`, `ConfirmSheet`, `OptionSheet`, `Sheet` | `ui/` | Menus « ⋯ », abandon, type de série |
| `ExerciseBrowser` | `features/exercises/` | Ajouter un exercice **en cours de séance** |
| `Screen` avec `onBack` | `app/` | Le cadre commun |

---

## Les six pièges de ce lot

**1. `getLastPerformance` renverra la séance en cours.** Elle remonte l'index
`[exerciseId+performedAt]` et s'arrête sur la première série validée. Dès que la série 1
d'aujourd'hui est cochée, « précédent » affiche **la série d'aujourd'hui**. La colonne entière
devient un miroir au lieu d'une référence. → paramètre `excludeWorkoutId`, avec un test qui
échoue sans lui.

**2. `addSet` compte les séries supprimées.** `db.workoutSets.where(...).count()` ne filtre pas
`deletedAt`. Supprimer une série puis en ajouter une produit **deux séries de même `order`**, et
l'ordre d'affichage devient celui du hasard. Le Lot 4 n'a jamais exercé ce chemin parce que rien
ne créait de `WorkoutSet`. → compter les vivantes, et renuméroter à la suppression.

**3. Une séance abandonnée continue d'alimenter l'historique.** `finishWorkout` ne regarde que
le `Workout` ; les `WorkoutSet` validées gardent `isCompleted: 1` et `performedAt > 0`, donc
`getLastPerformance` et les records du Lot 3 les voient. Une séance ratée deviendrait la
référence de la suivante. → `discardWorkout` cascade le *soft delete*, comme `deleteWorkout`.

**4. Les séries jamais cochées ne doivent pas entrer dans l'historique.** Une routine de 6 × 4
séries crée 24 lignes ; on en fait 17. Les 7 autres ne sont pas des séries à zéro, ce sont des
séries qui n'ont pas eu lieu. → `finishWorkout` les supprime, et supprime les exercices qui
n'ont plus rien.

**5. Le clavier et le focus.** Rappel du Lot 4, ici multiplié par vingt : un effet qui prend le
focus ne dépend que de `open` ; `Entrée` doit défocaliser ; et **vérifier un champ, c'est vérifier
`document.activeElement` et `selectionStart`, pas seulement la valeur.** Ici les champs sont dans
une grille, pas dans une feuille : un re-rendu qui déplace le focus fait taper le poids de la
série 3 dans la série 2.

**6. `NumberInput` ne rentre pas dans la grille.** Il porte deux boutons ± de 48 px : 96 px de
chrome par cellule, pour deux cellules, sur 375 px de large. La grille a besoin d'une cellule nue.
→ extraire le cœur (`parse` / `format` / `draft`) dans `ui/numberField.ts`, consommé par les deux.
Pas de copier-coller : c'est le module qui a rendu `102,5` saisissable.

---

## Parti pris de conception de ce lot

### La saisie est en ligne, pas dans une feuille — et ça ne contredit pas le Lot 4

Le Lot 4 a tranché « une série se modifie dans une feuille, pas en ligne », parce qu'un éditeur de
routine, c'est 3 valeurs × 5 séries × 6 exercices posées d'un coup, assis. **La séance en direct
est l'inverse** : une ligne à la fois, entre deux séries, une main. Le checkpoint chiffre
l'exigence — *au maximum 2 appuis quand les valeurs sont identiques à la fois précédente*. Une
feuille coûte déjà 2 appuis pour s'ouvrir et se fermer.

### Le geste : ✓ sur un champ vide valide la valeur fantôme

Trois états pour une cellule, et un seul geste :

| Ce que la cellule montre | D'où ça vient | Ce que ✓ enregistre |
|---|---|---|
| Une valeur en clair | la routine l'a prescrite, ou tu l'as tapée | cette valeur |
| Une valeur en gris (`--text-3`) | ta dernière séance sur cet exercice | **cette valeur** |
| Rien | ni prescription ni historique | rien — la série reste incomplète |

Toucher le gris le fait passer en clair et ouvre le clavier. **Ne pas y toucher et cocher revient
au même** : c'est le chemin à un seul appui, celui de la série identique à la précédente. C'est
`--text-3` qui reprend son rôle exact du Lot 1 — « une valeur volontairement atténuée, un écho de
donnée qu'on peut réutiliser ».

### La colonne « précédent » reste une colonne, elle n'est pas un placeholder

Tentant, sur 375 px, de faire de la valeur précédente le placeholder du champ. Mais le moment où
elle sert vraiment, c'est **quand on ne la reprend pas** : « la dernière fois 80 × 10, aujourd'hui
j'essaie 82,5 ». Un placeholder disparaît à la première frappe, précisément là.

Budget de largeur mesuré à 375 px : 343 utilisables, moins 24 de gouttière de carte = **319**.
`n° 22` + `précédent 62` + `charge 76` + `reps 56` + `✓ 48` = 264, plus 4 gouttières de 6 = **288**.
Il reste 31 px. À **vérifier en pixels réels**, pas ici.

### Une prescription qui nomme un nombre pré-remplit ; une fourchette, non

Démarrer depuis une routine recopie `targetWeight` dans `weight` et `targetReps` dans `reps` —
`isCompleted` reste 0, `performedAt` reste 0, donc rien n'est compté. Mais **une fourchette 8–12
ne pré-remplit pas** : pré-remplir 8 ferait valider 8 à quelqu'un qui en a fait 12. Une fourchette
n'est pas une valeur ; elle s'affiche en gris, comme une prescription à lire.

### Écriture en base à la frappe, validation à la coche

La règle non négociable n°4 exige l'écriture à chaque série validée. On écrit **plus tôt** : chaque
frappe pose `weight`/`reps` sur la ligne, `isCompleted` reste 0 et `performedAt` reste 0. Rien
n'entre dans l'historique tant que ce n'est pas coché, et un kill de l'app ne coûte pas les trois
caractères en cours. Même motif de `draft` local qu'au Lot 3 pour ne pas déplacer le curseur.

### Aucun store Zustand dans ce lot

ADR-004 réserve Zustand à l'éphémère non reconstructible. Le chronomètre se dérive de
`workout.startedAt` ; la séance en cours se lit par `getActiveWorkout()`. Un store qui recopierait
ça serait la deuxième source de vérité que l'ADR interdit — et exactement là que naissent les
pertes de séance. `stores/activeWorkout.ts` **n'est pas créé**. Le Lot 6 en aura un vrai besoin
(minuteur de repos), pas celui-ci.

### La barre de reprise vit au-dessus de la navigation

RF-25 dit « au démarrage, proposer de reprendre ». Une redirection automatique vers l'écran de
séance serait un détournement : on peut très bien rouvrir l'app pour chercher une note d'exercice.
À la place, une barre permanente au-dessus des onglets dès qu'une séance est `active` et qu'on
n'est pas dessus. Elle répond aux deux besoins d'un coup : *reprendre après un kill*, et *revenir
après être allé voir autre chose*.

### Le volume ne ment pas sur les mouvements au poids du corps

Un `weight` de 10 kg vaut trois choses selon `measurementType` (Lot 4) : une charge, un lest, une
assistance. Un tonnage qui additionne les trois est faux. → le tonnage ne compte que les séries
dont le poids **est** la charge (`weightRole: 'load'`). Une séance de tractions afficherait donc
un tonnage nul : l'écran de fin montre pour cette raison **trois chiffres**, séries · reps ·
tonnage, et pas seulement le dernier.

### Ce que ce lot ne fait pas

À annoncer dans le résumé de fin de lot, pas seulement ici — la leçon du Lot 4 :

- **Le minuteur de repos.** Lot 6, RF-22/RF-27. Le repos par exercice est déjà stocké et affiché,
  rien ne le déclenche encore.
- **Changer le type d'une série en séance** (échauffement / dégressive / échec). Lot 6, RF-20. Le
  type **est repris de la routine** et affiché, il ne se modifie pas ici.
- **Le RPE.** Lot 6, RF-30. Le champ existe en base, aucun écran ne l'écrit.
- **La détection de record en direct.** Lot 6, RF-23.
- **Relire ou corriger une séance passée.** Lot 7. Cet écran ne connaît que la séance `active`.
- **La saisie d'une durée en `m:ss`.** Ici une durée se saisit en secondes. Les exercices
  chronométrés sont une minorité et `mm:ss` est un composant à part entière ; à rouvrir si ça gêne.
- **Le côté (`side`) des exercices unilatéraux.** `isUnilateral` existe depuis le Lot 2 et n'est
  toujours lu par personne — c'est le contrôle « champ déclaré et lu par personne » de fin de lot,
  à consigner dans `PROGRESS.md` comme *en attente* et non comme *oublié*.

---

## Tâche 1 — `lib/measurement.ts` : les colonnes de saisie (TDD)

Le module dit déjà **ce qu'une série prescrit**. Il doit dire aussi **ce qu'on saisit**, sinon la
grille redéciderait dans son coin et les deux finiraient par se contredire — le bug que ce module
a justement été écrit pour rendre impossible.

```ts
export interface EntryColumn {
  field: TargetField;
  unit: TargetUnit;
  prefix?: '+' | '−';   // lest, assistance
}

/** Les colonnes de la grille, dans l'ordre où on les remplit. */
export function entryColumns(type: MeasurementType): EntryColumn[];

/** Ce qu'une série *réalisée* affiche — même mise en forme que `targetParts`. */
export function performedParts(
  type: MeasurementType,
  set: { weight?: number; reps?: number; durationSeconds?: number; distanceMeters?: number },
): TargetPart[];
```

`entryColumns` a **son propre ordre**, différent de celui de `measurementShape().fields` : on lit
« 8 – 12 reps · 102,5 kg » mais on saisit la charge puis les reps, parce que c'est l'ordre dans
lequel on décide (la charge est sur la barre avant la première rep). Colonne « charge-ish »
d'abord (`weight`, `distance`), colonne « compte-ish » ensuite (`reps`, `duration`).

`performedParts` remappe vers `Targets` et réutilise `targetParts` — zéro règle de formatage
dupliquée.

**Tests** (`lib/measurement.test.ts`, à la suite des 17 existants) : les 6 types donnent les bonnes
colonnes dans le bon ordre ; les préfixes `+`/`−` tombent sur `reps_only` et
`assisted_weight_reps` ; `performedParts` d'un `time_only` à 45 s donne `45 s` et ignore un `reps`
resté d'une édition précédente.

**Commit :** `feat(lot-05): colonnes de saisie derivees du type de mesure`

---

## Tâche 2 — `lib/volume.ts` (TDD)

Fichier annoncé au §7 de l'architecture, jamais écrit.

```ts
export interface SessionTotals {
  workingSets: number;      // hors échauffement
  totalReps: number;
  tonnage: number;          // kg, uniquement là où le poids EST la charge
  durationSeconds: number;
  distanceMeters: number;
}

export function sessionTotals(
  entries: { set: WorkoutSet; weightRole?: WeightRole }[],
): SessionTotals;
```

**Tests :** l'échauffement ne compte nulle part (réutilise `isWorkingSet`, ne le redit pas) ; un
lest (`added`) et une assistance (`assist`) n'ajoutent **rien** au tonnage mais leurs reps
comptent ; une planche ajoute des secondes et zéro tonnage ; une série incomplète (`weight` sans
`reps`) vaut 0 en tonnage sans faire tomber le total.

**Commit :** `feat(lot-05): totaux de seance (lib/volume, TDD)`

---

## Tâche 3 — `data/repositories/workouts.ts`

### Correctifs sur l'existant

- **`getLastPerformance(exerciseId, excludeWorkoutId?)`** — piège n°1. Test : une séance validée
  hier, une série validée aujourd'hui dans le workout `W` ; sans le paramètre le résultat est
  celui d'aujourd'hui, avec le paramètre c'est celui d'hier.
- **`addSet`** — compter les séries **vivantes** (piège n°2). Test : 3 séries, on supprime la 2e,
  on en ajoute une → les `order` valent 0, 1, 2, sans doublon ni trou.
- **`completeSet`** — accepte aussi `durationSeconds` et `distanceMeters`.
- **`finishWorkout`** — supprime les séries non cochées puis les exercices restés vides, en une
  transaction, avant de clore (piège n°4).

### Ajouts

| Fonction | Rôle |
|---|---|
| `startWorkoutFromRoutine(routineId)` | Copie profonde routine → séance. Reprend `order`, `supersetGroup`, `notes`, `setType`. Pré-remplit `weight`/`reps`/`durationSeconds`/`distanceMeters` depuis les cibles **sauf pour une fourchette de reps**. |
| `getWorkoutDetail(workoutId)` | Ce que l'écran dessine, en une lecture. `null` si absente (piège `useLiveQuery` du Lot 3). Porte `previous: WorkoutSet[]` par exercice, filtré de la séance en cours. |
| `addWorkoutExercise(workoutId, exerciseId)` | RF-21. Crée la ligne **et une première série vide** — un exercice sans ligne à cocher est un cul-de-sac. |
| `removeWorkoutExercise(rowId)` | Cascade sur ses séries. |
| `reorderWorkoutExercises(workoutId, from, to)` | `moveItem` + `normalizeSupersets`, comme les routines. |
| `updateSetValues(setId, values)` | Écriture à la frappe. Ne touche ni `isCompleted` ni `performedAt`. |
| `uncompleteSet(setId)` | Décocher. `performedAt` retombe à 0 : la série sort de l'historique et de la valeur précédente. |
| `deleteSet(setId)` | *Soft delete* **et renumérotation** des sœurs vivantes. |
| `duplicateLastSet(rowId)` | « Ajouter une série » recopie la précédente (précédent du Lot 4). |
| `discardWorkout(workoutId)` | `status: 'discarded'` **plus** cascade du *soft delete* (piège n°3). |
| `updateWorkout(id, changes)` | Nom et notes de séance. |

**Tests** (`workouts.test.ts`, à la suite des existants) : un par piège, plus le cycle complet
routine → séance → 2 séries validées sur 4 → `finishWorkout` → il reste 2 séries, l'exercice
survit ; et un exercice dont **aucune** série n'est cochée disparaît de la séance close.

**Commits :** `fix(lot-05): ordre des series et valeur precedente de la seance en cours`
puis `feat(lot-05): demarrer, modifier et clore une seance`

---

## Tâche 4 — `ui/numberField.ts` + la cellule de saisie

Extraire de `NumberInput` : `NUMERIC`, `parseNumber`, `formatNumber`. `NumberInput` les importe
au lieu de les déclarer (aucun changement de comportement, les 4 tests existants le prouvent).

`features/workout/SetValueCell.tsx` — un `<input>` nu, `inputMode="decimal"`, `enterKeyHint="done"`,
`Entrée → blur`, `onFocus → select()`, même `draft` local. Deux registres : valeur saisie en
`--text-1`, valeur fantôme en `--text-3`, **la même typographie et la même position** — sinon la
ligne saute au moment où on la remplit.

**Commit :** `refactor(lot-05): coeur numerique partage entre NumberInput et la grille`

---

## Tâche 5 — L'écran de séance

`features/workout/WorkoutScreen.tsx`, `WorkoutExerciseCard.tsx`, `WorkoutSetRow.tsx`,
`ElapsedTime.tsx`. Route `#/workout`. Sans séance active : redirection vers `/`.

- **En-tête** : nom de la séance (modifiable), chronomètre `h:mm:ss` dérivé de `startedAt`
  (`setInterval` d'1 s, pas de store), menu ⋯ (renommer, notes, abandonner).
- **Corps** : `ReorderableList` de cartes, même anatomie qu'au Lot 4 (poignée, nom, ⋯), avec la
  grille de séries et « + Ajouter une série ». Le filet de superset et les lettres A/B/C sont
  repris tels quels.
- **Fin de liste** : « Ajouter un exercice » en ligne pleine largeur → `#/workout/add`.
- **Barre collante** : « Terminer la séance ».

Une ligne cochée change de fond (`--surface-2`) et sa coche passe en accent : l'état d'une série
doit se lire à un mètre, sans lunettes.

**Commit :** `feat(lot-05): ecran de seance en direct`

---

## Tâche 6 — Les entrées, la reprise, la sortie

- `app/ActiveWorkoutBar.tsx`, rendue par `AppShell` au-dessus de `BottomNav` quand une séance est
  active et que la route n'est pas `/workout`.
- `HomeScreen` : « Démarrer une séance vide », ou la carte de reprise si une séance est active.
  L'écran d'accueil cesse d'être un état vide décoratif.
- `RoutineEditorScreen` : la barre collante devient **« Terminé » + « Démarrer la séance »**
  (primaire). « Ajouter un exercice » descend en fin de liste, comme « Ajouter une série » est
  déjà en fin de carte. Trois boutons sur 343 px feraient des libellés tronqués, et le verbe de
  cet écran en salle est *démarrer*.
- `RoutinesScreen` : « Démarrer » en tête du menu ⋯ d'une routine.
- `features/workout/WorkoutAddExerciseScreen.tsx` : `ExerciseBrowser` en sélection multiple,
  exactement comme `routines/:id/add`.

**Commit :** `feat(lot-05): demarrer une seance, la reprendre, y revenir`

---

## Tâche 7 — L'écran de fin

`features/workout/WorkoutFinishScreen.tsx`, route `#/workout/finish`.

Durée, **séries · reps · tonnage** (Tâche 2), liste repliée des exercices, champ notes, puis
« Enregistrer la séance » (primaire) et « Abandonner » (`--danger-ink`, avec `ConfirmSheet` qui
dit combien de séries sont perdues — un nombre, pas un avertissement générique).

**Commit :** `feat(lot-05): ecran de fin de seance`

---

## Definition of Done

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build` — les quatre.
- [ ] **Piège n°1 vérifié en base** : « précédent » affiche bien la séance d'avant après avoir
      coché la série 1 d'aujourd'hui.
- [ ] **Piège n°2 vérifié en base** : suppression + ajout de série → `order` 0…n sans doublon.
- [ ] **Piège n°3 vérifié en base** : après un abandon, `getLastPerformance` renvoie la séance
      d'avant.
- [ ] **Piège n°4 vérifié en base** : séance close depuis une routine de 4 séries dont 2 cochées
      → 2 séries en base, et un exercice vide a disparu.
- [ ] **Reprise vérifiée pour de vrai** : séance en cours, rechargement complet de la page →
      les valeurs saisies **non cochées** sont là.
- [ ] **Focus vérifié comme au Lot 4** : `102,5` tapé en entier dans la charge de la série 3 →
      `document.activeElement` reste ce champ, `selectionStart` à 5, et la série 2 n'a pas bougé.
- [ ] Chemin à **un appui** mesuré : série identique à la précédente = un seul `click`.
- [ ] Contrastes mesurés sur les 3 écrans du lot × 2 thèmes, y compris la ligne cochée et le
      texte fantôme `--text-3` sur `--surface-1` **et** sur `--surface-2`.
- [ ] Cibles tactiles en 375 × 812 : rien sous 48 px de haut ni 44 px de large, **coche comprise**.
- [ ] Aucun débordement horizontal sur la grille, aux 6 types de mesure.
- [ ] Non-régression Lot 4 : la routine dupliquée au checkpoint démarre sans altérer la routine.

## ✅ Checkpoint utilisateur — **en salle, pour de vrai**

Le plus important du projet. Aucune de ces lignes ne se vérifie depuis un PC.

- [ ] **Tu fais une vraie séance complète avec l'app.**
- [ ] En pleine séance : tu tues l'app depuis le gestionnaire de tâches, tu la rouvres → la séance
      reprend exactement où elle en était, aucune série perdue.
- [ ] Mode avion pendant toute la séance → aucune différence.
- [ ] Tu saisis une série sans lunettes, d'une main, en 3 secondes.
- [ ] Tu ajoutes un exercice non prévu au milieu de la séance, et tu en réordonnes deux au doigt.
- [ ] Tu te trompes de ligne, tu décoches, tu corriges.
