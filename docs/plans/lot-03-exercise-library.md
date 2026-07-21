# Lot 3 — Bibliothèque d'exercices (M2)

**Objectif :** consulter, chercher et créer des exercices. Premier lot qui livre une fonctionnalité
que l'utilisateur ouvre pour elle-même.

**RF couverts :** RF-06 (catalogue), RF-07 (recherche/filtres), RF-08 (exercices personnalisés,
**illimités**), RF-09 (notes), RF-10 (historique et record par exercice).
**Dépend de :** Lots 1 et 2, tous deux terminés et validés.
**Budget :** 1 à 2 sessions.
**Références obligatoires :** `docs/plans/01-ARCHITECTURE.md` §7 (règle de dépendance),
`PROGRESS.md` → « Parti pris visuel », qui **fait foi** et n'est pas rediscuté ici.

---

## Ce que le Lot 2 a déjà livré (à ne pas réécrire)

| Existant | Fichier |
|---|---|
| `listExercises({ search, muscle, equipment })`, recherche sans accents, tri français | `data/repositories/exercises.ts` |
| `getExercise`, `createCustomExercise`, `updateExercise`, `deleteExercise` | idem |
| `getLastPerformance(exerciseId)` sur l'index `[exerciseId+performedAt]` | `data/repositories/workouts.ts` |
| `MUSCLE_GROUPS`, `EQUIPMENT`, `MEASUREMENT_TYPES` (tableaux `const`) | `data/types.ts` |
| 168 exercices au catalogue, seed idempotent | `data/seed/` |

**Le Lot 3 est donc à 80 % un lot d'interface.** Les seules lectures manquantes sont le comptage
total et l'historique par exercice.

---

## Les quatre pièges de ce lot

1. **La table `personalRecords` est vide et le restera jusqu'au Lot 6.** RF-10 demande le record
   par exercice *maintenant*. La tentation est d'écrire un moteur incrémental en avance : ce serait
   du Lot 6 fait à moitié, sans la validation de série qui l'alimente. Le Lot 3 **dérive** les
   records de l'historique réel, dans une fonction pure que le Lot 6 (détection en direct) et le
   Lot 13 (recalcul complet) réutiliseront telle quelle. Une seule définition de « ce qui compte
   comme un record » dans tout le projet.
2. **Aucune donnée de séance n'existe encore** (le Lot 5 les produit). Les sections « records » et
   « historique » de la fiche seront vides au checkpoint, et **c'est normal**. Elles doivent être
   testées avec des séances fabriquées (`src/test/factories.ts` existe déjà pour ça), pas
   « vérifiées à l'œil » sur une base vide.
3. **`useLiveQuery` re-rend à chaque écriture.** Un champ de texte contrôlé par la base voit son
   curseur sauter dès qu'on écrit dedans. Le motif est déjà tranché par le `NumberInput` du Lot 1 :
   **état local de brouillon, écriture immédiate en base, jamais de resynchronisation depuis la
   base pendant la frappe.**
4. **`react-hooks` v7 est en `error`, pas en `warning`.** Pas de `setState` dans un `useEffect`,
   pas de lecture de `ref.current` pendant le rendu. Ajuster l'état **pendant le rendu** derrière
   un `if (prop !== lastProp)`. Cf. `PROGRESS.md` → pièges.

---

## Parti pris de conception de ce lot

La charte est figée (Lot 1). Ce qui restait à trancher, et comment :

**Le relevé vivant.** L'écran est un instrument de recherche : un champ, deux filtres, et un
**relevé** qui indique combien d'exercices répondent. Le chiffre décompte en direct pendant la
frappe — `168` → `24 sur 168` → `0 sur 168` — dans la typographie exacte que `EmptyState` utilise
déjà pour son `0`. Conséquence : **l'état vide cesse d'être un cas particulier**, c'est le même
relevé à zéro, cohérent avec la règle du Lot 1 (« un état vide est un relevé à zéro, pas un
échec »). Le relevé sert aussi à quelque chose : il dit qu'un filtre est trop serré avant qu'on
ait fait défiler.

**Le groupement par initiale disparaît en recherche.** Les en-têtes de lettre existent pour
découper une liste longue. Une liste de six résultats n'est pas longue : les en-têtes deviendraient
du bruit. La structure encode donc un fait — « cette liste est trop longue pour être lue d'un
coup » — au lieu de décorer.

**L'accent ne marque que deux choses :** ce qui t'appartient (exercice perso) et ce qui est engagé
(filtre actif). Rien d'autre. Pas de code couleur par groupe musculaire : ce serait une seconde
palette et la charte n'en a qu'une.

**Écarté volontairement — la barre alphabétique verticale** (style répertoire iOS). Vingt-six
cibles de 20 px sur le bord droit : la règle des 48 px l'interdit, et la recherche fait déjà le
travail, mieux. C'est l'accessoire qu'on retire avant de sortir.

**Écarté volontairement — la virtualisation JavaScript.** Le cadrage la demande, mais elle casse
la recherche du navigateur, l'ancrage du défilement et les en-têtes collants, et §8 de
l'architecture exclut les composants tiers. À la place : `content-visibility: auto` +
`contain-intrinsic-size` sur chaque ligne — le navigateur saute la mise en page et le rendu des
lignes hors écran, sans une ligne de JS et sans rien casser. **À mesurer, pas à supposer** : si le
rendu de la liste complète dépasse 100 ms sur le téléphone, on rouvre le sujet.

---

## Tâche 1 — `lib/records.ts` (TDD, obligatoire)

**Fichiers :** créer `src/lib/records.ts`, `src/lib/records.test.ts`

`lib/` ne dépend de rien (§7 de l'architecture) : ces fonctions prennent un tableau de
`WorkoutSet` et rendent des objets. Aucun accès à Dexie, aucun React.

- [ ] **Étape 1.1 — Écrire les tests d'abord.** Cas à figer :
  - volume d'une série = `weight × reps`, `0` si l'un des deux manque (gainage, tractions) ;
  - `bestSets([])` rend un objet dont tous les champs sont `undefined` ;
  - la charge maximale ignore les séries `setType: 'warmup'` — **règle du Lot 6 encodée
    maintenant**, sinon le Lot 6 doit revenir modifier une fonction déjà utilisée ;
  - à égalité de charge, c'est la série **la plus ancienne** qui gagne : un record est établi la
    première fois qu'on l'atteint, pas la dernière ;
  - une série sans `weight` ne peut pas être la charge maximale, mais peut être le maximum de
    répétitions (tractions au poids du corps).

- [ ] **Étape 1.2 — Écrire l'implémentation.**

```ts
export interface BestSets {
  heaviest?: WorkoutSet;    // charge maximale, contexte reps inclus
  mostReps?: WorkoutSet;    // répétitions maximales
  bestVolume?: WorkoutSet;  // meilleure série en poids × reps
}

export function setVolume(set: WorkoutSet): number;
export function bestSets(sets: WorkoutSet[]): BestSets;
```

Rendre `undefined` plutôt que zéro quand la donnée n'existe pas : la fiche n'affiche alors
simplement pas la ligne, ce qui couvre les six `MeasurementType` sans un seul `switch`.

**Commit :** `test(lot-03): règles de dérivation des records` puis
`feat(lot-03): lib/records.ts, records dérivés de l'historique`.

---

## Tâche 2 — Les deux lectures manquantes

**Fichiers :** modifier `src/data/repositories/exercises.ts`, `src/data/repositories/workouts.ts`
et leurs tests.

- [ ] **Étape 2.1 — `countExercises(): Promise<number>`** dans `exercises.ts`. Compte les lignes
      vivantes. Sert le dénominateur du relevé (« 24 **sur 168** »).

- [ ] **Étape 2.2 — `listSessionsForExercise(exerciseId)`** dans `workouts.ts`, à côté de
      `getLastPerformance` : même index composé, même logique de filtrage.

```ts
export interface ExerciseSession {
  workoutId: string;
  workoutExerciseId: string;
  performedAt: number;   // date de la première série validée
  sets: WorkoutSet[];    // triées par `order`
}
export function listSessionsForExercise(exerciseId: string): Promise<ExerciseSession[]>;
```

Séances les plus récentes en premier. Ne remonte que les séries `isCompleted === 1` et
`deletedAt === 0` — une séance supprimée ne doit pas réapparaître dans l'historique d'un exercice,
exactement comme pour la « valeur précédente ».

- [ ] **Étape 2.3 — Tests** avec `seedWorkout()` de `src/test/factories.ts` : deux séances à deux
      dates, ordre décroissant vérifié ; une séance supprimée via `deleteWorkout` disparaît ;
      un exercice sans historique rend `[]`.

**Commit :** `feat(lot-03): comptage du catalogue et historique par exercice`.

---

## Tâche 3 — Vocabulaire français

**Fichiers :** créer `src/features/exercises/labels.ts` · modifier `src/i18n/fr.ts`

Le catalogue stocke `primaryMuscle: 'lower_back'`. L'interface est en français (ADR-007) : nulle
part une clé technique ne doit atteindre l'écran. L'écran de diagnostic du Lot 2 en affiche
volontairement (c'est son rôle), la bibliothèque non.

- [ ] **Étape 3.1** — les trois dictionnaires dans `fr.ts` : `muscle.*` (18 entrées),
      `equipment.*` (10), `measurement.*` (6). Typés pour qu'un ajout à `MUSCLE_GROUPS` sans son
      libellé **échoue à la compilation**.

- [ ] **Étape 3.2** — `labels.ts` : `muscleLabel(g)`, `equipmentLabel(e)`, `measurementLabel(m)`,
      et `exerciseSubtitle(exercise)` qui compose « Pectoraux · Barre ».

- [ ] **Étape 3.3** — toutes les chaînes des trois écrans. Voix : deuxième personne, factuelle,
      pas de remplissage. Un bouton dit ce qu'il fait (« Créer l'exercice », pas « Valider »), et
      le message de confirmation reprend le même verbe.

**Commit :** `feat(lot-03): vocabulaire français des groupes musculaires et des équipements`.

---

## Tâche 4 — Primitives `ui/` manquantes

**Fichiers :** créer `src/ui/FilterChip.tsx`, `src/ui/Textarea.tsx`, `src/ui/OptionSheet.tsx` ·
modifier `src/ui/index.ts`

- [ ] **Étape 4.1 — `FilterChip`** : 48 px de haut. Inactif = `--surface-2` / `--text-1` ;
      actif = pastille `--color-accent` avec `--color-accent-fg` par-dessus (jamais de l'accent en
      texte sur une surface — c'est la scission fill/ink du Lot 1). Un chip actif porte une croix
      d'effacement **dans la même cible tactile**, pas à côté : viser une croix de 16 px en sueur
      ne marche pas.

- [ ] **Étape 4.2 — `Textarea`** : même habillage que `Input`, hauteur mini 6 lignes.

- [ ] **Étape 4.3 — `OptionSheet`** : sélecteur d'option unique dans le `Sheet` du Lot 1. Une
      option = une ligne de 48 px, coche en `--accent-ink` sur la sélection. **Un seul composant
      sert les deux filtres de la liste et les trois champs à choix du formulaire** — cinq
      sélecteurs, une implémentation.

**Commit :** `feat(lot-03): chip de filtre, zone de texte et sélecteur d'option`.

---

## Tâche 5 — Écran Bibliothèque

**Fichiers :** réécrire `src/features/exercises/ExercisesScreen.tsx` · créer
`src/features/exercises/ExerciseList.tsx`, `src/features/exercises/SearchBar.tsx`

```
┌────────────────────────────────────┐
│ Exercices                        + │  h1 + création (action occasionnelle)
│ ┌────────────────────────────────┐ │
│ │ Chercher un exercice           │ │  recherche instantanée, sans accents
│ └────────────────────────────────┘ │
│ [ Muscle ▾ ] [ Matériel ▾ ]  168   │  filtres + RELEVÉ VIVANT (.metric)
│                            exercices│
├────────────────────────────────────┤
│ D                                  │  en-tête collant (.label-xs)
│ Développé couché (barre)           │
│ Pectoraux · Barre                  │
│ Développé couché (haltères)   perso│
├────────────────────────────────────┤
│ E                                  │
│ …                                  │
└────────────────────────────────────┘
```

- [ ] **Étape 5.1 — État de recherche et de filtres** en `useState` local. Pas de Zustand : cet
      état ne survit pas à l'écran et ADR-004 réserve Zustand à ce qui est éphémère **et**
      non reconstructible.

- [ ] **Étape 5.2 — Lecture** : `useLiveQuery(() => listExercises(filter), [search, muscle, equipment])`
      pour la liste, `useLiveQuery(countExercises)` pour le total. Un exercice créé ou supprimé
      met la liste à jour sans rien recharger.

- [ ] **Étape 5.3 — Relevé** : `{n}` en `.metric`, l'unité en `.label-xs` `--text-2`. Sans filtre
      « exercices », avec filtre « sur 168 ». **Ne jamais mettre `.label-xs` sur un symbole SI** —
      ici il n'y en a pas, mais la règle vaut pour tout le lot.

- [ ] **Étape 5.4 — Groupement par initiale**, en-têtes collants, **supprimés dès que la recherche
      est non vide**. Les initiales sont calculées sur le nom **normalisé** : « Élévations » se
      range sous E, pas sous É.

- [ ] **Étape 5.5 — `content-visibility: auto` + `contain-intrinsic-size`** sur chaque ligne, avec
      une hauteur intrinsèque égale à la hauteur réelle d'une ligne, sinon la barre de défilement
      saute pendant le défilement.

- [ ] **Étape 5.6 — État vide** : `EmptyState` avec `reading="0"`. Quand une recherche est active
      et ne rend rien, l'action proposée est **« Créer "{ce que tu as tapé}" »**, qui ouvre le
      formulaire avec le nom pré-rempli. Un écran vide est une invitation à agir, et c'est
      exactement le moment où on a besoin de créer un exercice.

**Commit :** `feat(lot-03): bibliothèque avec recherche, filtres et relevé vivant`.

---

## Tâche 6 — Fiche exercice

**Fichiers :** créer `src/features/exercises/ExerciseDetailScreen.tsx` · modifier `src/router.tsx`

Route `#/exercises/:id`. Retour vers « Exercices » dans le créneau d'action de `Screen`, comme
l'écran de diagnostic du Lot 2.

Sections, dans cet ordre — le plus consulté en premier :

- [ ] **Étape 6.1 — Identité** : nom, « Pectoraux · Barre », marque « unilatéral » si le champ
      est à 1, marque « perso » si `isCustom`.
- [ ] **Étape 6.2 — Records** (dérivés via `bestSets`) : charge maximale avec son contexte
      (`100 kg × 5`), meilleure série. Les lignes dont la valeur est `undefined` ne s'affichent
      pas. Section absente s'il n'y a aucun historique — pas de « — » aligné dans le vide.
- [ ] **Étape 6.3 — Historique** : une ligne par séance, date en français, séries résumées.
      Vide → une phrase, pas un `EmptyState` plein écran : on est dans une section, pas sur un
      écran.
- [ ] **Étape 6.4 — Notes (RF-09)** : `Textarea`, **écriture en base à chaque frappe** avec état
      local de brouillon (motif `NumberInput`). Pas de bouton « Enregistrer », donc jamais d'état
      non enregistré à perdre — cohérent avec la règle non négociable n°4.
- [ ] **Étape 6.5 — Repos par défaut (préparation RF-27)** : `NumberInput` en secondes, pas de
      2,5 remplacé par 15. Écrit dans `defaultRestSeconds`, que le Lot 6 lira.
- [ ] **Étape 6.6 — Actions** : « Modifier » et « Supprimer » **uniquement si `isCustom === 1`**.
      Un exercice du catalogue n'est pas modifiable ici — ses notes et son repos le sont, et c'est
      la bonne ligne de partage : le catalogue appartient à l'app, tes réglages t'appartiennent.
      Suppression en deux temps (motif `ConfirmAction` du Lot 2), jamais `window.confirm`.

**Commit :** `feat(lot-03): fiche exercice avec records, historique et notes`.

---

## Tâche 7 — Création et édition d'un exercice personnalisé

**Fichiers :** créer `src/features/exercises/ExerciseFormScreen.tsx` · modifier `src/router.tsx`

Routes `#/exercises/new` (avec `?name=` optionnel, alimenté par l'état vide de recherche) et
`#/exercises/:id/edit`. Écran plein, pas un `Sheet` : cinq champs dont trois sélecteurs ne tiennent
pas dans une feuille sans défilement interne.

- [ ] **Étape 7.1** — Champs : nom (obligatoire), muscle principal, équipement, type de mesure,
      unilatéral (interrupteur). Muscles secondaires : **hors périmètre du Lot 3**, ils n'ont aucun
      consommateur avant la carte de chaleur du Lot 12.
- [ ] **Étape 7.2** — Valeurs par défaut : `chest` / `barbell` / `weight_reps`. Un exercice se crée
      en tapant un nom et en appuyant sur un bouton ; les quatre autres champs sont des ajustements.
- [ ] **Étape 7.3** — Le type de mesure porte une explication en clair (« poids + répétitions —
      développé couché »), sinon le champ est indevinable.
- [ ] **Étape 7.4** — Action primaire **en bas** de l'écran (zone du pouce, contrainte du Lot 1),
      désactivée tant que le nom est vide. Redirige vers la fiche du nouvel exercice.
- [ ] **Étape 7.5** — **Aucune limite de nombre**, à aucun endroit du code (règle n°1). Le test
      des 60 exercices du Lot 2 le fige déjà côté données.

**Commit :** `feat(lot-03): création et édition d'exercices personnalisés`.

---

## Definition of Done

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build` passent tous les
      quatre.
- [ ] Les tests de `lib/records.ts` et de `listSessionsForExercise` passent, avec des séances
      fabriquées — pas seulement sur une base vide.
- [ ] Contrastes **mesurés dans le navigateur**, thème sombre **et** clair, sur toutes les paires
      nouvelles (chips actifs et inactifs, en-têtes collants, marque « perso », relevé) : ≥ 4,5:1.
- [ ] Cibles tactiles mesurées en pixels réels : lignes de liste, chips, options de sélecteur,
      bouton de création — toutes ≥ 48 px.
- [ ] Mise en page mesurée en 375×812 : aucun débordement horizontal, rien de masqué par la barre
      de navigation.
- [ ] Coût de rendu de la liste complète mesuré et consigné dans `PROGRESS.md`.

## ✅ Checkpoint utilisateur — **à faire au doigt, sur le téléphone**

Le Lot 2 a été validé sur PC faute d'interaction tactile. Ce lot en est plein : recherche, filtres,
liste longue. **Le checkpoint sur PC ne vaut rien ici.**

- [ ] Tu cherches « squat » : tu trouves. Tu tapes « developpe » sans accent : tu trouves quand même.
- [ ] Tu filtres sur « Haltères » : la liste se réduit et le relevé décompte.
- [ ] Tu crées un exercice à toi, il apparaît dans la liste et survit à un rechargement complet.
- [ ] Tu écris une note sur une machine (« siège position 4 »), tu quittes l'écran, tu reviens :
      elle est là.
- [ ] Tu fais défiler les 168 exercices d'un coup de pouce : c'est fluide, sans à-coups.
