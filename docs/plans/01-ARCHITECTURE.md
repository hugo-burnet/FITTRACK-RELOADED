# FitTrack — Architecture & modèle de données

> À lire par tout agent qui travaille sur un lot. Contient les décisions verrouillées et le
> contrat de données que tous les lots partagent.

---

## 1. Contraintes de départ

| Contrainte | Conséquence |
|---|---|
| Hébergement GitHub Pages | **Statique pur.** Aucun serveur, aucune base distante, aucune session. |
| Usage en salle de sport | Réseau dégradé ou absent. L'app doit être **utilisable à 100 % hors-ligne**. |
| Un seul utilisateur (toi) | Pas d'auth au V1. Pas de multi-tenant. Pas de `user_id` partout. |
| Doit devenir une app Android | Le code web doit rester empaquetable : pas d'API web exotique non supportée par WebView. |
| Développement par sessions IA | Modules à frontières nettes, testables isolément, sans état global implicite. |

**Conséquence majeure :** le cahier des charges décrit un produit client/serveur (M1 compte,
M14 sauvegarde cloud). On inverse l'ordre : **les données vivent d'abord sur l'appareil**, la
synchronisation cloud devient une couche optionnelle greffée plus tard (Lot 14) sur un schéma
déjà conçu pour ça. Le M1 « Compte & authentification » n'existe pas au V1 — et n'a aucune
utilité tant qu'il n'y a qu'un appareil.

---

## 2. Décisions d'architecture (ADR)

### ADR-001 — Local-first sur IndexedDB via Dexie

**Décision :** toutes les données dans IndexedDB, accédées via Dexie.js.

**Pourquoi :** `localStorage` est synchrone, limité à ~5 Mo et ne stocke que des chaînes —
inutilisable pour des années d'historique et des photos. IndexedDB est asynchrone, sans limite
pratique (quota disque), et supporte les index composés dont on a besoin pour la requête
critique « dernière performance sur cet exercice ». Dexie ajoute une API lisible, les migrations
versionnées, et `useLiveQuery` qui rend les composants réactifs aux écritures sans store manuel.

**Conséquence :** aucune requête réseau n'est nécessaire pour utiliser l'app. Le service worker
ne sert qu'à mettre en cache l'app elle-même, pas les données.

### ADR-002 — Schéma prêt pour la synchronisation dès le jour 1

**Décision :** chaque entité porte `id: string` (UUID), `createdAt`, `updatedAt`, `deletedAt`.
Suppression **logique** (soft delete), jamais physique.

**Pourquoi :** ajouter la sync plus tard sur un schéma à IDs auto-incrémentés impose une
migration douloureuse et des collisions d'ID entre appareils. Les UUID et le soft delete coûtent
quasiment rien maintenant et rendent le Lot 14 mécanique. Le soft delete permet aussi une
corbeille et protège d'une suppression accidentelle en pleine séance.

**Conséquence :** toute lecture filtre `deletedAt === 0`. C'est encapsulé dans les repositories,
un composant ne doit jamais y penser.

### ADR-003 — Routage en mode hash (`createHashRouter`)

**Décision :** les URL sont de la forme `https://user.github.io/fittrack/#/workout/123`.

**Pourquoi :** GitHub Pages sert des fichiers statiques ; sur une URL profonde en history mode
(`/fittrack/workout/123`), il renvoie un 404 parce qu'aucun fichier ne correspond. Les
contournements (copier `index.html` en `404.html`) fonctionnent mais cassent le code HTTP et
perturbent le service worker. Le mode hash marche identiquement sur GitHub Pages, en local, et
dans la WebView Capacitor où le protocole n'est pas `https`.

**Conséquence :** URL moins jolies. Sans importance pour une app personnelle installée.

### ADR-004 — Séparation stricte données / état éphémère

**Décision :**
- **Dexie** = tout ce qui est persistant (exercices, routines, séances, séries…).
- **Zustand** = uniquement ce qui est éphémère et non reconstructible : état du minuteur de repos,
  index de l'exercice affiché, modale ouverte.

**Pourquoi :** dupliquer les données persistantes dans un store React crée deux sources de vérité
et c'est exactement là que naissent les pertes de séance. `useLiveQuery` lit la base et
re-rend automatiquement à chaque écriture : la base **est** le store.

**Conséquence :** la séance en cours est écrite en base à chaque série validée. Fermer l'app en
pleine séance ne perd rien (RF-25). Le store Zustand peut être vidé à tout moment sans dégât.

### ADR-005 — IDs UUID générés côté client

**Décision :** `crypto.randomUUID()`, disponible nativement dans tous les navigateurs modernes et
dans la WebView Android.

**Pourquoi :** pas de dépendance, pas de coordination avec un serveur, prêt pour le multi-appareil.

### ADR-006 — Capacitor plutôt que TWA/PWABuilder pour Android

**Décision :** empaqueter avec Capacitor à partir du Lot 10.

**Pourquoi :** une TWA (Trusted Web Activity, ce que génère PWABuilder ou Bubblewrap) n'est qu'un
Chrome sans barre d'adresse. Elle exige un fichier `.well-known/assetlinks.json` **à la racine du
domaine** — impossible proprement sur `user.github.io/fittrack`, et sans lui l'app affiche une
barre d'URL. Surtout, une TWA n'ouvre **aucun accès natif** : pas de notification de minuteur
fiable écran éteint, pas de Health Connect, pas de verrouillage biométrique, pas de widget.
Capacitor embarque les fichiers web dans l'APK (donc fonctionne même si GitHub Pages tombe) et
expose les API natives via des plugins.

**Conséquence :** une seule base de code produit les deux cibles. `npm run build` alimente à la
fois le déploiement Pages et la synchronisation Capacitor. Aucune réécriture.

### ADR-007 — Interface en français, code en anglais, i18n préparée mais pas installée

**Décision :** tous les textes UI dans `src/i18n/fr.ts`, importés via une fonction `t()` maison.
Pas de bibliothèque i18n au V1.

**Pourquoi :** `i18next` est du poids et de la complexité pour une app mono-utilisateur
francophone. Mais centraliser les chaînes coûte zéro et rend l'ajout de l'anglais (RF-52)
mécanique le jour où c'est voulu. Le vrai coût de l'i18n, c'est de traquer les chaînes en dur
après coup.

---

## 3. Règles de typage imposées par IndexedDB

**IndexedDB ne sait pas indexer un booléen, ni `null`, ni `undefined`.** Une entité dont un champ
indexé vaut `null` **disparaît silencieusement de l'index** — elle existe en base mais aucune
requête ne la trouve. C'est le piège n°1 de Dexie, il coûte des heures de débogage.

Règles à appliquer partout :

| Besoin | ❌ Interdit | ✅ Obligatoire |
|---|---|---|
| Booléen indexé | `isCustom: boolean` | `isCustom: 0 \| 1` |
| Suppression logique | `deletedAt: number \| null` | `deletedAt: number` (`0` = vivant) |
| Référence optionnelle indexée | `folderId: string \| null` | `folderId: string` (`''` = aucun) |
| Valeur optionnelle **non** indexée | — | `notes?: string` est autorisé |

---

## 4. Modèle de données

Traduction de la §5 du cahier des charges, adaptée au mono-utilisateur (pas de `userId`) et
enrichie des recommandations de l'audit (unilatéral, versionnage, périodisation).

### 4.1 Types de base

```ts
// src/data/types.ts

/** Champs portés par toutes les entités persistées. */
export interface Syncable {
  id: string;          // crypto.randomUUID()
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms — touché à chaque écriture
  deletedAt: number;   // 0 = vivant, sinon epoch ms de suppression
}

export type MuscleGroup =
  | 'chest' | 'lats' | 'upper_back' | 'traps' | 'shoulders'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'abs' | 'lower_back' | 'neck' | 'full_body' | 'cardio' | 'other';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'smith'
  | 'bodyweight' | 'band' | 'kettlebell' | 'plate' | 'other';

/** Détermine quels champs de saisie affiche l'écran de séance. */
export type MeasurementType =
  | 'weight_reps'          // développé couché : poids + répétitions
  | 'reps_only'            // tractions au poids du corps
  | 'weight_time'          // gainage lesté
  | 'time_only'            // planche
  | 'distance_time'        // rameur, tapis
  | 'assisted_weight_reps';// tractions assistées (le poids soulage)

export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';

export type Side = 'both' | 'left' | 'right';
```

### 4.2 Entités

```ts
export interface Exercise extends Syncable {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];   // non indexé
  equipment: Equipment;
  measurementType: MeasurementType;
  isCustom: 0 | 1;                   // 1 = créé par l'utilisateur (RF-08)
  isUnilateral: 0 | 1;               // recommandation audit M2
  imageUrl?: string;
  instructions?: string;
  userNotes?: string;                // RF-09 : réglages de machine, hauteur de banc…
  defaultRestSeconds?: number;       // RF-27 : repos spécifique par exercice
}

export interface RoutineFolder extends Syncable {
  name: string;
  order: number;                     // RF-12
}

export interface Routine extends Syncable {
  name: string;
  folderId: string;                  // '' si à la racine
  order: number;
  notes?: string;
  version: number;                   // recommandation audit M3 : versionnage
  originRoutineId?: string;          // pointe vers la v1 si duplication versionnée
}

export interface RoutineExercise extends Syncable {
  routineId: string;
  exerciseId: string;
  order: number;
  supersetGroup: number;             // 0 = pas de superset, sinon n° de groupe (RF-14)
  restSeconds: number;               // 0 = utiliser le défaut de l'exercice
  notes?: string;
}

/** Une ligne = une série prévue. Permet 5x5 à charges différentes et échauffements planifiés. */
export interface RoutineSet extends Syncable {
  routineExerciseId: string;
  order: number;
  setType: SetType;
  targetReps?: number;
  targetRepsMax?: number;            // fourchette 8-12 → targetReps=8, targetRepsMax=12
  targetWeight?: number;
  targetRpe?: number;
}

export type WorkoutStatus = 'active' | 'completed' | 'discarded';

export interface Workout extends Syncable {
  routineId: string;                 // '' si séance vide (RF-17)
  name: string;
  status: WorkoutStatus;             // 'active' = séance en cours reprise au démarrage (RF-25)
  startedAt: number;
  endedAt: number;                   // 0 tant que non terminée
  durationSeconds: number;           // temps réel hors pauses, calculé à la clôture
  notes?: string;
}

export interface WorkoutExercise extends Syncable {
  workoutId: string;
  exerciseId: string;
  order: number;
  supersetGroup: number;
  notes?: string;
}

export interface WorkoutSet extends Syncable {
  workoutExerciseId: string;
  exerciseId: string;                // DÉNORMALISÉ volontairement — cf. §5
  workoutId: string;                 // DÉNORMALISÉ volontairement
  order: number;
  setType: SetType;
  side: Side;
  weight?: number;                   // toujours stocké en KG (cf. §6)
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;                      // RF-30 : 6 à 10 par pas de 0,5
  isCompleted: 0 | 1;
  performedAt: number;               // 0 tant que non validée
}

export type PersonalRecordType = 'max_weight' | 'max_reps' | 'best_1rm' | 'max_volume_set' | 'max_volume_session';

export interface PersonalRecord extends Syncable {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  reps?: number;                     // contexte : 100 kg × 5 reps
  weight?: number;
  workoutSetId: string;
  achievedAt: number;
}

export interface BodyMeasurement extends Syncable {
  type: string;                      // 'body_weight' | 'body_fat' | 'waist' | … | champ perso
  value: number;
  unit: string;
  measuredAt: number;                // saisie rétroactive autorisée (recommandation audit M7)
  notes?: string;
}

export interface ProgressPhoto extends Syncable {
  blobKey: string;                   // clé vers le Blob stocké dans la table `photoBlobs`
  thumbnailDataUrl: string;          // vignette base64 pour l'affichage en grille
  takenAt: number;
  pose?: string;                     // 'front' | 'side' | 'back'
  notes?: string;
}

/** Réglages M10. Table clé/valeur : ajouter un réglage ne nécessite aucune migration. */
export interface Setting {
  key: string;
  value: unknown;
  updatedAt: number;
}
```

### 4.3 Schéma Dexie

```ts
// src/data/db.ts
db.version(1).stores({
  exercises:        'id, name, primaryMuscle, equipment, isCustom, updatedAt, deletedAt',
  routineFolders:   'id, order, updatedAt, deletedAt',
  routines:         'id, folderId, order, updatedAt, deletedAt',
  routineExercises: 'id, routineId, [routineId+order], deletedAt',
  routineSets:      'id, routineExerciseId, [routineExerciseId+order], deletedAt',
  workouts:         'id, status, startedAt, routineId, updatedAt, deletedAt',
  workoutExercises: 'id, workoutId, [workoutId+order], exerciseId, deletedAt',
  workoutSets:      'id, workoutExerciseId, [workoutExerciseId+order], workoutId, [exerciseId+performedAt], deletedAt',
  personalRecords:  'id, exerciseId, [exerciseId+type], achievedAt, deletedAt',
  bodyMeasurements: 'id, type, [type+measuredAt], deletedAt',
  progressPhotos:   'id, takenAt, deletedAt',
  photoBlobs:       'key',
  settings:         'key',
});
```

Le premier champ est la clé primaire. Les crochets déclarent un **index composé**.
`photoBlobs` est une table séparée pour que la lecture d'une liste de photos ne charge pas
plusieurs mégaoctets de binaire en mémoire.

---

## 5. Les deux requêtes qui dictent le schéma

### 5.1 « Valeur précédente » (RF-19)

C'est **la** requête critique : elle s'exécute pour chaque exercice à l'ouverture de l'écran de
séance, et l'utilisateur attend un affichage instantané. D'où l'index composé
`[exerciseId+performedAt]` et la dénormalisation de `exerciseId` sur `WorkoutSet` — sans elle il
faudrait remonter `workoutSets → workoutExercises → workouts`, soit trois requêtes en cascade.

```ts
export async function getLastPerformance(exerciseId: string): Promise<WorkoutSet[]> {
  const lastSet = await db.workoutSets
    .where('[exerciseId+performedAt]')
    .between([exerciseId, 1], [exerciseId, Dexie.maxKey])
    .last();
  if (!lastSet) return [];
  return db.workoutSets
    .where({ workoutExerciseId: lastSet.workoutExerciseId })
    .filter((s) => s.deletedAt === 0 && s.isCompleted === 1)
    .sortBy('order');
}
```

`between([exerciseId, 1], …)` démarre à 1 et non 0 : les séries non validées ont
`performedAt = 0` et doivent être exclues.

### 5.2 Détection de record (RF-23)

Doit s'exécuter à la validation de chaque série, sans latence perceptible. La table
`personalRecords` est maintenue **de façon incrémentale** (on compare la série à l'enregistrement
courant), jamais recalculée par balayage complet de l'historique. Un recalcul intégral n'existe
que comme outil de réparation, déclenché manuellement depuis les réglages.

---

## 6. Unités : stocker en kg, afficher selon le réglage

**Règle absolue :** la base ne contient **que des kilogrammes** et des mètres. La conversion en
livres n'a lieu qu'à l'affichage et à la saisie, dans un unique module
`src/lib/units.ts`.

**Pourquoi :** stocker l'unité à côté de chaque valeur oblige à convertir dans chaque calcul de
volume, chaque graphique, chaque comparaison de record. Un seul oubli fausse un total. Le
basculement kg/lb devient alors un simple changement d'affichage, et l'historique reste cohérent.

---

## 7. Arborescence des fichiers

```
src/
├── main.tsx                    # point d'entrée, monte le routeur
├── router.tsx                  # createHashRouter, définition des routes
├── app/
│   ├── AppShell.tsx            # layout + barre de navigation basse
│   └── ErrorBoundary.tsx
├── data/
│   ├── db.ts                   # instance Dexie + versions/migrations
│   ├── types.ts                # toutes les interfaces du §4
│   ├── seed/
│   │   ├── exercises.json      # catalogue d'exercices (RF-06)
│   │   └── seedDatabase.ts     # insertion idempotente au premier lancement
│   └── repositories/           # SEULE porte d'entrée vers la base
│       ├── base.ts             # helpers communs : create/update/softDelete
│       ├── exercises.ts
│       ├── routines.ts
│       ├── workouts.ts
│       ├── records.ts
│       ├── measurements.ts
│       └── settings.ts
├── features/                   # un dossier par module fonctionnel
│   ├── exercises/              # M2
│   ├── routines/               # M3
│   ├── workout/                # M4 — le cœur de l'app
│   ├── history/                # M6
│   ├── measurements/           # M7
│   ├── stats/                  # M8
│   └── settings/               # M10
├── lib/                        # logique métier PURE, sans React, sans Dexie → 100 % testée
│   ├── units.ts                # conversions kg/lb
│   ├── oneRepMax.ts            # Epley, Brzycki, Lombardi (RF-46)
│   ├── plates.ts               # calculateur de plaques (RF-28)
│   ├── warmup.ts               # séries d'approche (RF-29)
│   ├── volume.ts               # calculs de volume et de tonnage
│   └── records.ts              # règles de détection de PR
├── ui/                         # composants génériques réutilisables
│   ├── Button.tsx  Input.tsx  Sheet.tsx  Dialog.tsx  Tabs.tsx  EmptyState.tsx
├── stores/
│   ├── activeWorkout.ts        # Zustand — état éphémère de la séance
│   └── restTimer.ts            # Zustand — minuteur
└── i18n/
    └── fr.ts
```

**Règle de dépendance à respecter :** `lib/` ne dépend de rien. `data/` dépend de `lib/`.
`features/` dépend de `data/`, `lib/` et `ui/`. Jamais l'inverse. Un import de `features/` dans
`lib/` est un bug de conception.

---

## 8. Ce que la stack ne fera pas (et pourquoi)

| Renoncement | Raison |
|---|---|
| Pas de Next.js / SSR | Aucun intérêt pour une app installée hors-ligne, et incompatible avec un hébergement statique + Capacitor. |
| Pas de backend au V1 | Rien ne l'exige tant qu'il y a un seul appareil. Ajouté au Lot 14 si le besoin apparaît vraiment. |
| Pas de Redux | Le store, c'est la base de données (ADR-004). |
| Pas de composants UI tiers (MUI, shadcn complet) | L'écran de séance est trop spécifique ; les composants génériques seraient combattus plus qu'utilisés. On écrit ~10 primitives sur mesure au Lot 1. |
| Pas de Wear OS (M13) | Coût très élevé (projet Android natif séparé, pairing, sync BLE) pour un gain marginal. Explicitement hors périmètre. |
