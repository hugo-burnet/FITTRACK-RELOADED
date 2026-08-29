# Intention de bloc et Coach

**Date :** 2026-08-13
**Statut :** conception validée
**Remplace, dans le Lot 17 :** la prescription hebdomadaire `% 1RM` / RPE de semaine, le drapeau `isDeload` comme vérité parallèle, et la règle « dans une séance programmée le Coach n’observe que ».
**Ne remplace pas :** calendrier civil, un seul bloc actif, split versionné, routines scellées, décalage explicite, local-first.

## 1. Objectif

Un bloc raconte une histoire d’entraînement (construction, progression, décharge, test) sans prétendre calculer une fraction du 1RM et sans court-circuiter le Coach.

Phrase produit :

> Le bloc fixe l’intention. Le Coach valide l’action à partir des performances.

Quatre couches, dans cet ordre :

1. **Routine** — source de vérité des cibles de base. `100` = exactement la prescription écrite (charge, fourchette, séries). Ni 1RM estimé, ni dernière séance.
2. **Bloc** — fournit `loadIndex` + `phase` pour chaque semaine.
3. **Coach** — unique moteur qui propose les actions concrètes.
4. **Séance réalisée** — réalité enregistrée. Elle ne mute jamais la référence (routine ni semaine de bloc).

La séance réalisée sert au Coach pour décider si une progression *prévue* est *méritée*. Un mardi catastrophique ne réécrit pas le 100 % du bloc.

## 2. Hors périmètre

- Génération automatique d’un roman de périodisation (décharge S5, pic S8) à la création d’un bloc.
- Multiplication `targetLoad * (loadIndex / 100)`.
- RIR comme dépendance d’une décision. Le champ pourra arriver plus tard ; son absence = comportement identique.
- Un second algorithme de surcharge progressive réservé aux blocs.
- Backfill de `programPhase` / `programLoadIndex` sur les séances déjà enregistrées.
- Conversion inventée RPE de semaine → `loadIndex`.
- Combinaisons phase × niveau interdites par le schéma (l’UI guide, le modèle reste souple).
- Changer le fonctionnement du wizard (étapes cliquables, nouvel ordre).

## 3. Modèle de données

### 3.1 Semaine de bloc

```ts
/**
 * Relative programming level for a block week. Non-dimensional and
 * non-multiplicative: 105 is not "times 1.05". The UI may print it as
 * "105 %" — that glyph is decoration, never an operator.
 */
export type ProgramLoadIndex = number;

export type ProgramPhase =
  | 'construction'
  | 'progression'
  | 'overload'
  | 'deload'
  | 'return'
  | 'test';

export interface ProgramWeek extends Syncable {
  programId: string;
  weekIndex: number;
  loadIndex: ProgramLoadIndex;
  phase: ProgramPhase;
  notes?: string;
}
```

- `loadIndex` : entier, défaut `100`. Métadonnée de niveau. Interdit dans `nextLoad`, le 1RM, et tout calcul de charge.
- `phase` : défaut `construction`.
- `isDeload` disparaît. Une décharge **est** `phase === 'deload'`.
- `prescriptionKind` et `prescriptionValue` disparaissent.

Les couples « étranges » (`105` + `construction`) sont **légaux**. Un changement **explicite de phase dans l’éditeur** remplace momentanément le `loadIndex` par la suggestion associée (voir §7). Cette écriture est une aide d’éditeur uniquement, immédiatement modifiable, jamais appliquée hors de cette interaction (pas en migration, pas au démarrage d’une séance, pas au recalcul). Changer le `loadIndex` ne change pas la phase.

### 3.2 Snapshot de séance

À la **création** d’une séance programmée :

```ts
programPhase = week.phase
programLoadIndex = week.loadIndex
programIsDeload = programPhase === 'deload' ? 1 : 0
```

`programIsDeload` est **dérivé** du snapshot de phase, pas une deuxième vérité. On le conserve tant que le reste du code (Coach, analytics) le lit.

Si plus tard on reclasse la semaine 3, une séance déjà terminée continue d’afficher le contexte dans lequel elle a été faite.

Les séances **sans** `programPhase` restent ainsi : `undefined` = modèle legacy. On n’invente pas `construction`.

### 3.3 Migration Dexie `version(7)`

Pas de nouvel index. Backfill des `ProgramWeek` vivantes uniquement :

| Avant | Après |
|---|---|
| `percent_1rm` + `prescriptionValue` V | `loadIndex: V`, `phase: construction` |
| idem + `isDeload === 1` | `loadIndex: V`, `phase: deload` |
| `target_rpe` | `loadIndex: 100`, `phase: construction` — l’intention RPE de *semaine* est **perdue**, sans conversion |

Un journal de migration (log / rapport de debug), pas un champ runtime, suffit à auditer les `target_rpe`.

Aucune mutation des routines. Aucune mutation des séances passées. Les cibles déjà figées dans `WorkoutSet.target*` restent.

## 4. Moteur de performance

Deux constats **distincts**, pas deux intensités du même état.

### 4.1 Signaux

Les deux constats de fourchette forment une **partition exclusive** :

```
effectiveCeiling = targetRepsMax ?? targetReps

range_ceiling_reached =
  hasTarget &&
  everyWorkSet(reps >= effectiveCeiling)

range_satisfied =
  hasRange &&                    // targetReps et targetRepsMax, et max > min
  everyWorkSet(reps >= targetReps) &&
  !range_ceiling_reached
```

`hasRange` est faux s’il n’y a qu’une cible unique : atteindre cette cible est uniquement le plafond.

| Exemple (3×8–12) | Signal |
|---|---|
| 12 / 12 / 12 | `range_ceiling_reached` seulement |
| 12 / 12 / 10 | `range_satisfied` seulement |
| 10 / 10 / 9 | `range_satisfied` seulement |
| 12 / 12 / 7 | aucun des deux |

On ne journalise jamais les deux sur la même observation.

| Signal | Définition |
|---|---|
| `range_satisfied` | Voir partition ci-dessus. |
| `range_ceiling_reached` | Voir partition ci-dessus. |
| `range_missed` | Inchangé : deux séances de suite sous le plancher, **à la même charge**, hors décharge. |
| `plateau` | Inchangé comme constat. Interdit **toute escalade** (voir 4.2). |
| `intra_session_drop`, `long_rest` | Inchangés. Constats seulement. |

Règles de silence, inchangées dans l’esprit du Lot 18 :

- pas de `targetRepsMax` : atteindre `targetReps` **est** le plafond (`range_ceiling_reached`) ;
- import / ligne sans cible : aucun de ces trois signaux de fourchette ;
- échauffements exclus ;
- séance de décharge (`programIsDeload === 1` ou `deloadPercent` manuel valide) : pas de `range_satisfied` / `range_ceiling_reached` / `range_missed` (comme aujourd’hui pour `range_completed`).

`range_completed` n’est plus écrit. À la **lecture** du journal, `range_completed` = alias de `range_ceiling_reached`. On ne fabrique pas de `range_satisfied` rétroactifs.

### 4.2 Actions autorisées

Le moteur sort **deux listes indépendantes** :

- **signaux** — constats, toujours affichables s’ils sont vrais ;
- **actions** — ce qu’on a le droit de proposer.

| État | Actions autorisées |
|---|---|
| `range_satisfied` | `{ maintain, increase_reps }` |
| `range_ceiling_reached` | `{ maintain, increase_load, add_set }` |
| rien de notable | `{ maintain }` |
| `range_missed` | `{ reduce_load, maintain }` |

Puis, si le signal `plateau` est présent, **toute escalade de prescription** est retirée — y compris `add_set`, qui n’est pas un `increase_*` :

```
allowedActions.delete('increase_reps')
allowedActions.delete('increase_load')
allowedActions.delete('add_set')
```

Il reste `{ maintain }`, et `reduce_load` si `range_missed` coexiste.

Le plateau est un **critère de performance**, pas un habillage. Il s’applique **avant** que la phase ne choisisse. Une Surcharge ne peut pas répondre à un plateau en ajoutant encore du volume.

Invariant de double progression :

> On n’augmente jamais la charge tant que la fourchette n’est pas saturée.

Donc `increase_load` est **interdit** sur un simple `range_satisfied`. `increase_reps` est **absent** du plafond : on ne pousse pas les reps hors contrat de plage.

`maintain` est toujours dans l’ensemble dès qu’il y a une lecture possible.

## 5. Contrat Coach

```
PERFORMANCE ENGINE
        ↓
signals + allowedActions
        ↓
PROGRAM PHASE  (targetProgramContext)
        ↓
selection / ranking / filtering of allowedActions
        ↓
COACH RECOMMENDATION
```

À côté, hors Coach :

```
DELOAD (phase)
   ↓
pre-session target transformation
   ↓
Workout targets
```

### 5.1 Source ≠ cible

- **`sourceProgramContext`** — snapshot de la séance **réalisée**. Sert à comprendre et afficher l’historique.
- **`targetProgramContext`** — `loadIndex` + `phase` de la **prochaine** séance programmée connue. Sert à choisir l’action proposée.

Si aucune prochaine séance de bloc n’est connue : comportement Coach hors bloc (Construction, sans biais).

Conséquence : terminer S4 Surcharge alors que S5 est une Décharge ne doit pas proposer `add_set`. Terminer une Décharge avant une Reprise ne doit pas interdire les cartes de charge pour S6.

### 5.2 Invariants

1. **Une phase ne modifie jamais à elle seule les actions autorisées par le moteur.** Elle choisit, priorise ou (pour les actions concurrentes seulement) écarte une action moins urgente. Elle ne transforme pas un critère non satisfait en critère satisfait.
2. **Une phase ne supprime pas un signal.** Progression ne peut pas faire disparaître « Plateau détecté » même si l’action retenue est `maintain`.
3. **`loadIndex` n’entre pas dans `nextLoad`, le 1RM, ni aucun calcul de charge.**
4. **RIR (futur)** : absent = identique. Présent = peut confirmer ou freiner une action **déjà** autorisée. Ne crée jamais à lui seul une progression.

Test mutant obligatoire : une phase qui autoriserait `increase_load` sans `range_ceiling_reached` fait échouer la suite.

### 5.3 Reco en attente

À l’activation d’un bloc, les recommandations **numériques prescriptives** `pending` (`nextLoadKg` défini) des exercices du split passent à `superseded`. Les observations / alertes ne sont pas touchées.

Un refus utilisateur pendant le bloc suit les règles actuelles (même chiffre + même code ne revient pas).

## 6. Règles par phase

La phase lue est celle de **`targetProgramContext`**.

Grille de départ (sauf Décharge) = prescription de la **routine**, jamais la dernière séance.

| Phase | Grille à l’ouverture | Choix parmi les actions autorisées |
|---|---|---|
| `construction` | Routine | Double progression **complète**, déterministe : `increase_load` > `increase_reps` > `maintain`. **`add_set` n’est jamais sélectionné.** Grâce à la partition du moteur, `increase_load` n’existe qu’au plafond et `increase_reps` que sur *satisfied* — ce n’est pas un biais de Progression. Hors bloc = le même ordre. |
| `progression` | Routine | `increase_load` > `increase_reps` > `maintain`. Pas de `add_set`. Si aucun `increase_*` : `maintain` + « progression différée ». |
| `overload` | Routine (pas de 4ᵉ série magique) | `add_set` > `increase_reps` > `increase_load` > `maintain`. |
| `deload` | **Transformée** (voir 6.1) | Hors sélection d’augmentation. Le Coach observe seulement. |
| `return` | Routine à 100 %, pas les chiffres de décharge | `maintain` > `increase_reps` > `increase_load`. Un incrément autorisé n’est pas choisi. |
| `test` | Routine | Ne crée aucune permission. Requalifie un `increase_*` déjà autorisé en **tentative contrôlée** (haut de fourchette ou essai de charge). Sinon maintien. |

Construction ne bavarde pas : pas de phrase d’intention sous la ligne de semaine.

### 6.1 Recette Décharge (déterministe)

Le bloc ne demande pas au Coach s’il « mérite » de réduire. Recette, **pas** `loadIndex × charge` :

- charge : deux incréments sous la cible routine (`previousLoad` deux fois), plancher 0 ;
- volume : une série de travail en moins, minimum une ;
- reps : bas de fourchette s’il existe, sinon la cible unique ;
- échauffements inchangés.

`programIsDeload` est posé à la création (3.2). Les signaux de fourchette / plateau restent exclus sur cette séance, comme aujourd’hui.

`loadIndex` n’entre **pas** dans cette recette. `createDeloadTargets(routine, 60)` === `createDeloadTargets(routine, 90)` à routine et phase Décharge identiques. « 60 % » est une notation narrative.

## 7. Affichage et création des semaines

Grammaire unique (wizard, fiche, accueil, semaines suivantes) :

`05 — 60 % · Décharge`

- numéro humain = `weekIndex + 1` ;
- « 60 % » = décor de `loadIndex` ;
- mot de phase : Construction, Progression, Surcharge, Décharge, Reprise, Test. Décharge se distingue (puce / graisse), pas un second pourcentage.

Accueil : `Semaine 3 · Progression`. Plus aucune chaîne du type « 80 % du 1RM ».

Bloc neuf : **toutes** les semaines à `100` / `construction`. Aucune périodisation inventée.

Un **changement explicite de phase** dans l’éditeur remplace momentanément le `loadIndex` par la suggestion (Décharge → 60, Progression → 105, Surcharge → 110, Reprise → 100, Test → 110, Construction → 100). Exemple : `105 / Construction` → l’utilisateur choisit Décharge → le champ passe à `60` ; il peut immédiatement retaper `105`. Cette écriture n’existe que dans cette interaction. Elle n’est ni une règle métier, ni une migration, ni un recalcul automatique. Changer le niveau ne change pas la phase.

Pastilles de niveau : 60 / 90 / 100 / 105 / 110, plus entier libre. Phase : liste des six. Plus de checkbox Décharge.

Phrases d’intention (semaine **cible**, pas la séance qu’on vient de finir) :

| Phase | Phrase |
|---|---|
| Construction | (aucune) |
| Progression | Progresser si les perfs le permettent. |
| Surcharge | Ajouter du volume si c’est déjà autorisé. |
| Décharge | Charge et volume réduits. |
| Reprise | Retour à la prescription, sans forcer. |
| Test | Tentative contrôlée, seulement si déjà autorisée. |

Carte Coach : le chiffre + le constat. Si Progression sans `increase_*` : **Maintien — progression différée**.

Legacy sans `programPhase` : silence, pas d’heuristique.

## 8. Indicateur du wizard « Nouveau bloc »

Trois étapes toujours linéaires : Cadre → Split → Semaines. Non cliquables. Retour = flèche du header.

Représentation :

- une ligne : `Étape {n} sur 3 · {nom}` (`program.stepProgress`) ;
- dessous, trois numéros `1 2 3` — l’étape courante en encre pleine, les autres en `--text-2` ;
- pas de `border-b` pleine largeur, pas de soulignement orange façon onglet.

`nav` + `aria-current="step"` conservés. On change le dessin, pas le fonctionnement.

## 9. Textes UI

Toutes les chaînes vivent dans `src/i18n/fr.ts`. Disparaissent les libellés qui affirment un calcul faux : `percentOneRm`, `percentReading` (« {value} % du 1RM »), `targetRpe` comme type de *semaine*.

## 10. Tests minimaux (contrat)

- `loadIndex` n’apparaît dans aucun chemin `nextLoad` / 1RM (mutant : une multiplication par `loadIndex / 100` casse un test).
- `increase_load` absent si seulement `range_satisfied`.
- `increase_reps` absent si `range_ceiling_reached`.
- 3×8–12, 12/12/10 → `range_satisfied`, pas de plafond ; `increase_reps` autorisé ; `increase_load` interdit.
- 3×8–12, 12/12/12 → plafond, pas de `range_satisfied` ; `increase_load` autorisé ; `increase_reps` interdit.
- Plafond + plateau + phase `overload` → `add_set` interdit ; action = `maintain` ; signal plateau affiché.
- Phase Progression + plafond + plateau → `{ maintain }` ; reco = maintien ; signal plateau affiché.
- `targetProgramContext` = décharge alors que la séance close était surcharge : pas de `add_set`.
- Décharge : cibles réduites avant séance ; `programIsDeload === 1` ; pas d’escalade proposée pour une *cible* encore en décharge.
- `createDeloadTargets(routine, 60)` === `createDeloadTargets(routine, 90)`.
- Création séance S3 `progression` / 105, puis édition de S3 en `deload` / 60 → la séance existante reste `progression` / 105.
- Migration : `percent_1rm` 75 → `loadIndex` 75 ; `target_rpe` → 100 / construction ; séances existantes intactes.
- Wizard : le `nav` annonce l’étape ; les trois items ne sont pas des boutons.

## 11. Décisions figées (relecture)

1. `loadIndex` non dimensionnel, non multiplicatif — écrit sur le type.
2. Routine = 100 %. Jamais la dernière séance.
3. Signaux ≠ actions. La phase ne touche qu’aux actions, et seulement pour choisir / prioriser.
4. Source snapshot ≠ cible de la prochaine séance.
5. Décharge = transformateur pré-séance, pas une décision Coach.
6. Test ne crée aucune permission.
7. `range_completed` lu comme plafond ; pas de *satisfied* rétroactif.
8. `programIsDeload = programPhase === 'deload'` à la création seulement.
9. RIR futur : modificateur, jamais une dépendance.
10. Pas de roman automatique à la création du bloc.
11. `range_satisfied` et `range_ceiling_reached` sont exclusifs.
12. Plateau interdit `increase_reps`, `increase_load` **et** `add_set`.
13. Construction ne sélectionne jamais `add_set`.
14. Suggestion de `loadIndex` = aide d’éditeur au changement de phase, rien d’autre.
