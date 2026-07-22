# Lot 4 — Routines (M3)

**Objectif :** composer des modèles de séance réutilisables. Premier lot où l'utilisateur **écrit**
quelque chose de long et de structuré, et où il peut donc le perdre.

**RF couverts :** RF-11 (création), RF-12 (dossiers), RF-13 (duplication / réorganisation /
édition / suppression), RF-14 (supersets), RF-15 (routines prêtes à l'emploi).
**Dépend de :** Lots 1, 2 et 3, tous terminés et validés.
**Budget :** 2 sessions.
**Références obligatoires :** `01-ARCHITECTURE.md` §3 (typage IndexedDB), §7 (règle de dépendance),
`PROGRESS.md` → « Parti pris visuel », qui **fait foi** et n'est pas rediscuté ici.

---

## Ce qui existe déjà (à ne pas réécrire)

| Existant | Fichier | Ce que le Lot 4 en fait |
|---|---|---|
| `newEntity` / `touch` / `softDelete` / `alive` | `data/repositories/base.ts` | Toute la persistance |
| Cascade transactionnelle (`deleteWorkout`) | `data/repositories/workouts.ts` | Modèle à copier pour `deleteRoutine` |
| `listExercises({search, muscle, equipment})` sans accents | `data/repositories/exercises.ts` | Le sélecteur d'exercices |
| `OptionSheet`, `Sheet`, `Card`, `ListRow`, `ConfirmAction`, `FilterChip`, `NumberInput`, `EmptyState` | `ui/` | Partout |
| `muscleLabel` / `equipmentLabel` / `exerciseSubtitle` | `i18n/labels.ts` | Sous-titres des exercices |
| Le relevé vivant (`.metric` + `.label-xs`) | `ExercisesScreen` | Compteur de séries d'une routine |
| L'en-tête collant de `ExerciseList` | `ExerciseList.tsx` | En-tête de **dossier** |
| Action primaire **collante** en bas d'écran | `ExerciseDetailScreen` | L'éditeur de routine |

Les quatre entités (`RoutineFolder`, `Routine`, `RoutineExercise`, `RoutineSet`) et leurs index
**existent déjà** dans `db.ts` depuis le Lot 2. Aucune migration de schéma dans ce lot.

---

## Les cinq pièges de ce lot

1. **Le glisser-déposer HTML5 ne marche pas au doigt.** `draggable` + `dragstart`/`dragover`/`drop`
   n'est jamais émis par un événement tactile sur Chrome Android. Un lot qui livre ça livre une
   fonctionnalité qui marche uniquement sur le PC du développeur — et le checkpoint dit
   explicitement « au doigt sur ton téléphone ». **Pointer Events obligatoires.**
2. **Un drag tactile se bat avec le défilement de la page.** Si toute la ligne est saisissable, le
   navigateur ne sait pas si le doigt veut faire défiler ou déplacer. La sortie est
   `touch-action: none` **sur la poignée seule**, jamais sur la ligne ni sur la liste.
3. **Une routine plus haute que l'écran ne se réordonne pas sans défilement automatique.** Six
   exercices font deux écrans. Sans auto-scroll pendant le drag, déplacer le dernier exercice en
   première position est physiquement impossible.
4. **Une duplication superficielle passe tous les tests naïfs.** Si `duplicateRoutine` copie la
   ligne `Routine` mais fait pointer les mêmes `RoutineExercise`, la copie s'affiche parfaitement
   — et modifier la copie détruit l'original. C'est **exactement** le checkpoint n°3. Copie
   profonde, testée par une modification de la copie puis relecture de l'original.
5. **Le superset est une donnée d'adjacence, pas une étiquette libre.** Un superset des exercices
   1 et 7 n'a aucun sens : on n'alterne pas entre deux exercices séparés par cinq autres. Le
   déplacement d'une ligne doit donc **renormaliser** les groupes, et cette normalisation est une
   fonction pure testée avant d'être écrite.

---

## Parti pris de conception de ce lot

La charte du Lot 1 est figée. Ce qui suit ne la rediscute pas : ce sont les décisions que ce lot
doit prendre **à l'intérieur** d'elle.

### Les modèles ne sont pas seedés — ils sont un point de départ

Le seed du catalogue tourne à chaque démarrage. Appliquer le même mécanisme aux routines prêtes à
l'emploi ferait réapparaître « Poussée » chaque fois que l'utilisateur la supprime. Le Lot 2 a écrit
la ligne de partage, elle s'applique telle quelle : **le catalogue appartient à l'app et revient
toujours ; ce que l'utilisateur compose lui appartient et ne revient jamais.**

Un modèle est donc offert comme **choix** (à la création d'une routine), et produit une routine
ordinaire, éditable et supprimable définitivement. `routineTemplates.ts` est de la donnée, pas un
seed.

### Supprimer un dossier ne supprime pas ses routines

Elles remontent à la racine (`folderId: ''`). Ranger et détruire sont deux gestes différents ; les
confondre est la façon la plus rapide de perdre vingt minutes d'écriture. Le nombre de routines
concernées est annoncé dans le texte de confirmation.

### L'écran d'une routine **est** son éditeur

Pas de vue lecture séparée. Chaque frappe est déjà écrite en base (précédent du Lot 3 : les notes
d'exercice), donc il n'y a pas d'« état modifié » à valider, donc il n'y a rien à distinguer d'un
mode lecture. Le Lot 5 ajoutera **« Démarrer »** en haut de ce même écran.

**Conséquence assumée : aucun bouton « Démarrer » dans ce lot.** Un bouton qui ne fait rien est pire
que pas de bouton.

### Le superset se lit à la lettre, pas à la couleur

Les exercices groupés portent une lettre gravée (**A**, **B**, **C**) et partagent un filet d'accent
sur leur bord gauche. La lettre n'est pas une décoration : c'est **l'ordre d'alternance**, la seule
information que le lecteur d'un superset a besoin de lire, et c'est la notation des programmes
écrits à la main (A1/A2). Les exercices non groupés n'ont **pas** de lettre — l'absence de marque
est donc elle-même l'information.

C'est aussi ce qui rend le groupe lisible sans la couleur : la charte veut un seul accent, et un
accent seul ne peut pas porter du sens (daltonisme, écran en plein soleil).

**« Dissocier » dissout le groupe entier**, jamais un seul membre. Un sens unique, toujours le même.
Retirer le membre du milieu d'un groupe de trois demanderait une sémantique différente selon la
position — et « dissocier » n'aurait pas la même conséquence sur la première ligne et sur la
deuxième.

**Déposer une ligne au milieu d'un groupe l'y fait entrer.** Le filet dessine un contenant ; déposer
dans un contenant met dedans. C'est ce que la fonction `bridgeInterior` encode.

### Une série se modifie dans une feuille, pas en ligne

Trois champs × cinq séries × six exercices en saisie directe sur 375 px, c'est un marécage de cibles
à 24 px. La ligne entière (≥ 48 px) ouvre une feuille où les `NumberInput` du Lot 1 ont la place de
faire leur travail.

**« Ajouter une série » recopie la précédente.** Définir 3 × 8-12 @ 80 kg coûte alors une saisie et
deux appuis, au lieu de trois saisies. C'est le cas écrasant.

**« Appliquer à toutes les séries »** dans la feuille : monter une routine de 80 à 85 kg est le geste
d'entretien le plus fréquent d'une routine, et le faire série par série est la meilleure façon d'en
oublier une.

### Ce que ce lot ne fait pas

- **Les dossiers ne se réordonnent pas** (tri par création). Le budget de glisser-déposer va aux
  exercices, où le checkpoint l'exige. Avec trois dossiers, un tri manuel n'est pas un besoin.
- **Les routines ne se réordonnent pas entre elles** au doigt. Elles se déplacent entre dossiers par
  leur menu. Même raison.
- **`originRoutineId` reste vide à la duplication.** Une copie n'est pas une version : le champ
  décrit une filiation que rien ne lit encore. Le versionnage est du Lot 17 (périodisation).
  Revendiquer une filiation qu'aucun écran n'exploite coûte plus cher que de ne rien revendiquer.

---

## Tâche 1 — `lib/routineOrder.ts` (TDD, obligatoire)

Logique pure, aucun React, aucun Dexie (§7). **Tests écrits avant le code.**

**Fichiers :** `src/lib/routineOrder.ts`, `src/lib/routineOrder.test.ts`

```ts
export function moveItem<T>(items: readonly T[], from: number, to: number): T[];

export interface Groupable { supersetGroup: number }

/** Rend les groupes contigus, dissout les groupes d'un seul membre, renumérote 1..n. */
export function normalizeSupersets<T extends Groupable>(rows: readonly T[]): T[];

/** Runs consécutifs partageant un même groupe non nul — ce que l'éditeur rend. */
export function toBlocks<T extends Groupable>(rows: readonly T[]): { group: number; rows: T[] }[];
```

Algorithme de `normalizeSupersets`, dans cet ordre :

1. **Pont** — une ligne à `0` dont les deux voisines partagent un même groupe non nul adopte ce
   groupe. (« Déposer dans le filet met dedans. »)
2. **Découpage** en runs maximaux de même groupe non nul.
3. **Dissolution** des runs d'une seule ligne → `0`. Un superset d'un exercice est un exercice.
4. **Renumérotation** des runs survivants en 1, 2, 3… dans l'ordre d'apparition.

**Tests (≈ 14) :**
- `moveItem` : vers le bas, vers le haut, sur place, aux deux extrémités ; l'entrée n'est pas mutée.
- Une ligne déposée entre deux membres du même groupe rejoint le groupe.
- Une ligne déposée entre deux groupes **différents** ne rejoint ni l'un ni l'autre.
- Un groupe coupé en deux par un déplacement : les deux moitiés d'une seule ligne sont dissoutes.
- Un groupe coupé dont une moitié garde deux membres : cette moitié survit, l'autre est dissoute.
- Les groupes 3 et 7 deviennent 1 et 2 (renumérotation).
- `toBlocks` : lignes seules et groupes mélangés, ordre préservé.

**Commit :** `test(lot-04): ordre et supersets, en TDD` puis `feat(lot-04): lib/routineOrder`.

---

## Tâche 2 — `data/repositories/routines.ts`

**Fichiers :** `src/data/repositories/routines.ts`, `src/data/repositories/routines.test.ts`,
`src/test/factories.ts` (ajout de `seedRoutine`).

Toutes les lectures filtrent `deletedAt === 0` via `alive`. Toutes les écritures passent par
`newEntity` / `touch`.

```ts
// Dossiers (RF-12)
listFolders(): Promise<RoutineFolder[]>                       // tri par order
createFolder(name: string): Promise<RoutineFolder>            // order = nombre de dossiers
renameFolder(id: string, name: string): Promise<void>
deleteFolder(id: string): Promise<void>                       // routines → folderId: ''
countRoutinesInFolder(id: string): Promise<number>            // pour le texte de confirmation

// Routines (RF-11, RF-13)
listRoutineSummaries(): Promise<RoutineSummary[]>             // une passe, sans N+1
getRoutineDetail(id: string): Promise<RoutineDetail | null>
createRoutine(name: string, folderId?: string): Promise<Routine>
updateRoutine(id, changes: Partial<Omit<Routine, keyof Syncable>>): Promise<void>
duplicateRoutine(id: string): Promise<Routine | undefined>    // COPIE PROFONDE
deleteRoutine(id: string): Promise<void>                      // cascade transactionnelle

// Exercices d'une routine (RF-13, RF-14)
addExercisesToRoutine(routineId: string, exerciseIds: string[]): Promise<void>
removeRoutineExercise(routineExerciseId: string): Promise<void>   // cascade ses séries
updateRoutineExercise(id, changes): Promise<void>                 // repos, notes
reorderRoutineExercises(routineId: string, from: number, to: number): Promise<void>
groupWithPrevious(routineId: string, routineExerciseId: string): Promise<void>
ungroupSuperset(routineId: string, routineExerciseId: string): Promise<void>

// Séries prévues (RF-11)
addRoutineSet(routineExerciseId: string): Promise<RoutineSet>     // recopie la précédente
updateRoutineSet(id, changes): Promise<void>
applyToAllSets(routineExerciseId: string, changes): Promise<void>
deleteRoutineSet(id: string): Promise<void>                       // renumérote les suivantes
```

**Types composés** (exportés, consommés par l'écran) :

```ts
export interface RoutineSummary {
  routine: Routine;
  exerciseCount: number;
  setCount: number;
}

export interface RoutineDetail {
  routine: Routine;
  exercises: {
    row: RoutineExercise;
    exercise: Exercise | undefined;   // undefined = exercice supprimé depuis
    sets: RoutineSet[];
  }[];
}
```

**Points d'attention :**

- `listRoutineSummaries` lit les trois tables **entièrement une fois** et recompose en mémoire.
  Une requête par routine (N+1) est le réflexe naturel et devient visible dès dix routines.
- `getRoutineDetail` renvoie `null` (pas `undefined`) quand la routine n'existe pas — le piège
  `useLiveQuery` déjà consigné : `undefined` veut dire « pas encore répondu ».
- `exercise: undefined` est un cas réel, pas défensif : le Lot 3 permet de supprimer un exercice
  personnalisé qu'une routine référence. L'éditeur doit le montrer, pas planter.
- `reorderRoutineExercises` applique `moveItem` **puis** `normalizeSupersets`, réécrit `order` et
  `supersetGroup` de toutes les lignes, dans une transaction.
- `deleteRoutineSet` renumérote les `order` suivants : un trou dans la numérotation se voit à
  l'écran (« série 1, série 3 »).

**Tests (≈ 22)** — le cœur du lot :
- Création, lecture, tri par `order`.
- Cascade : supprimer une routine soft-delete ses exercices **et** ses séries ; plus rien ne
  remonte dans les lectures.
- **Duplication profonde** : dupliquer, **modifier la copie** (renommer, changer une charge cible,
  supprimer un exercice), puis relire l'original → strictement identique. Aucun `id` partagé entre
  les deux arbres.
- Supprimer un dossier : ses routines **existent toujours**, à la racine.
- Réordonner renumérote `order` de 0 à n-1 sans trou.
- Réordonner hors d'un superset dissout le groupe orphelin.
- `addRoutineSet` recopie reps/charge/type de la dernière série ; sur une ligne vide, série neutre.
- `applyToAllSets` n'écrase que les champs fournis.
- Un exercice supprimé laisse `exercise: undefined` et la routine reste lisible.

**Commit :** `feat(lot-04): repository des routines`.

---

## Tâche 3 — Modèles prêts à l'emploi (RF-15)

**Fichiers :** `src/data/seed/routineTemplates.ts`, `src/data/seed/routineTemplates.test.ts`

De la donnée, pas un seed (cf. parti pris). Six modèles : **Poussée**, **Tirage**, **Jambes**
(le PPL), **Full-body**, **5×5 A**, **5×5 B**. Le 5×5 va par paire — livrer un seul des deux serait
livrer un demi-programme.

```ts
export interface RoutineTemplate {
  key: string;
  name: string;
  description: string;
  exercises: { slug: string; sets: number; reps?: number; repsMax?: number; superset?: number }[];
}
```

`instantiateTemplate(template)` résout les slugs via la base, crée la routine, ses lignes et ses
séries en une transaction, et renvoie la routine créée.

**Test (obligatoire) : chaque slug de chaque modèle existe dans `exercises.json`.** C'est la leçon du
Lot 2 transposée : une faute de frappe dans un slug produit une routine à laquelle il manque
silencieusement un exercice, et rien dans la pile ne le signale.

**Commit :** `feat(lot-04): six routines prêtes à l'emploi`.

---

## Tâche 4 — La bibliothèque devient réutilisable

Consigne explicite de `PROGRESS.md` : **extraire avant d'écrire une seconde version.**

**Fichiers :** `src/features/exercises/ExerciseBrowser.tsx` (nouveau),
`ExercisesScreen.tsx` (allégé), `ExerciseList.tsx` (sélection).

`ExerciseBrowser` porte la recherche, les deux filtres, le relevé, la liste et les états vides. La
**requête est contrôlée de l'extérieur** : la bibliothèque la range dans l'URL (comportement acquis
du Lot 3, ne pas régresser), le sélecteur la garde en état local — une feuille modale n'écrit pas
dans l'URL.

```ts
type Props = {
  query: BrowserQuery;                       // { search, muscle, equipment }
  onQueryChange: (query: BrowserQuery) => void;
  onPick: (exercise: Exercise) => void;
  selectedIds?: ReadonlySet<string>;         // présent = mode sélection multiple
  onCreate?: (name: string) => void;         // absent = pas de « Créer « x » » (le sélecteur)
};
```

**Sélection multiple dans le sélecteur.** Ajouter six exercices un par un, c'est six fois
« ouvrir / chercher / toucher / la feuille se ferme ». En sélection multiple c'est une ouverture et
six touches, puis **« Ajouter 6 exercices »**.

**Impasse du sélecteur.** Une recherche infructueuse n'y propose pas « Créer « x » » : créer un
exercice quitterait la routine en cours d'écriture pour un formulaire, et le retour ne saurait pas
reprendre la sélection. La sortie proposée est **« Effacer la recherche »** — une vraie sortie qui
ne quitte pas le geste en cours.

**Non-régression à vérifier :** `#/exercises?q=…&muscle=…` continue de survivre à l'aller-retour
vers une fiche.

**Commit :** `refactor(lot-04): la bibliothèque devient un composant réutilisable`.

---

## Tâche 5 — Primitives `ui/` manquantes

**Fichiers :** `src/ui/ActionSheet.tsx`, `src/ui/ReorderableList.tsx`, `src/ui/icons.tsx` (+2
tracés), `src/ui/index.ts`.

### `ActionSheet`

Une `Sheet` de lignes d'action. Sert le menu d'une routine, celui d'un exercice, le choix de type de
création. `danger` rougit une ligne. Aucune nouvelle décision visuelle : ce sont des `ListRow` dans
une `Sheet`.

### `ReorderableList` — le composant à risque

Pointer Events uniquement. Mêmes événements pour la souris et le doigt, donc une seule
implémentation à tester.

```tsx
<ReorderableList
  count={rows.length}
  onReorder={(from, to) => …}
  renderItem={(index, { handleProps, dragging }) => …}
/>
```

Mécanique :

1. `pointerdown` **sur la poignée** → `setPointerCapture`, mesure des rectangles de toutes les
   lignes (une seule fois : les mesurer à chaque `pointermove` provoquerait un reflow par frame),
   `navigator.vibrate?.(10)`.
2. `pointermove` → la ligne saisie est translatée de `dy` ; les lignes traversées sont translatées
   de ± sa hauteur ; l'index cible avance tant que le centre de la ligne saisie dépasse le centre
   de la suivante.
3. Auto-scroll : à moins de 72 px d'un bord de l'ancêtre défilant, défilement continu en
   `requestAnimationFrame`. L'ancêtre défilant est trouvé en remontant le DOM sur
   `overflow-y: auto|scroll` — pas par un `querySelector('main')`, qui serait une dépendance de
   `ui/` vers `app/`, exactement le sens interdit par le §7.
4. `pointerup` / `pointercancel` → `onReorder(from, to)`.

`touch-action: none` est porté par **`handleProps`**, donc par la poignée seule. Toucher n'importe
où ailleurs sur la ligne fait défiler la page normalement.

La ligne soulevée prend `--surface-2` (jeton déjà documenté « raised elements ») et un anneau
d'accent. **Pas d'ombre** : la charte n'en a aucune, et le jeton existant dit déjà « soulevé ».

Accessibilité : la poignée est un `<button>` porteur d'un `aria-label` explicite. Le clavier
réordonne par ↑/↓ quand la poignée a le focus — le drag n'est alors pas la seule voie.

**Commit :** `feat(lot-04): réordonnancement au doigt (Pointer Events)`.

---

## Tâche 6 — Écran Routines

**Fichier :** `src/features/routines/RoutinesScreen.tsx` (réécriture).

```
Routines                                    4  ROUTINES
┌────────────────────────────────────────────────────┐
│  PUSH / PULL / LEGS                                │  ← en-tête de dossier, collant
│  ┌──────────────────────────────────────────────┐  │
│  │ Poussée                                   ⋯  │  │
│  │ 6 exercices · 18 séries                      │  │
│  ├──────────────────────────────────────────────┤  │
│  │ Tirage                                    ⋯  │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

- Relevé d'en-tête `N routines` : exactement la forme de la bibliothèque.
- En-tête de dossier collant : **le même dispositif que les initiales du Lot 3**, appliqué à une
  vraie structure. Les routines à la racine passent en premier, sans en-tête.
- `+` → `ActionSheet` : *Routine vide* / *Partir d'un modèle* / *Nouveau dossier*.
- `⋯` d'une routine → *Dupliquer* / *Déplacer vers…* / *Supprimer*.
- État vide : variante `reading` (`0` + `routines`), avec les deux mêmes sorties que le `+`.

**Commit :** `feat(lot-04): liste des routines et dossiers`.

---

## Tâche 7 — Éditeur de routine

**Fichiers :** `RoutineEditorScreen.tsx`, `RoutineExerciseCard.tsx`, `RoutineSetSheet.tsx`,
`RoutineExerciseSheet.tsx`, `ExercisePickerSheet.tsx`, `TemplateSheet.tsx`, `router.tsx`.

Route : `/routines/:id`.

```
Poussée                                     18  SÉRIES
[ Nom de la routine                              ]
[ Dossier            Push / Pull / Legs       ⌄  ]

┌────────────────────────────────────────────────┐
│ ⠿  Développé couché (barre)                 ⋯  │
│    Pectoraux · Barre                           │
│    1        8 – 12  REPS          80 kg        │
│    2        8 – 12  REPS          80 kg        │
│    3        8 – 12  REPS          80 kg        │
│    + Ajouter une série                         │
└────────────────────────────────────────────────┘
┃┌───────────────────────────────────────────────┐
┃│ ⠿  A   Écarté à la poulie vis-à-vis        ⋯  │   ← filet d'accent + lettre
┃│    Pectoraux · Poulie                          │
┃│    1        12 – 15  REPS                      │
┃└───────────────────────────────────────────────┘
┃┌───────────────────────────────────────────────┐
┃│ ⠿  B   Pompes                              ⋯  │
┃└───────────────────────────────────────────────┘

┌──────────────────────┬─────────────────────────┐
│      Terminé         │  Ajouter un exercice    │   ← barre collante
└──────────────────────┴─────────────────────────┘
```

- Le nom s'écrit directement en base à la frappe (motif `draft` du Lot 3 : sans lui, `useLiveQuery`
  renvoie l'écriture dans le champ et le curseur saute).
- Relevé d'en-tête `N séries`, **masqué quand la routine est vide** — sinon l'écran affiche deux
  zéros d'unités différentes, le défaut relevé au Lot 3.
- Colonne de chiffres alignée à droite : la progression des charges se lit verticalement.
- `kg` n'est **jamais** en capitales (symbole SI, règle du Lot 1) ; `REPS` peut l'être.
- Une série sans aucune cible affiche « libre » — pas de tiret cadratin de remplissage.
- Barre collante : `Ajouter un exercice` (primaire, verbe de l'écran) + `Terminé` (secondaire). La
  leçon du Lot 3 est non négociable : **la sortie est sous le pouce, sans défiler.**
- `⋯` d'un exercice → feuille unique : repos, notes, *Grouper avec le précédent* /
  *Dissocier le superset*, *Retirer de la routine*.
- Une série touchée → feuille : type, fourchette de reps, charge cible, *Appliquer à toutes les
  séries*, *Supprimer la série*.

**Commit :** `feat(lot-04): éditeur de routine` puis `feat(lot-04): supersets`.

---

## Definition of Done

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build` passent tous les
      quatre.
- [ ] Tests : ≥ 35 nouveaux, dont la duplication profonde et les sept cas de `normalizeSupersets`.
- [ ] **Réordonnancement vérifié par événements `pointerType: 'touch'` synthétiques** dans un vrai
      navigateur, avec relecture de l'ordre **en base** — pas seulement du DOM.
- [ ] Le défilement de la page reste possible en touchant une ligne ailleurs que sur sa poignée
      (vérifié : `touch-action` calculé sur la ligne ≠ `none`).
- [ ] Duplication vérifiée en base : aucun `id` partagé entre l'original et la copie.
- [ ] Contrastes mesurés sur les deux écrans + les feuilles ouvertes, thèmes sombre **et** clair,
      ≥ 4,5:1 partout.
- [ ] Cibles tactiles mesurées en 375×812 : rien sous 48 px de haut, poignée comprise.
- [ ] Aucun débordement horizontal en 375 px, 32 px de dégagement sous le dernier élément.
- [ ] La recherche de la bibliothèque survit toujours à l'aller-retour vers une fiche
      (non-régression du Lot 3).

---

## ✅ Checkpoint utilisateur — **à faire au doigt, sur le téléphone**

- [ ] Tu crées ta vraie routine de séance, avec tes exercices, tes séries et tes charges cibles.
- [ ] Tu réordonnes les exercices **au doigt**, ça marche sans frustration — et la page défile
      encore normalement quand tu ne touches pas la poignée.
- [ ] Tu dupliques une routine et tu la modifies : l'originale n'a pas bougé.
- [ ] Tu groupes deux exercices en superset : le filet et les lettres A/B apparaissent.
- [ ] Tu pars d'un modèle (Poussée), tu le modifies, tu le supprimes : il ne revient pas au
      rechargement.
- [ ] Tu ranges deux routines dans un dossier, tu supprimes le dossier : **tes routines sont
      toujours là.**
