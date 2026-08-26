# Routines, lecture du Wiki et retours du coach en séance

**Date :** 2026-08-26
**Statut :** conception demandée par l’utilisateur, à relire avant implémentation
**Branche :** `master`

## 1. Décision

Trois surfaces récentes emploient des signes qui existent déjà dans FitTrack, mais pas encore avec
la même grammaire : la bibliothèque de routines, les articles du Wiki et les recommandations du
coach visibles pendant une séance.

La reprise ne crée ni nouvelle identité graphique ni nouveau système de composants. Elle applique
les jetons, les cibles tactiles et les gestes déjà éprouvés dans la séance en cours. Le travail porte
sur la hiérarchie, la densité et l’explicitation des actions.

Phrase de conception :

> Organiser se commande comme une liste, lire se présente comme un texte, agir pendant une séance
> se décide par un bouton explicite.

## 2. Constats vérifiés

### 2.1 Bibliothèque de routines

- « Tout replier » occupe une ligne de texte alors que `CollapseAllIcon` et `ExpandAllIcon` sont
  déjà utilisés dans `WorkoutScreen` avec une cible de 48 px.
- Le cadenas est le bon composant (`OrderLockButton`), mais il flotte seul à l’autre extrémité de
  cette ligne et ne compose pas une barre d’outils cohérente.
- Les dossiers n’ont aucun chevron visible ; leur état replié n’est lisible qu’après disparition du
  contenu.
- La racine « Sans dossier » est affichée même lorsqu’elle contient zéro routine.
- Les contrôles doivent cohabiter avec `ActiveWorkoutBar`, qui reste un frère flex au-dessus de la
  navigation et ne doit jamais être recouvert par une commande `fixed` ou `sticky` ajoutée à
  Routines.

### 2.2 Articles du Wiki

- `Screen.sub` rend le résumé brut sans marge horizontale ; sur téléphone, le texte touche les
  bords tandis que le reste de l’écran est aligné à 16 px.
- Le bandeau « Non relu » consomme une grande carte avant le premier contenu utile.
- Chaque fiche est une carte flottante avec un rail orange, puis une seconde structure de champs et
  une provenance toujours dépliée. Le document se lit comme une pile de composants plutôt que
  comme un article.
- `Screen` ajoute automatiquement l’aide du tutoriel à toute page. Les routes `/knowledge/*` ne
  possèdent pourtant aucun chapitre : elles retombent sur « Accueil ». Le navigateur de
  développement n’a pas reproduit le crash Android signalé, mais il a confirmé cette aide fausse.

### 2.3 Coach pendant une séance

- La recommandation vit au bon endroit : dans la carte de l’exercice qu’elle concerne, avant la
  grille de saisie.
- Une charge proposée est appliquée en touchant toute la lecture. Le seul signe de cette action est
  un chevron ; le geste est trop implicite pour une écriture sur toutes les séries restantes.
- « Ignorer » est une cible de 48 px, mais la décision principale et la décision secondaire ne
  forment pas un groupe d’actions lisible.
- Les observations sans charge — plateau, repos long, chute de répétitions — partagent la même
  coque qu’un objectif applicable alors qu’elles ne déclenchent aucune écriture.

## 3. Direction visuelle

### 3.1 Identité conservée

- Police : pile système `--font-sans` existante.
- Fonds : `--surface-0`, `--surface-1`, `--surface-2`.
- Texte : `--text-1`, `--text-2` ; `--text-3` reste exclu des informations utiles.
- Accent : réservé à une sélection ou à une action engagée, jamais à la décoration.
- Chiffres de charge : `record-figure`, car ils décrivent ce qu’il faut charger sur la barre.
- Mouvement : `--dur-1` et `--dur-2`, uniquement pour signaler un état.

Aucune nouvelle couleur, police, ombre, bordure décorative ou animation de page n’est ajoutée.

### 3.2 Signature

La signature de cette reprise est une **lecture qui devient action seulement à l’endroit exact où
une décision est possible** : les sources se dévoilent, les dossiers se replient et la charge du
coach s’applique. Les éléments statiques ne miment pas des commandes.

## 4. Routines

### 4.1 Barre d’outils compacte

Sous `PlanningTabs`, une seule ligne de 48 px porte :

```text
10 routines                          [verrou] [tout replier]
```

- le compteur quitte l’en-tête et rejoint la liste qu’il décrit ;
- `OrderLockButton` est conservé sans variante locale ;
- la commande globale réutilise exactement `CollapseAllIcon` / `ExpandAllIcon` et le traitement de
  `WorkoutScreen` ;
- chaque bouton expose son libellé complet par `aria-label` ;
- la ligne reste dans le contenu défilant. Elle ne concurrence ni `ActiveWorkoutBar` ni la barre de
  navigation.

### 4.2 Dossiers

Chaque en-tête conserve sa cible unique de 48 px et reçoit un `ChevronDownIcon` :

```text
⌄ PPL                                      6   ⋮
```

Le chevron tourne avec `aria-expanded`. Le menu du dossier reste une cible séparée. Pendant le
réordonnancement, l’en-tête reste visuellement présent mais son repli est désactivé conformément au
contrat existant.

La racine « Sans dossier » n’existe dans la projection que si elle contient au moins une routine.
Elle n’entre donc ni dans la commande globale de repli ni dans les états accessibles lorsqu’elle
est vide.

### 4.3 Routines et réordonnancement

Les cartes de routine, les menus et le `ReorderableList` restent structurellement inchangés dans
cette tranche. Une conversion complète vers `Card` + `ListRow` compliquerait le déplacement entre
dossiers sans répondre aux défauts signalés. Le design supprime d’abord les contrôles étrangers au
système et le faux groupe vide.

## 5. Wiki et Guide

### 5.1 En-tête de lecture

Le résumé d’article reçoit le même inset horizontal de 16 px que le corps et un espace inférieur
explicite. Il reste sous le titre, sans devenir une seconde carte.

Le bandeau de revue devient une note compacte :

```text
Non relu · Cette matière n’a pas encore été vérifiée ligne par ligne.
```

Le statut reste visible au premier écran. La précision sur la validation scientifique demeure,
mais elle ne prend plus la hauteur d’un bloc de contenu complet.

### 5.2 Corps de l’article

- La prose éditoriale reste sur le fond de page avec une largeur et un interlignage de lecture.
- Les fiches consécutives d’une même section forment une seule surface avec séparateurs, plutôt
  qu’une succession d’îlots arrondis.
- Le rail orange latéral disparaît : la provenance est portée par le contenu et non par une
  décoration répétée.
- Les intitulés de champs, valeurs et distinctions entre fiche et prose sont conservés.
- Les identifiants de provenance passent dans un `<details>` intitulé « Sources ». Ils restent dans
  le DOM, accessibles au clavier et consultables hors ligne.

La réduction visuelle ne supprime aucun `claimId`, `rowId`, texte canonique ni état de revue.

### 5.3 Tutoriel

`Screen` reçoit un contrat explicite permettant de ne pas rendre l’aide contextuelle. Toutes les
pages de `src/features/knowledge/` qui utilisent `Screen` le désactivent.

Le tutoriel reste présent sur Routines, Programmes, séance, historique, progression, exercices et
réglages. Aucun chapitre Wiki factice n’est ajouté : le Wiki doit être compréhensible par sa propre
navigation.

## 6. Coach pendant une séance

### 6.1 Objectif avec charge

Une recommandation numérique conserve la charge comme lecture principale, mais la carte entière
n’est plus un bouton :

```text
Objectif proposé
52,5 kg
47,5 → 52,5 kg car 4 × 10 a atteint le haut de la fourchette.

[ Appliquer 52,5 kg ]   [ Ignorer ]
```

- `Appliquer … kg` est un `Button` primaire de 48 px minimum ;
- `Ignorer` est un `Button` fantôme de 48 px minimum ;
- les deux boutons restent utilisables à 320 px sans couper leur libellé ;
- seule l’action primaire appelle `applyCoachObjective`, puis marque la recommandation suivie ;
- aucune touche sur la prose, la charge ou le chevron ne modifie les séries.

L’action explicite évite une écriture accidentelle tout en restant à un pouce de la grille qu’elle
prépare.

### 6.2 Observation sans charge

Une observation ne montre ni fausse métrique ni bouton Appliquer :

```text
Observation du coach
Baisse de reps observée : 10 puis 7 (−3).

                                              [ Masquer ]
```

Le bouton secondaire clôt seulement cette lecture selon la sémantique repository existante. Le
registre visuel reste plus calme qu’un objectif : pas de remplissage accent, pas de chevron, pas de
promesse d’action.

### 6.3 États et retour immédiat

- Pendant l’application, le bouton est désactivé pour empêcher un double tap.
- Après succès, la recommandation quitte `pending` et disparaît via `useLiveQuery` ; les champs des
  séries restantes reflètent la nouvelle charge.
- En cas d’échec repository, la recommandation reste visible et aucune confirmation mensongère
  n’est affichée.
- Les recommandations appartenant à un programme continuent de suivre la règle existante : les
  objectifs numériques sont filtrés, les observations restent possibles.

## 7. Accessibilité et interaction

- Toutes les cibles tactiles mesurent au moins 48 × 48 px.
- Le chevron de dossier ne porte jamais seul le sens : `aria-expanded` reste la source accessible.
- Les commandes d’icône possèdent un `aria-label` français.
- Le `<details>` de provenance utilise la sémantique native et un focus visible.
- Le coach ne dépend ni de la couleur ni d’un chevron pour annoncer une écriture.
- Le contraste continue de reposer sur les paires mesurées dans `src/index.css`.
- `prefers-reduced-motion` neutralise la rotation et les transitions conformément à la règle
  globale.

## 8. Hors périmètre

- Nouvelle palette, nouvelle typographie ou refonte générale de la navigation.
- Modification des règles du coach, des seuils ou du texte scientifique.
- Changement de la persistance des dossiers ou du verrou.
- Suppression de la recherche globale du Wiki.
- Conversion complète de la bibliothèque vers un autre moteur de glisser-déposer.
- Correction spéculative d’un crash Android non reproduit au-delà de la suppression du déclencheur
  Wiki devenu inutile.

Le nettoyage technique déjà décidé reste inclus : `wikiDocuments`, la construction documentaire
associée et ses tests propres disparaissent ; `wikiSections` cesse d’être exporté mais reste le
tableau interne qui alimente `findWikiSection` et `findSectionIdForClaim`.

## 9. Stratégie de tests

Les changements de comportement sont menés en TDD :

1. `Screen` peut masquer l’aide et les pages Wiki n’exposent plus « Aide sur cette page ».
2. Une racine vide n’est ni rendue ni comptée parmi les dossiers repliables.
3. Les dossiers conservent `aria-expanded` et leur commande globale utilise les libellés existants.
4. Les sources restent présentes et consultables dans un disclosure fermé par défaut.
5. Un objectif coach n’applique rien quand on touche sa prose ; seul le bouton explicite applique
   la charge.
6. Une observation sans charge ne rend aucun bouton Appliquer.
7. Les actions coach conservent les transitions `pending` → `followed` / `dismissed` existantes.

Vérifications finales :

```text
npm run lint
npm run typecheck
npm run test:run
npm run build
git diff --check
```

## 10. Checkpoints téléphone

1. Avec des dossiers et zéro routine racine, vérifier que « Sans dossier » n’apparaît pas.
2. Replier un dossier, tout replier, déverrouiller, déplacer puis reverrouiller ; aucun contrôle ne
   descend sous la barre « Reprendre la séance ».
3. Ouvrir un article Guide : résumé aligné, statut visible, première affirmation accessible sans
   grand écran d’avertissement et aucune aide `?`.
4. Ouvrir puis refermer les sources d’une fiche hors ligne ; les identifiants restent lisibles.
5. Pendant une séance, appliquer une charge proposée : un seul tap explicite met à jour uniquement
   les séries restantes et la recommandation disparaît.
6. Pendant une séance, masquer une observation sans charge : aucune valeur de série ne change.
7. Vérifier les mêmes parcours à 320 px et avec le thème clair.

## 11. Critères d’acceptation

La reprise est terminée lorsque :

- Routines réutilise les contrôles de la séance et ne montre aucun groupe vide ;
- la barre de reprise et la navigation ne recouvrent aucun contenu ;
- le Wiki se lit comme un document, conserve toute sa traçabilité et ne propose plus de tutoriel ;
- une action coach qui écrit dans la séance est toujours nommée explicitement ;
- une observation sans charge ne ressemble pas à un objectif applicable ;
- les tests, le typecheck, le lint et le build passent ;
- les checkpoints téléphone sont consignés dans `PROGRESS.md`.
