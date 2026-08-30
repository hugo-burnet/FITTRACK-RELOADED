# Projection d'export et sérialiseur Markdown

**Date :** 2026-07-28
**Statut :** proposé
**Périmètre :** jalons E1 + E2 du plan de finition.
`src/lib/export/*`, `src/lib/timezone.ts`, `src/data/repositories/exportQueries.ts`,
`src/platform/share.ts`, `src/features/history/HistoryDetailScreen.tsx`, `src/i18n/fr.ts`.

## Objectif

Sortir une séance de l'app sous une forme lisible par un humain ou par une IA,
**en trois gestes**, et prouver au passage que l'instantané du jalon 08A est
juste — avant que les graphiques ne s'appuient dessus.

C'est le premier consommateur de `exerciseName` / `exerciseMeasurementType` /
`exercisePrimaryMuscle` / `exerciseEquipment` et de
`startedTimezoneOffsetMinutes`. Si un export d'aujourd'hui et un export de
demain diffèrent après un renommage, ce jalon le montre immédiatement.

## Ce que ce jalon livre

1. `ExportScope`, les DTO `CoachExport`, et une projection **pure** qui les
   construit ;
2. des requêtes Dexie **bornées** qui alimentent cette projection ;
3. un sérialiseur Markdown ;
4. **Partager** et **Copier** dans le menu `⋯` du détail d'une séance.

## Ce que ce jalon ne livre pas

- **pas d'écran `/settings/export`.** Il n'a de sens qu'avec un choix de
  périmètre, de période et de format — c'est-à-dire avec le CSV (E3) et le JSON
  (E4). Le construire maintenant, pour un seul format et un seul périmètre,
  reviendrait à dessiner un formulaire à une case ;
- **pas de téléchargement de fichier.** Cf. « Partager du texte, pas un
  fichier » ci-dessous ;
- pas de CSV, pas de JSON, pas d'export brut ;
- pas de couche de validation numérique ni d'audit de cohérence : ils
  appartiennent au document de refactorisation.

---

## Quatre écarts avec le document source

Le document source s'est déjà trompé une fois (`snapshotQuality`, corrigé au
jalon 08A). Voici les quatre points où je ne l'applique pas.

### 1. `src/lib/export/`, pas `src/domain/export/`

Le document propose un arbre `src/domain/` parallèle à `src/lib/`. Mais §7 de
l'architecture définit déjà `lib/` comme **la** couche pure, sans React et sans
Dexie, et pose la règle de dépendance `lib/ ← data/ ← features/`. Créer
`src/domain/` produirait deux couches pures au contrat identique et **aucune
règle pour dire ce qui va dans laquelle** — la question se reposerait à chaque
fichier, et se trancherait différemment à chaque fois.

`src/lib/export/` et `src/lib/analytics/` respectent la règle existante et
n'ajoutent aucun concept. Le document source décrit une arborescence qui ne cite
jamais §7 : il ne l'a pas lue.

**Une exception, nommée :** `src/lib/export/serializeMarkdown.ts` importe
`i18n/fr.ts` et `i18n/labels.ts`. C'est le seul module de `lib/` qui le fait, et
c'est délibéré — son produit est **un document destiné à un humain**, pas une
valeur destinée à un écran. `lib/measurement.ts` rend des clés d'unité (`'kg'`)
parce qu'un composant les habillera ; un sérialiseur n'a pas de composant après
lui. Lui injecter un dictionnaire de libellés créerait un second dictionnaire
français, parallèle à `fr.ts`, exactement ce que la règle « jamais de chaîne en
dur » cherche à éviter. Aucun cycle : `i18n/` importe `lib/measurement` et
`lib/records`, jamais `lib/export`.

### 2. Pas de `definitions: MetricDefinition[]`

Le document met un tableau de définitions de métriques dans l'enveloppe
`CoachExport`. Un export de séances **n'a pas de métrique** : il contient des
séries, pas des agrégats. Le tableau serait vide dans tous les exports produits
par E1→E4.

Ce qui est réellement dû au lecteur, c'est **la définition de ce qui est compté**
quand un chiffre agrégé apparaît. Il en apparaît exactement un dans ce jalon —
le tonnage de la séance — et il est écrit en toutes lettres dans l'en-tête du
Markdown : charge externe seulement, échauffements exclus. Une phrase, là où on
la lit, plutôt qu'une structure vide.

Le jour où G0 définit de vraies métriques, il ajoutera le champ avec ses
consommateurs. Un champ qu'aucun lecteur ne remplit est une ligne à maintenir
dans une enveloppe versionnée, pour rien — le même raisonnement qui a supprimé
`secondaryMuscles` de l'instantané.

### 3. Partager du **texte**, pas un fichier

Le document construit `src/platform/files/{createDownload,shareFile}.ts` et
range la copie en « repli éventuel ».

L'usage nommé au §2.1 du document lui-même est : *coller ses séances dans une
conversation avec une IA ou un coach*. Pour ça :

- `navigator.share({ text })` ouvre la feuille de partage Android et le texte
  arrive **dans le corps** du message WhatsApp, du mail, de la note. C'est
  terminé en un geste ;
- `navigator.share({ files })` avec un `.md` produit une pièce jointe que le
  destinataire doit ouvrir, et le support du partage de fichiers est nettement
  plus inégal que celui du partage de texte ;
- un téléchargement dans une PWA Android donne un fichier dans `Downloads` que
  l'utilisateur doit ensuite retrouver.

Donc : **partage de texte, et copie en action de premier rang**, pas en repli.
Le presse-papiers est le geste exact de « coller dans ChatGPT ».

Le fichier arrive avec le CSV (E3), où un fichier **est** le produit : on
n'ouvre pas un tableur en collant du texte. `src/platform/` naîtra alors avec
son vrai besoin. Ce jalon crée `src/platform/share.ts` seul.

> **Ajout assumé à l'arborescence §7 :** `src/platform/` n'y figure pas. Un
> adaptateur d'API navigateur n'est ni pur (`lib/`), ni une porte vers la base
> (`data/`), ni un composant (`ui/`), ni une fonctionnalité (`features/`). Il
> lui faut son étage. Il est nommé ici plutôt que glissé sans le dire.

### 4. La date de référence et le fuseau, appliqués tout de suite

Le document range ça en E0. E0 est réduit à ce qui a été livré, donc la règle
s'applique ici, à son premier consommateur :

- `workout.startedAt` place la séance, jamais `set.performedAt` — l'import Hevy
  interpole les heures des séries, et une séance sans série validée a quand même
  une date ;
- le jour civil se calcule avec `workout.startedTimezoneOffsetMinutes`, jamais
  avec le fuseau du téléphone au moment de la consultation.

---

## Architecture

```
src/lib/export/
├── types.ts               # ExportScope, CoachExport, ExportOptions
├── projectCoachExport.ts  # pure : lignes → CoachExport
└── serializeMarkdown.ts   # pure : CoachExport → texte

src/data/repositories/
└── exportQueries.ts       # lecture bornée : ExportScope → ExportSource[]

src/platform/
└── share.ts               # navigator.share / clipboard, et leurs replis
```

La chaîne est : `exportQueries` lit → `projectCoachExport` projette →
`serializeMarkdown` écrit → `share` sort. Chaque flèche est testable seule, et
seule la première touche Dexie.

### Les DTO

```ts
type ExportScope =
  | { kind: 'workout'; workoutId: string }
  | { kind: 'exercise'; exerciseId: string; from?: number; to?: number }
  | { kind: 'period'; from: number; to: number }
  | { kind: 'all-history' };

interface ExportOptions {
  includeWarmups: boolean; // défaut true
  includeNotes: boolean;   // défaut true
  includeIds: boolean;     // défaut false
}

interface CoachExport {
  format: 'fittrack-coach-export';
  schemaVersion: 1;
  exportedAt: string;      // ISO UTC
  scope: ExportScope;
  workoutCount: number;
  workingSetCount: number;
  workouts: ExportWorkout[];
}

interface ExportWorkout {
  id?: string;
  name: string;
  notes?: string;
  startedAt: string;              // ISO avec l'offset de la séance
  localDate: string;              // 'AAAA-MM-JJ' dans l'offset de la séance
  timezoneOffsetMinutes: number;
  durationSeconds: number;
  exercises: ExportExercise[];
}

interface ExportExercise {
  id?: string;
  name?: string;                  // absent : ni instantané, ni bibliothèque
  measurementType?: MeasurementType;
  primaryMuscle?: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
  sets: ExportSet[];
}

interface ExportSet {
  number: number;                 // 1-based, rang parmi les séries exportées
  type: SetType;
  side: Side;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}
```

**Ajouté pendant l'implémentation :** `ExportWorkout.totals: SessionTotals`. Le
Markdown affiche la durée et le tonnage d'une séance, et les recalculer dans
chaque sérialiseur (Markdown, puis CSV, puis JSON) est la façon la plus sûre
d'obtenir trois tonnages différents. La projection appelle donc `sessionTotals`
— **la fonction même que l'écran d'historique affiche** — et transporte le
résultat. Ce n'est pas la synthèse trompeuse que le §4.2 du document source
écarte : c'est le chiffre déjà à l'écran, transporté au lieu d'être réinventé.
Vérifié en pilotant : l'écran et le document annoncent tous deux 922,5 kg et
6 séries de travail sur la même séance.

Retirés du modèle du document : `locale` (constante `'fr-FR'`, donc du bruit) et
l'objet `timezone.currentOffsetMinutes` (l'offset qui compte est celui de chaque
séance, déjà porté par `ExportWorkout` ; celui du téléphone au moment de
l'export n'explique rien).

`schemaVersion: 1` est là dès maintenant, alors que rien ne relit encore : c'est
la seule chose qu'on ne peut pas ajouter après coup à des fichiers déjà envoyés.

### La règle d'identité d'un exercice

Trois niveaux, dans cet ordre, appliqués dans la **projection pure** et donc
testables sans base :

1. l'instantané de la ligne (`exerciseName`, …) — la vérité de l'époque ;
2. à défaut, la bibliothèque d'aujourd'hui, **soft-deleted comprise** — un
   exercice supprimé reste l'exercice qui a été fait, et `loadExerciseSnapshots`
   lit déjà volontairement à travers `bulkGet` plutôt qu'`alive()` ;
3. à défaut, `undefined` — et c'est le sérialiseur, pas la projection, qui
   choisit le mot français à mettre à la place.

Rien n'est inventé, et la projection ne contient aucune chaîne française.

### Les requêtes bornées

```ts
interface ExportSource {
  workout: Workout;
  exercises: Array<{
    row: WorkoutExercise;
    exercise: Exercise | undefined; // bibliothèque d'aujourd'hui, soft-deleted comprise
    sets: WorkoutSet[];             // vivantes, triées par order
  }>;
}

listExportSources(scope: ExportScope): Promise<ExportSource[]>
```

Différences avec `getWorkoutDetail`, et pourquoi une fonction de plus :

- `getWorkoutDetail` fait **une requête `getLastPerformance` par exercice
  distinct** pour la colonne « précédent ». Un export de 52 semaines paierait
  ça sur chaque séance, pour une donnée qu'aucun export ne contient ;
- `getWorkoutDetail` écarte les exercices soft-deleted (`alive`-équivalent sur
  la bibliothèque). L'export les veut, cf. la règle d'identité ci-dessus ;
- l'export lit **plusieurs séances**, en un lot.

Règles de la requête :

- seules les séances `status: 'completed'` et `deletedAt === 0` ;
- lignes d'exercice et séries vivantes seulement ;
- séries `isCompleted === 1` seulement — les séries non validées ne sont pas des
  performances. (L'option « inclure les non validées » du document est reportée :
  aucun écran ne peut encore la demander) ;
- bornes : **`from` inclusif, `to` exclusif**, comme `listHistoryDay` le fait
  déjà. Un choix de cohérence, pas de goût ;
- ordre : séances par `startedAt` croissant (une progression se lit dans le sens
  du temps, contrairement au Journal qui montre le récent d'abord), exercices par
  `order`, séries par `order`.

Le périmètre `exercise` ne garde que les lignes de l'exercice demandé, et écarte
les séances qui n'en contiennent aucune. `durationSeconds` reste alors **la durée
de la séance entière** — l'en-tête du document annonce le périmètre, donc le
chiffre ne ment pas ; on ne sait pas répartir une durée entre exercices, et
inventer une répartition serait pire que de nommer ce qu'on montre.

---

## Le Markdown

### Forme

```md
# Export FitTrack

- Séance : Upper A — 27 juillet 2026 à 18:20
- Séries de travail : 14
- Tonnage : charge externe uniquement, échauffements exclus.

## Upper A — 27 juillet 2026 à 18:20

Durée : 1 h 12
Tonnage : 4 320 kg

Bonne séance, légère gêne à l'épaule droite.

### Développé couché — Pectoraux · Barre

| Série | Type | Charge | Reps | RPE |
|---:|---|---:|---:|---:|
| 1 | Échauffement | 40 kg | 12 | — |
| 2 | Normale | 80 kg | 10 | 8 |
| 3 | Normale | 80 kg | 9 | 8,5 |
```

### Règles

- **Les colonnes viennent de `measurementType`**, via `entryColumns` — le module
  qui décide déjà des colonnes de la grille en direct. Un gainage n'a pas de
  colonne « Charge », un rameur a « Distance » et « Durée ». Une seule source de
  vérité sur ce qu'un exercice se mesure en.
- **Aucune colonne inutile.** « Type » n'apparaît que si au moins une série du
  tableau n'est pas `normal` ; « RPE » que si au moins une série en porte un.
  Vingt lignes qui répètent « Normale » sont du bruit, et le document source
  demande lui-même des « tableaux sans colonne inutile » (§13.2).
- **`—` pour une valeur absente**, jamais une case vide : une case vide se lit
  comme un défaut de génération.
- **Décimales françaises** (`102,5`), via le même `toLocaleString('fr-FR')` que
  `lib/measurement`.
- **Assistance : le préfixe `−`**, et **jamais de tonnage** pour un exercice dont
  le `weightRole` n'est pas `load` — `sessionTotals` applique déjà cette règle,
  elle est réutilisée telle quelle, pas réécrite.
- **Échappement :** `|` devient `\|` et les retours à la ligne deviennent des
  espaces **à l'intérieur d'une cellule de tableau**. Les notes, elles, vivent
  **hors des tableaux**, en paragraphe, et gardent leurs retours à la ligne
  intacts — c'est pour ça qu'elles n'y sont pas.
- **Aucune synthèse fausse.** Toutes les séries sont écrites, une par ligne.
  Jamais « 3 séries × 80 kg ».
- **Pas d'identifiants** par défaut (`includeIds: false`).
- **Le nom manquant** est `t('export.unknownExercise')`, et le sous-titre
  muscle · matériel est omis plutôt qu'inventé.

### Les totaux du document sont ceux de l'écran

Durée et tonnage passent par `formatDuration` / `sessionTotals`, les mêmes que
`HistoryWorkoutDetail`. Un export qui annoncerait un autre tonnage que l'écran
qui l'a produit serait le vrai bug — pas une différence de présentation.

---

## Partager, depuis le détail d'une séance

Le menu `⋯` de `HistoryDetailScreen` gagne deux entrées **avant** Modifier et
Supprimer :

| Entrée | Effet |
|---|---|
| **Partager** | `navigator.share({ title, text })`. Indisponible → copie, et l'écran le dit. |
| **Copier le texte** | Presse-papiers, toujours. C'est le geste de « coller dans une IA ». |

Trois gestes : `⋯` → **Partager** → la cible dans la feuille système.

`src/platform/share.ts` expose une seule fonction rendant un résultat explicite :

```ts
type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';
shareText(payload: { title: string; text: string }): Promise<ShareOutcome>
```

- `navigator.share` absent → tentative de copie → `'copied'` ou `'failed'` ;
- `AbortError` → `'cancelled'`, et **l'écran n'affiche rien**. Annuler un partage
  est une décision, pas une panne : un message d'erreur après une annulation
  apprend à l'utilisateur à ignorer les messages ;
- toute autre erreur → repli sur la copie, puis `'failed'`.

**Rien de neuf à l'écran.** Le retour réutilise le créneau d'alerte que
`HistoryDetailScreen` a déjà pour l'échec de suppression : une `Card` en haut,
`role="alert"`. `'copied'` y écrit une confirmation neutre, `'failed'` un
message d'échec ; `'shared'` et `'cancelled'` n'écrivent rien.

La feuille de partage système n'ouvre que sur un geste utilisateur direct : la
génération du Markdown se fait **avant** l'appel, de façon synchrone à partir
des données déjà chargées par `useLiveQuery`. Un `await` sur Dexie entre le tap
et `navigator.share` ferait perdre la transient activation et Android refuserait
d'ouvrir la feuille.

## Ce que ce jalon prouve du jalon 08A

> **Constaté en pilotant, et laissé tel quel :** après un renommage, le document
> exporté garde l'ancien nom pendant que **l'écran de détail de la même séance
> affiche le nouveau**. Les deux ne peuvent pas avoir raison, et c'est l'export
> qui a raison. C'est l'état que `PROGRESS.md` annonçait — « aucun consommateur
> n'est encore rebranché sur l'instantané » — devenu visible. Rebrancher
> `HistoryWorkoutDetail` sur `row.exerciseName` **et** sur
> `row.exerciseMeasurementType` change la façon dont les chiffres d'une séance
> sont lus, pas seulement son titre : ça mérite son propre jalon et ses propres
> tests, pas une ligne glissée dans celui-ci.

Le test de non-régression est le point de tout l'enchaînement : projeter une
séance, renommer son exercice dans la bibliothèque, reprojeter — **le nom ne
bouge pas**. Sans l'instantané, il bougerait. C'est la première fois que ça se
vérifie de bout en bout, et la dernière occasion de le vérifier avant que les
graphiques n'en dépendent.

## Vérification

- projection : séance vide, instantané présent / bibliothèque seule / ni l'un ni
  l'autre, les six types de mesure, les quatre types de séries, échauffements
  inclus puis exclus, séries non validées écartées, RPE absent/présent, notes
  multilignes, côtés, ordre stable, ids absents par défaut, bornes de période,
  données Hevy, offset de fuseau appliqué, non-régression du renommage ;
- Markdown : échappement des `|`, retours à la ligne, accents, décimales
  françaises, colonnes omises, préfixe d'assistance, absence de tonnage sur
  l'assistance, `—`, aucune synthèse ;
- requêtes : bornes, séances supprimées écartées, séries non validées écartées,
  exercice soft-deleted conservé, tri ;
- partage : disponible, indisponible, annulé sans message, échec de copie ;
- `lint`, `typecheck`, `test:run`, `build`.
