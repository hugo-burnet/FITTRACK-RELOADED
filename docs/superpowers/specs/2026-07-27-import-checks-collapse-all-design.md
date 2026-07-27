# Import Hevy — coches de validation et commande « Tout replier »

**Date :** 2026-07-27  
**Statut :** design validé oralement, en attente de validation du document

## Objectif

Rendre deux états immédiatement lisibles sur mobile :

1. dans l’import Hevy, distinguer les associations encore à valider de celles déjà confirmées,
   même après un long défilement ;
2. dans une séance active, replier toutes les cartes d’exercice en un geste sans ajouter de
   libellé visible dans l’interface.

Le correctif couvre aussi le retour signalé sur l’action finale « Importer », qui peut sembler
inerte : le diagnostic doit identifier la cause réelle, puis chaque état de l’opération doit
devenir visible.

## 1. Associations Hevy cochées

### Source de vérité

`HevyMappingDraftRow.resolution` reste l’unique source de vérité :

- `undefined` : association non validée ;
- résolution `existing` ou `custom` : association validée ;
- `resolutionSource: 'saved'` : association validée lors d’un import précédent.

Aucun nouvel état parallèle de type `checked` n’est ajouté. La coche ne peut donc jamais diverger
du choix réellement transmis au repository.

### Rendu d’une ligne

Chaque ligne conserve son nom Hevy, son sous-texte et son ouverture vers la feuille de choix.
La zone droite contient :

- un cercle vide neutre lorsque `resolution` est absente ;
- un cercle coché en `--accent-ink` lorsque `resolution` existe ;
- le chevron existant, afin que la ligne reste clairement modifiable.

Une association mémorisée est précochée dès l’ouverture. Une proposition reste décochée tant que
l’utilisateur ne l’a pas explicitement choisie. Choisir une proposition, un autre exercice ou une
création personnalisée coche immédiatement la ligne. Rouvrir une ligne cochée permet de remplacer
le choix sans étape de décochage séparée.

Le texte « Association mémorisée » ou « Associé » reste présent : la couleur et le pictogramme ne
portent jamais seuls l’information. Le cercle et le chevron sont décoratifs pour les technologies
d’assistance ; le bouton de ligne conserve un nom accessible complet.

### Progression

Le compteur « associations restantes » continue de dériver des lignes sans résolution.
« Continuer » reste désactivé tant qu’au moins une ligne est décochée. Aucun bouton « Tout
confirmer » n’est ajouté.

## 2. Action finale « Importer »

Le clic doit produire immédiatement un état observable :

1. passage à `importing` ;
2. libellé de barre « Import en cours… » et action désactivée ;
3. résultat « Import terminé » avec les compteurs, ou retour à la revue avec une erreur visible.

Avant toute correction, le comportement signalé doit être reproduit dans la version publiée ou
avec le même parcours local. Le diagnostic vérifie notamment :

- l’appel effectif du handler ;
- la transition d’état React ;
- le rejet éventuel de la transaction Dexie ;
- la visibilité de l’erreur au niveau de défilement courant.

Si l’import échoue, l’erreur doit être annoncée par `role="alert"` et rester visible près de
l’action ou être amenée dans la vue. Les associations choisies sont conservées. Aucun contournement
ne doit masquer un rejet du repository.

## 3. « Tout replier » dans la séance active

### Emplacement

La commande vit à droite de la ligne d’avancement épinglée sous l’en-tête (`x séries sur y`).
Elle reste donc visible pendant le défilement et ne concurrence ni le titre, ni le chronomètre,
ni le menu `⋯` sur 375 px.

La commande :

- est un bouton carré d’au moins 48 × 48 px ;
- n’affiche aucun texte ;
- possède le libellé accessible français « Tout replier » ;
- utilise une nouvelle icône SVG `CollapseAllIcon`, composée de deux panneaux/chevrons qui se
  rapprochent verticalement.

Elle n’apparaît pas lorsque la séance ne contient aucun exercice.

### Comportement

`WorkoutScreen` émet un signal de repli à chaque appui. Chaque `WorkoutExerciseCard` reçoit ce
signal et passe à l’état replié, qu’elle soit terminée ou non.

Le signal ne remplace pas les règles existantes :

- une carte peut être rouverte individuellement juste après ;
- terminer la dernière série continue de replier automatiquement la carte ;
- décocher ou ajouter une série continue de rouvrir automatiquement l’exercice concerné ;
- le réordonnancement, les supersets, le repos et les records ne changent pas.

Le signal est monotone et éphémère ; aucune préférence n’est stockée en base.

## 4. Fichiers et limites

Fichiers d’interface concernés :

- `src/features/history/HevyImportMappingStep.tsx`
- `src/features/history/HevyImportScreen.tsx`
- `src/features/workout/WorkoutScreen.tsx`
- `src/features/workout/WorkoutExerciseCard.tsx`
- `src/ui/icons.tsx`
- `src/i18n/fr.ts`

Le repository Hevy n’est modifié que si le diagnostic de l’action « Importer » y révèle la cause.
Aucun changement de schéma IndexedDB, aucune migration et aucun quota ne sont introduits.

## 5. Vérification

### Import Hevy

- charger un export avec plusieurs associations non mémorisées ;
- vérifier que toutes commencent décochées malgré les propositions ;
- valider des lignes espacées dans la liste et contrôler les coches après défilement aller-retour ;
- réimporter le même fichier et contrôler que les associations mémorisées arrivent précochées ;
- vérifier que « Continuer » reste bloqué jusqu’à la dernière coche ;
- cliquer « Importer » et observer l’état occupé, puis le succès ou l’erreur explicite ;
- vérifier l’absence de doublons à la seconde passe.

### Séance active

- ouvrir une séance avec au moins trois exercices, dont un terminé ;
- ouvrir plusieurs cartes puis utiliser la commande épinglée ;
- vérifier que tous les boutons de carte ont `aria-expanded="false"` ;
- rouvrir une seule carte et vérifier que les autres restent fermées ;
- contrôler la cible de 48 px, l’absence de débordement et la lisibilité à 375 × 812 px.

### Portes projet

`npm run lint`, `npm run typecheck`, `npm run test:run` et `npm run build` doivent passer. Le
checkpoint final est rejoué sur la version GitHub Pages après push.
