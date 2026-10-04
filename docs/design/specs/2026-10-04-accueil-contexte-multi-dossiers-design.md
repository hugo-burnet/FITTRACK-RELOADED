# « À lancer » sur plusieurs dossiers

**Date :** 2026-10-04

**Statut :** demandé par l'utilisateur (« j'ai 10 séances réparties dans 2 dossiers, du coup le
lancement rapide ne peut pas fonctionner »)

**Périmètre :** le contexte de dossier de la suggestion de l'accueil — son réglage, sa projection, sa
feuille de choix et sa carte

**Complète :** `docs/design/specs/2026-08-22-home-routine-folder-context-design.md`

**Plan d'exécution :** `docs/design/plans/2026-10-04-accueil-contexte-multi-dossiers.md`

## Problème

Le contexte de l'accueil est **un** dossier (ou la racine) : la suggestion est la routine réalisée le
moins récemment parmi celles de ce dossier. Un cycle qui traverse deux dossiers — quatre séances
« haut / bas » dans l'un, six « push / pull / jambes » dans l'autre, une semaine sur deux — n'y entre
pas. Quel que soit le dossier choisi, la suggestion ne voit que la moitié du cycle, et il faut changer
de dossier à la main à chaque changement de semaine.

## Décision

Le contexte devient un **ensemble** : un ou plusieurs dossiers, avec ou sans la racine « Sans
dossier ». La règle de la suggestion ne change pas — la routine **réalisée le moins récemment** — mais
son périmètre est l'union de l'ensemble.

Pour un cycle suivi dans l'ordre, c'est exactement la séance suivante : après la dernière séance du
premier dossier, la plus ancienne de l'union est la première du second ; après la dernière du second,
c'est la première du premier. Aucune règle de plus, aucune notion de cycle dans la suggestion : le
cycle n'est que l'ensemble des routines qu'on a cochées, et la séance manquée remonte d'elle-même,
parce qu'elle est devenue la plus ancienne.

Le choix reste local, persistant, et modifié seulement par une action explicite de l'utilisateur.

## Classement

Une routine jamais réalisée passe devant toutes les autres ; à égalité, c'est l'ordre de la
bibliothèque qui tranche. Avec plusieurs dossiers, cet ordre est **dossier après dossier, chacun dans
l'ordre de ses routines**.

`Routine.order` est la place de la routine dans la liste entière : seul, il mêlerait les dossiers
dans l'ordre où leurs routines ont été créées. Le rang part donc de l'ordre des dossiers, puis de
`Routine.order`, puis de l'identifiant. La racine vient en dernier, comme dans la feuille.

## Persistance

La clé de réglage est la même (`homeRoutineFolderContext`). Une troisième forme s'ajoute aux deux
historiques :

```ts
type RoutineFolderContext =
  | { kind: 'root' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'folders'; folderIds: string[]; root: boolean };
```

- Les deux formes historiques restent lues, **et écrites quand le choix est unique** : pour qui n'a jamais
  coché qu'un dossier, rien ne change dans ce qui est enregistré, et aucune migration n'existe.
- La lecture est défensive (`normalizeRoutineFolderContext`) : une sélection vide, une liste qui n'en est
  pas une, un identifiant vide ou un drapeau de racine qui n'est pas un booléen valent « aucun choix ».
  Un dossier cité deux fois compte une fois.
- Le module pur `src/lib/routineContext.ts` porte la forme, la lecture et le passage entre le réglage et
  les lignes de la feuille (`routineContextValues`, `routineContextFromValues`). Il ne lit pas la base.

## Dossier supprimé

- Un dossier supprimé **sort de la sélection** sans invalider les autres : le cycle continue sur ce qui
  reste.
- Si **tous** les dossiers sélectionnés ont disparu alors que d'autres existent, le choix est invalide :
  l'accueil redemande, comme pour l'ancien dossier unique supprimé. Il ne pioche jamais dans un dossier
  qu'on n'a pas coché.
- Un dossier créé **après** le choix n'y entre pas : le choix est explicite.
- Quand plus aucun dossier n'existe, l'accueil retombe sur la suggestion globale, comme avant.

## Programme actif

Inchangé : un programme actif reste prioritaire sur la suggestion libre, et le contexte reste mémorisé
pour le retour au mode sans programme.

## Interface

### La feuille « Choisir les dossiers »

Des **cases à cocher**, plus des boutons radio : un cycle n'a pas de dossier unique à désigner, et le rôle
doit dire que plusieurs réponses sont permises avant le premier tap. Une phrase dit à quoi sert d'en
cocher plusieurs, quand il y en a plusieurs à cocher.

Les taps ne touchent qu'un **brouillon** ; « Terminé » écrit **une fois**. Écrire à chaque case aurait
changé le contexte sous la feuille — la carte derrière se recompose à chaque changement de sélection — et
refermé la feuille avant la deuxième case.

- Fermer sans « Terminé » ne choisit rien, et le brouillon abandonné ne revient pas à l'ouverture
  suivante : on repart de ce qui est enregistré.
- « Terminé » est grisé tant que rien n'est coché, avec « Coche au moins un dossier. » : fermer une
  feuille vide ne choisit pas à la place de l'utilisateur.
- Pendant l'écriture, aucune ligne ni sortie ne peut lancer une seconde action. Si l'écriture échoue, la
  feuille reste ouverte, les cases cochées restent cochées, et un message le dit.
- Les lignes gardent leur cible tactile de 56 px.
- La sélection s'enregistre **dans l'ordre de la bibliothèque**, quel que soit l'ordre des taps.

### La carte

L'en-tête liste les dossiers suivis, « UL + PPL 45' ». La règle écrite sous le bouton dit, quand il y en a
plusieurs : « La plus ancienne de tes routines, tous ces dossiers confondus. » Quand **aucun** des
dossiers suivis n'a de routine, la carte le dit au pluriel ; un cycle dont un seul dossier est vide a
encore de quoi proposer.

## Ce qui ne change pas

Les règles de classement et d'explication de la suggestion, le rattachement d'une séance à sa routine
par `routineId` **et** par le nom (les séances importées), la priorité d'un programme actif, et les
données : aucune table, aucun index, aucune version de schéma.

## Limites connues

- Deux routines de même nom dans deux dossiers suivis comptent l'une pour l'autre : c'est le
  rattachement par le nom, qui existait avant, appliqué à un périmètre plus large.
- Une routine jamais réalisée passe devant toutes les autres. Cocher un dossier contenant une routine
  qu'on ne fait pas la fait proposer en premier, jusqu'à ce qu'elle ait été faite une fois : c'est le
  prix d'un dossier coché en bloc, et la sortie est de ne cocher que les dossiers du cycle.

## Vérification

- `routineContext.test.ts` : la lecture défensive, les valeurs d'un réglage, le réglage d'une sélection,
  l'aller-retour.
- `settings.test.ts` : la nouvelle forme se relit, une sélection invalide vaut « aucun choix ».
- `home.test.ts` (dépôt) : la plus ancienne parmi plusieurs dossiers, le passage d'un dossier au suivant,
  un cycle jamais fait qui commence par le premier dossier de la bibliothèque (même coché en dernier), la
  sélection listée dans l'ordre de la bibliothèque, un dossier non coché jamais proposé, la racine dans la
  sélection, un dossier supprimé qui sort de la sélection, tous supprimés qui redemande, et le dossier
  unique qui marche comme avant.
- `HomeRoutineContextSheet.test.tsx` : rien d'écrit avant « Terminé », la forme historique pour un choix
  unique, l'ordre de la bibliothèque, un brouillon abandonné qui ne revient pas, la sélection vide
  refusée, l'écriture qui échoue.
- `HomeSuggestionCard.test.tsx` : l'en-tête et la règle pour plusieurs dossiers, le vide au pluriel.

## Checkpoint téléphone

1. Accueil › icône de dossier : cocher **UL** et **PPL 45'**, puis « Terminé ». La carte annonce
   « UL + PPL 45' » et propose la routine la plus ancienne des deux.
2. Faire cette séance, revenir : la carte propose la suivante, et passe d'un dossier à l'autre à la fin
   de la semaine.
3. Fermer l'app et la rouvrir : le choix est resté.
4. Rouvrir la feuille, décocher un dossier, la fermer **sans** « Terminé » : rien n'a changé.
