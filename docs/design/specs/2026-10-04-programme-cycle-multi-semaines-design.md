# Un split sur plusieurs semaines : le cycle d'un bloc

**Date :** 2026-10-04

**Statut :** demandé par l'utilisateur (« j'ai pas une routine sur 1 semaine mais sur 2 semaines, ce
qui fait que Programmes ne peut pas fonctionner »)

**Périmètre :** le split d'un bloc (Lot 17) — son modèle, sa résolution semaine par semaine, son
éditeur et sa fiche

**Plan d'exécution :** `docs/design/plans/2026-10-04-programme-cycle-multi-semaines.md`

## Problème

Le Lot 17 pose qu'un bloc répète **un** split hebdomadaire : chaque séance planifiée porte un jour de
1 à 7, et la même semaine se rejoue du début à la fin (spec du Lot 17, §2). Un entraînement qui tient
sur deux semaines n'y entre pas.

Le cas qui a fait écrire ceci : quatre séances « haut / bas » une semaine, six « push / pull / jambes »
la suivante — dix séances sur un cycle de deux semaines. Un split hebdomadaire ne sait pas dire « une
semaine sur deux » : il aurait fallu écrire dix séances sur sept jours, ou renoncer au bloc.

## Décision

Un split est un **cycle** de une à quatre semaines, rejoué en boucle pendant tout le bloc. Une semaine
qui se répète est le cas particulier d'un cycle d'une semaine : c'est le défaut, et c'est ce que lit
toute ligne écrite avant que les cycles existent.

- Chaque séance planifiée porte la **semaine du cycle** à laquelle elle appartient, en plus de son jour
  (de 1 à 7, dans cette semaine-là).
- Une semaine du cycle peut ne contenir aucune séance : c'est un repos complet. Le cycle, lui, doit en
  contenir au moins une.
- Le bloc n'a pas besoin d'être un multiple du cycle : un bloc de neuf semaines à cycle de deux finit
  par la première semaine du cycle.
- Quatre semaines au plus : un bloc dure au moins quatre semaines, donc un cycle joue toujours au
  moins une fois en entier.

## Ce qui ne change pas

- Le calendrier fixe (la semaine 1 commence un lundi), l'action « Décaler le bloc », un seul bloc actif.
- La **prescription reste par semaine du bloc** : phase et niveau (`ProgramWeek`) ne connaissent pas le
  cycle. Une décharge en semaine 5 est une décharge en semaine 5, quelle que soit la semaine du cycle
  qu'on y joue.
- Les séances déjà faites : elles gardent leur `programWeekIndex` et leur entrée planifiée, le passé ne
  se réécrit jamais.
- L'autorité du programme sur le Coach, le gel des cibles dans la séance, la suppression douce.
- **Aucune table, aucun index, aucune version de schéma.** Les deux champs ajoutés ne sont pas indexés
  et absents valent la valeur historique.

## Modèle de données

```ts
interface ProgramScheduleRevision {
  // champs existants
  /** Semaines du cycle (1 à 4). Absent = 1 : la semaine unique d'avant. */
  cycleWeeks?: number;
}

interface ProgramScheduleEntry {
  // champs existants
  /** Semaine du cycle, à partir de 0. Absent = 0. `dayOfWeek` reste de 1 à 7, dans cette semaine. */
  cycleWeek?: number;
}
```

Les écritures posent toujours les deux champs ; la lecture les rend facultatifs (`cycleLength`,
`entryCycleWeek` rendent 1 et 0 pour une ligne ancienne ou illisible). La validation de sauvegarde les
déclare : `cycleWeeks` entier d'au moins 1, `cycleWeek` entier positif ou nul, une sauvegarde d'avant les
cycles n'en porte aucun.

## Quelle semaine du cycle joue une semaine du bloc

La position est `(semaine du bloc − semaine d'entrée en vigueur de la révision) modulo la longueur du
cycle`.

Le cycle se compte **depuis la semaine où sa révision prend effet**, pas depuis le début du bloc. Une
révision écrite « à partir de la semaine 4 » commence par la première semaine de son cycle, quelle que
soit la parité de la semaine 4 : c'est ce qui rend l'éditeur honnête, parce que la première semaine
qu'on y lit est celle qui sera jouée en premier.

Trois lectures, trois fonctions pures de `src/lib/programs/schedule.ts` :

- `resolveSchedule(révisions, séances, semaine)` — ce qui **se joue** cette semaine-là : seules les
  séances de la semaine du cycle. C'est la lecture de l'accueil, de la fiche, du démarrage d'une séance
  et du Coach, qui n'ont pas changé d'un caractère.
- `resolveRevision(révisions, séances, semaine)` — la révision applicable avec **toutes** les semaines de
  son cycle. C'est la lecture de ce que le bloc **possède** : l'activation, et les exercices que le
  Coach doit cesser de prescrire.
- `resolveSplitFrom(révisions, séances, semaine)` — le split relu **à partir** d'une semaine : le cycle est
  tourné pour que cette semaine en soit la première. Une séance rangée sous une semaine que le cycle n'a
  pas est écartée (elle n'a jamais été jouée).

## Propriété et réparation

- **Activer** valide et possède **tout** le cycle de la première révision : une routine de la deuxième
  semaine doit exister, et ses exercices cessent d'être prescrits par le Coach dès l'activation, comme
  ceux de la première.
- **Réécrire un split** compare avec le cycle précédent entier. Sans cela, réécrire à l'identique un
  cycle de deux semaines aurait fait passer les exercices de l'autre semaine pour « introduits » et
  périmé leurs recommandations en attente.
- **Réparer une routine supprimée** réécrit le split entier, **tourné** pour commencer à la semaine
  affichée. La réparation écrit une révision à cette semaine ; sans rotation, elle aurait décalé le cycle
  d'une semaine pour tout le reste du bloc.

## Validation d'écriture

`createScheduleRevision(programId, semaine, séances, cycleWeeks = 1)` refuse (`program_invalid`) :

- un `cycleWeeks` qui n'est pas un entier de 1 à 4 ;
- une séance dont `cycleWeek` n'est pas un entier de 0 à `cycleWeeks − 1` ;
- deux séances au même jour **et** au même rang d'une **même** semaine du cycle — le lundi de la semaine 1
  et celui de la semaine 2 sont deux lundis.

Le reste est inchangé : semaine d'entrée valide, routines vivantes, révision qui ne remonte pas dans le
passé.

## Interface

### Éditeur — étape « Split » et section « Split »

- **Durée du cycle** : quatre pastilles, « Chaque semaine » (le défaut), « 2 semaines », « 3 semaines »,
  « 4 semaines ». Avec « Chaque semaine », l'écran est celui d'avant : une liste de séances, pas de titre
  de semaine.
- Au-delà : **une liste par semaine du cycle**, sous un titre « Semaine N du cycle », avec son propre
  bouton « Ajouter à la semaine N ». Les séances sont numérotées dans l'ordre de l'écran, de la première
  semaine à la dernière.
- Une semaine du cycle sans séance le dit : « Aucune séance : cette semaine du cycle est un repos complet. »
- **Raccourcir le cycle ne perd aucune séance** : celles des semaines qui disparaissent se replient dans la
  dernière semaine restante. Un appui sur une pastille ne doit pas effacer ce qui a demandé une douzaine
  d'appuis.
- Sur un bloc **actif**, la révision s'écrit à partir d'une semaine : l'éditeur lit le cycle **à partir de
  cette semaine** et le dit (« Le cycle repart à la semaine 5 du bloc : sa semaine 1 est celle qu'on y
  jouera. »), pour que deux semaines tournées ne se lisent pas comme échangées.

### Fiche du bloc

La section de la semaine dit « Semaine 2 du cycle de 2 semaines » sous son titre quand le cycle dure plus
d'une semaine. Une semaine de repos complet affiche tout de même ses sept jours de repos : c'est ce qu'on
vient y lire.

## Hors périmètre

- Ajouter d'un coup toutes les routines d'un dossier à une semaine du cycle (une commodité, pas une
  capacité : chaque séance se place aujourd'hui une à une).
- Un cycle de plus de quatre semaines, ou un cycle qui ne démarre pas à sa première semaine : on choisit
  l'ordre des semaines du cycle, pas un décalage.
- Une prescription (phase, niveau) propre à chaque semaine du cycle : elle reste par semaine du bloc.

## Vérification

TDD sur la logique pure, puis dépôts, puis interface.

- `schedule.test.ts` : l'alternance des semaines, le comptage depuis la semaine d'effet, une ligne
  ancienne lue comme un split d'une semaine, une semaine de repos, une séance hors cycle jamais montrée,
  la longueur illisible, la rotation de `resolveSplitFrom` qui rejoue semaine pour semaine ce que jouait
  l'ancienne révision.
- `programCycle.test.ts` (dépôt, `fake-indexeddb`) : les champs stockés, la séance de la bonne semaine à
  l'accueil, démarrer la séance de la semaine courante et refuser celle de l'autre, activation refusée si
  une routine de la deuxième semaine a disparu, recommandations périmées pour les exercices des deux
  semaines, **pas** pour ceux d'une semaine seulement réécrite, validation d'écriture, réparation qui ne
  perd ni l'autre semaine ni la phase du cycle.
- `programEditorModel.test.ts` : numérotation de `order` par semaine, repli au raccourcissement, ajout en
  fin de semaine, relecture tournée.
- `validate.test.ts` : les deux champs de la sauvegarde.
- `ProgramFlow.integration.test.tsx` : créer un bloc à deux semaines par l'interface, raccourcir sans
  rien perdre, lire la semaine du cycle sur la fiche, réécrire un bloc actif sans décaler ses semaines.

## Checkpoint téléphone

1. Planifier › Programmes › « + » : nom, lundi, huit semaines. Au Split, **2 semaines** : quatre séances
   « haut / bas » en semaine 1, six « push / pull / jambes » en semaine 2, jours et routines posés.
2. Activer : la fiche dit « Semaine N du cycle de 2 semaines » et ne liste que les séances de cette
   semaine ; la semaine suivante, c'est l'autre.
3. Accueil : la carte du bloc propose la séance du jour de la semaine en cours.
4. ⋯ › Modifier à partir de… : le split s'ouvre lu à partir de la semaine d'effet, avec la phrase qui le
   dit ; enregistrer sans toucher à rien ne change aucune semaine.
