# Ajouter un dossier au split d'un bloc

**Date :** 2026-10-04

**Statut :** demandé par l'utilisateur, en réponse à la proposition qui terminait le cycle des
programmes (« et oui je veux bien le bouton »)

**Périmètre :** l'étape « Split » de l'éditeur d'un bloc, création et édition

**Complète :** `docs/design/specs/2026-10-04-programme-cycle-multi-semaines-design.md`

**Plan d'exécution :** `docs/design/plans/2026-10-04-split-ajouter-un-dossier.md`

## Problème

Poser un split, c'est placer les séances une à une : un jour, une routine, et une semaine du cycle. Dix
séances — quatre « haut / bas » et six « push / pull / jambes » — font une trentaine d'appuis, dans un
écran qui défile.

Or un dossier de la bibliothèque est très souvent **déjà la forme d'une semaine** : le dossier « UL »
contient la semaine haut / bas, le dossier « PPL 45' » la semaine suivante. L'information est dans la
bibliothèque, l'éditeur la redemande.

## Décision

Chaque semaine du cycle porte, sous « Ajouter à la semaine N », un bouton **« Ajouter un dossier »**. Il
ouvre une feuille qui liste les dossiers ; en toucher un pose **une séance par routine du dossier**, dans
l'ordre du dossier, sur des jours qui se suivent. Les jours se corrigent ensuite séance par séance : le
bouton pose la forme, il ne prétend pas connaître le plan.

Avec un cycle d'une semaine (« Chaque semaine »), le bouton existe aussi et fait la même chose pour la
semaine unique.

## Comportement

- **Les dossiers proposés** sont ceux qui contiennent au moins une routine, dans l'ordre de la
  bibliothèque. Chaque ligne dit combien de routines le dossier apporte (« 4 routines »).
- **« Sans dossier »** vient en dernier, et seulement si des dossiers existent : sans dossier, « sans
  dossier » est la bibliothèque entière, et choisir une routine à la fois reste la bonne porte. Sans aucun
  dossier utile, le bouton n'apparaît pas.
- **Les jours.** La première séance posée tombe le lundi, ou le lendemain du dernier jour que la semaine
  utilise déjà. Les suivantes se suivent, et on repart du lundi après le dimanche : deux séances le même
  jour restent un plan légitime.
- **Les séances vides de la semaine sont remplacées.** Une séance sans routine est un emplacement, pas un
  choix. Sans cette règle, le premier usage laisserait une « Séance 1 » vide derrière le dossier, que
  « Continuer » refuse. Seules les séances de **cette** semaine sont remplacées.
- **Ce qui est déjà rempli reste.** Le dossier s'ajoute après les séances existantes de la semaine ; en
  toucher un second les cumule.
- La feuille est un choix unique qui se referme au toucher, sans bouton de validation : on prend un
  dossier, on n'en « choisit » pas un. Rien n'y est présélectionné.
- Le **nom accessible** du bouton dit la semaine quand le cycle en a plusieurs (« Ajouter un dossier à la
  semaine 2 ») ; le texte visible reste court — « Ajouter un dossier » — parce qu'un libellé plus long
  passait à la ligne.

## Ce qui ne change pas

La validité d'un split (chaque séance a une routine, un jour de 1 à 7, une semaine qui existe), son
enregistrement, le cycle, le tutoriel (l'ancre du bouton « Ajouter une séance » ne bouge pas). **Aucune
table, aucun index, aucune version de schéma** : l'éditeur lit les dossiers que la bibliothèque a déjà.

## Architecture

- `programSplitModel.ts` — le modèle du brouillon de split, extrait de `programEditorModel.ts` quand celui-ci
  a dépassé 300 lignes : le split est la part qui a pris une forme à elle (cycle, semaines, dossiers), le reste
  de l'éditeur (cadre, semaines du bloc, erreurs) n'en dépend pas. Deux fonctions pures s'y ajoutent :
  `addFolderSessions(split, semaine, routineIds)` et `splitFolderChoices(dossiers, routines)`.
- `useProgramEditorData` lit les dossiers avec les routines, dans la même lecture réactive.
- `ProgramSplitStep` porte le bouton et la feuille (`OptionSheet`, le choix unique de la bibliothèque de
  composants).

## Vérification

- `programSplitModel.test.ts` : les routines remplacent l'emplacement vide et se répartissent sur des jours
  consécutifs ; le départ au lendemain du dernier jour utilisé ; le retour au lundi après le dimanche ; le
  rangement sous la bonne semaine, liste toujours triée par semaine ; seuls les emplacements de la semaine
  visée sont remplacés ; un dossier sans routine ne change rien ; l'ordre des dossiers et celui des
  routines d'un dossier ; « Sans dossier » en dernier ; aucune proposition sans dossier.
- `ProgramFlow.integration.test.tsx` : poser UL puis PPL par l'interface, de la feuille à l'activation, et
  relire le split stocké ; le bouton absent d'une bibliothèque sans dossier.
- Chromium à 390 px, thèmes Sombre et TTY1 : dix séances posées en deux appuis, UL du lundi au jeudi et PPL du
  lundi au samedi, sans erreur de console. Le titre de la feuille, d'abord trop long, y était tronqué.

## Checkpoint téléphone

1. Planifier › Programmes › « + », puis le Split : **2 semaines**.
2. Sous la semaine 1, « Ajouter un dossier » › **UL** : les quatre séances sont posées, du lundi au jeudi.
3. Sous la semaine 2, « Ajouter un dossier » › **PPL 45'** : les six séances, du lundi au samedi.
4. Corriger un jour si le plan n'est pas lundi-jeudi / lundi-samedi, puis continuer.
