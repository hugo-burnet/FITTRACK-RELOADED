# Front Programmes — liste, fiche, recettes, édition

**Date :** 2026-08-13
**Statut :** conception à valider
**Ne remplace pas :** intention de bloc, `loadIndex` non multiplicatif, Coach, snapshot de séance, un seul bloc actif, `deleteProgram` existant, calendrier civil.
**Remplace, dans l’UI seulement :** la liste plate, le wizard `1 2 3` à l’édition, l’absence de suppression à l’écran, l’arc de semaines illisible.

## 1. Objectif

Les écrans Programmes doivent donner envie de poser un bloc et de le suivre, sans inventer un second langage visuel.

Phrase produit :

> L’actif est le héros. L’arc se lit. Une recette pose le trajet, la timeline le corrige.

Contraintes projet (non négociables) :

- Une main, cibles ≥ 48 px, contraste, thème sombre déjà en place.
- Tous les textes dans `src/i18n/fr.ts`.
- Réutiliser `Screen`, `Card`, `ListRow`, `ActionBand`, `FilterChip`, `ConfirmSheet`, `EmptyState`, `weekLine`, `weekPhaseReading`.
- Pas de nouvelle police, pas de courbe, pas de tokens neufs.
- Accès données uniquement via `src/data/repositories/*`.
- Aucune multiplication par `loadIndex`. Les recettes n’écrivent que `phase` + `loadIndex`.

## 2. Hors périmètre

- Courbe / sparkline des %.
- Recettes persistées en base (pas de table Dexie).
- Recettes définies par l’utilisateur.
- Étapes du wizard cliquables.
- Extraire un `ProgramHero` partagé avec l’accueil (on peut le faire plus tard).
- Réécrire l’accueil.
- Toucher aux séances d’historique ou aux routines à la suppression.
- Index Dexie supplémentaire.

## 3. Décisions verrouillées

| Sujet | Choix |
|---|---|
| Arc + % | Recettes de bloc **et** timeline éditable |
| Suppression | Tous les statuts, confirmation, historique intact |
| Navigation | Création = 3 étapes **nommées**. Édition = sections, pas de wizard |
| Liste | L’actif est le héros. Brouillons / terminés en rangées |
| Approche visuelle | Même grammaire que l’accueil (approche 1) |

## 4. Liste `/programs`

### 4.1 États

| État | UI |
|---|---|
| Chargement | Phrase existante `program.loading` |
| Erreur | Bandeau `program.detailReadError` |
| Aucun bloc | `EmptyState` + bouton « Créer un bloc » |
| Actif présent | Héros (`Card`) puis rangées des autres |
| Pas d’actif, seulement brouillons / terminés | Rangées seules, pas de carte vide |

Le « + » du header reste : crée un bloc (`/programs/new`).

### 4.2 Héros (bloc actif)

Même lecture que `HomeProgramCard`, **sans** recalculer le prochain dans le composant.

Source : exporter `getActiveProgramProjection()` depuis `src/data/repositories/home.ts` (aujourd’hui `readHomeProgramProjection`, non exporté). La liste n’appelle pas `pickProgramSession`.

Contenu :

- sur-titre `Semaine {n} sur {total}` (`home.programWeek` ou clé liste équivalente)
- nom du bloc
- `weekPhaseReading` (`Semaine 3 · Progression`) ; Décharge en `--accent-ink`
- règle déjà localisée (aujourd’hui / manquée / à venir / commence le / semaine suivante / semaine terminée)
- bouton **Démarrer {routine}** uniquement si `pick.kind === 'session'` et `routineName !== null`
- routine manquante : bouton « Réparer le split » (même sémantique que l’accueil)
- tap sur le reste de la carte → `/programs/:id`

Pas de timeline dans le héros.

Si une séance est déjà en cours : le bouton est désactivé (comme l’accueil).

### 4.3 Rangées

`ListRow` pour chaque programme dont `id !==` actif :

- titre : nom
- sous-titre : `{n} semaines · départ le {date}` (`program.listDuration`)
- trailing : statut (Brouillon / Terminé ; un actif ne devrait pas apparaître ici)
- tap → fiche

Ordre actuel de `listPrograms` conservé (départ desc, puis création).

## 5. Fiche `/programs/:id`

Inchangé dans la structure : progression `metric`, intention `weekLine`, séances de la semaine, semaines suivantes en `weekLine`.

Ajouts :

- Brouillon **incomplet** (pas de split vivant, ou `weeks.length !== durationWeeks`) : pas de Démarrer. `ActionBand` « Continuer la création » → éditeur empilé.
- Brouillon **complet** : pas de Démarrer. `ActionBand` « Activer le bloc » (`activateProgram`). ⋯ → Modifier reste disponible.
- Menu ⋯ selon le statut :

| Action | Brouillon | Actif | Terminé |
|---|---|---|---|
| Modifier | oui → éditeur empilé | oui → éditeur empilé (futur seulement) | non |
| Décaler | oui | oui | non |
| Terminer le bloc | non | oui | non |
| Supprimer le bloc | oui | oui | oui |

« Terminer » ≠ « Supprimer ».

### 5.1 Suppression

UI : `ConfirmSheet` danger.

- Titre : Supprimer le bloc
- Corps : les séances déjà faites restent dans l’historique. Le split et les semaines de ce bloc disparaissent.
- Confirmer : Supprimer

Appelle `deleteProgram` (déjà là : soft-delete du graphe programme, jamais routine ni workout).

Succès → `navigate('/programs')`.

Échec → bandeau `program.actionError`.

## 6. Création `/programs/new`

Wizard **uniquement** ici. Trois étapes, **noms** pas des chiffres :

```
Étape 2 sur 3 · Split
Cadre     Split     Semaines
```

- Ligne 1 : `program.stepProgress` (déjà là).
- Ligne 2 : les trois noms `program.stepBasics` / `stepSplit` / `stepWeeks`. L’étape courante en `--text-1`, les autres en `--text-2`. Pas cliquables. Le retour arrière parcourt les étapes comme aujourd’hui.

Persistance inchangée : cadre → brouillon, split → révision 0, semaines → `replaceProgramWeeks` + `activateProgram`.

Étape Semaines : voir §8 (recettes + timeline).

## 7. Édition `/programs/:id/edit`

Pas de wizard. Un défilement, sections empilées, titres de section existants.

### 7.1 Brouillon

Sections : Cadre, Split, Semaines (toutes éditables).

`ActionBand` : « Enregistrer le brouillon » — écrit cadre, split (révision 0), semaines. Retour fiche. L’activation se fait sur la fiche (§5).

### 7.2 Actif

Le passé est scellé.

- Sélecteur déjà là : semaine d’entrée en vigueur (`effectiveFromWeekIndex`).
- Split : éditable, enregistré comme révision à cette semaine.
- Semaines : les semaines `weekIndex < effectiveFromWeekIndex` sont **affichées en lecture seule**. Les suivantes sont éditables. Une recette ne réécrit que les semaines éditables.
- `ActionBand` : « Utiliser à partir de la semaine {n} » — révision + `replaceProgramWeeks` des semaines éditables (les semaines passées sont renvoyées telles quelles, pas mutées).

### 7.3 Terminé

Pas d’entrée éditeur. Le lien ⋯ n’offre pas Modifier.

## 8. Recettes et timeline

### 8.1 Timeline

C’est la liste des semaines, pas un graphique.

Au-dessus de la liste, une **ligne d’arc** : les `loadIndex` du bloc, dans l’ordre, séparés par une espace fine. La semaine courante (création : aucune / édition active : semaine civile) et toute `phase === 'deload'` se distinguent par le poids / `--accent-ink` déjà utilisé. Pas de mini-barres.

Sous l’arc : la liste actuelle, une rangée par semaine, `weekLine` (`05 — 60 % · Décharge`). Tap d’une semaine **éditable** → feuille existante (phase, chips 60/90/100/105/110, `NumberInput`). Tap d’une semaine scellée : rien.

### 8.2 Recettes

Fonctions pures dans `src/lib/programs/recipes.ts` (testées avant l’UI). Pas de persistance. Une recette = `(durationWeeks) => { weekIndex, phase, loadIndex }[]`.

Trois recettes, motif de 4 semaines **répété** puis **tronqué** à `durationWeeks` :

| Id | Motif (phase, loadIndex) |
|---|---|
| `hypertrophy` | construction 100, progression 105, overload 110, deload 60 |
| `strength` | construction 100, construction 100, progression 105, test 110 |
| `return` | return 100, construction 100, progression 105, deload 60 |

Exemples :

- 8 semaines `hypertrophy` : 100 C, 105 P, 110 O, 60 D, 100 C, 105 P, 110 O, 60 D
- 5 semaines `strength` : 100 C, 100 C, 105 P, 110 T, 100 C
- 4 semaines `return` : 100 R, 100 C, 105 P, 60 D

`loadIndex` vient de `SUGGESTED_LOAD_INDEX` de la phase du motif (les chiffres ci-dessus sont ces suggestions, pas un second barème).

UI : trois `FilterChip` (ou boutons 48 px) au-dessus de l’arc, libellés français. Un tap **remplace** les semaines éditables du brouillon éditeur. Rien n’est écrit en base avant Enregistrer / Activer. Un second tap sur une autre recette remplace encore. Pas d’état « recette active » persisté : si l’utilisateur retouche une semaine, les chips se désélectionnent.

Sur un bloc actif, la recette s’applique à partir de `effectiveFromWeekIndex` : le passé affiché ne change pas.

## 9. Données et couches

- `deleteProgram` : déjà implémenté, tests repo déjà là. L’UI l’appelle, on n’ajoute pas de logique de cascade.
- Liste héros : `getActiveProgramProjection()` exporté de `home.ts`. Un seul calcul de `pick`.
- Recettes : `src/lib/programs`, zéro Dexie.
- `activateProgram` depuis la fiche brouillon : déjà dans le repository.

Aucun changement de schéma.

## 10. Copies nouvelles (clés, pas les phrases figées ici)

À ajouter dans `fr.ts` uniquement :

- suppression : titre, corps, confirmer
- « Enregistrer le brouillon »
- « Activer le bloc » (fiche brouillon)
- « Continuer la création » si le brouillon est incomplet
- libellés des trois recettes + éventuellement une intro courte au-dessus des chips
- aria de l’arc (`{n} semaines, niveaux {list}`)

Les phrases existantes (`weekLine`, `stepProgress`, `listDuration`, `completeAction`…) restent.

## 11. Tests

TDD sur les recettes : motif, troncature 4/5/8/12, `loadIndex` = suggestion de phase.

Repo : un test UI ou d’intégration

- supprimer un actif → absent de `listPrograms`, workouts du même `programId` toujours là
- recette `hypertrophy` 8 semaines puis enregistrer → 8 lignes, S4 et S8 = deload 60
- recette sur actif à partir de S5 → S1–S4 inchangées
- liste : un actif rend le bouton Démarrer avec l’`entryId` de la projection, pas un recalcul local
- `/programs/new` montre « Split » / « Cadre » / « Semaines », pas une `ol` de chiffres seuls
- `/programs/:id/edit` d’un actif n’a pas la nav d’étapes

Les composants purs d’affichage ne sont pas testés unitairement au-delà de ces contrats.

## 12. Checkpoint téléphone

1. Créer un bloc : les trois noms d’étapes se lisent. Recette Hypertrophie → l’arc 100 105 110 60 se répète. Activer.
2. Liste : le héros dit la semaine et lance la bonne séance. Un brouillon est une rangée, pas un second héros.
3. Fiche ⋯ → Supprimer → les séances restent dans l’Historique, le bloc a disparu.
4. Modifier un actif, recette Reprise à partir de S5 : S1–S4 intactes à l’écran et en base.
