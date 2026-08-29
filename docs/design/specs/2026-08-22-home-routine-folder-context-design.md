# Contexte de dossier pour la suggestion de séance

## Problème

L'accueil suggère aujourd'hui la routine réalisée le moins récemment parmi toutes les routines.
Dès que les routines sont rangées dans plusieurs dossiers, ce choix global ne sait plus quel
ensemble l'utilisateur veut suivre. Le rangement existe dans la bibliothèque, mais disparaît au
moment de lancer une séance.

## Décision

L'accueil mémorise un **contexte de routines actif** : l'identifiant d'un dossier, ou la racine
« Sans dossier ». La suggestion actuelle reste le héros de la carte, mais elle est calculée
uniquement parmi les routines de ce contexte.

Le choix est local, persistant entre les ouvertures de l'app et modifié seulement par une action
explicite de l'utilisateur. Il ne dépend ni de la dernière séance réalisée ni du réseau.

## Parcours

### Aucun dossier

Le comportement actuel reste inchangé : la carte suggère la routine la moins récente parmi toutes
les routines. Aucun sélecteur de dossier n'est imposé à une bibliothèque qui n'en utilise pas.

### Des dossiers existent, aucun contexte n'a encore été choisi

La carte demande de choisir un contexte avant d'afficher une suggestion. Le sélecteur présente :

- chaque dossier existant, dans l'ordre de la bibliothèque ;
- « Sans dossier » si au moins une routine se trouve à la racine.

Le choix est enregistré immédiatement. Fermer le sélecteur sans choisir ne crée aucun choix
implicite.

### Un contexte valide est mémorisé

La carte affiche le nom du contexte et suggère la routine réalisée le moins récemment parmi les
routines qu'il contient. Les règles actuelles de classement et d'explication restent inchangées.

Une action compacte en haut à droite de la carte ouvre le sélecteur de contexte. Elle utilise une
icône de dossier/changement, pas un signe `+` isolé, qui signifierait « créer ». Son libellé
accessible est « Changer de dossier ».

### Contexte vide ou supprimé

Un dossier valide mais vide reste le contexte choisi. La carte indique qu'il ne contient aucune
routine et propose de changer de dossier ; elle ne pioche jamais silencieusement dans un autre
dossier.

Si le dossier mémorisé a été supprimé, le choix est considéré comme invalide et l'accueil demande
un nouveau contexte. Une routine à la racine reste accessible via « Sans dossier ».

### Programme actif

Un programme actif reste prioritaire sur la suggestion libre. Le contexte de dossier n'altère ni
son calcul ni son affichage et reste mémorisé pour le retour au mode sans programme.

## Architecture

### Persistance

Le contexte est stocké dans les réglages locaux existants sous une clé dédiée. Sa valeur distingue
explicitement :

- aucun choix encore effectué ;
- un identifiant de dossier ;
- la racine « Sans dossier ».

Cette distinction évite de confondre la racine choisie volontairement avec l'absence de choix.

### Projection de l'accueil

Le repository de l'accueil lit, dans sa projection unique :

- les dossiers vivants ;
- les routines et leur `folderId` ;
- le contexte mémorisé.

Il valide le contexte, filtre les routines concernées, puis réutilise `pickSuggestedRoutine` sans
dupliquer sa règle. La projection rend au composant les options de contexte, le contexte actif et
la suggestion déjà limitée à ce contexte. Le composant ne lit jamais la base directement et ne
reclasse rien.

### Interface

`HomeSuggestionCard` reste responsable de la carte et de son état vide. Un sélecteur dédié affiche
les dossiers et « Sans dossier », puis persiste le choix via le repository de réglages. Les textes
français sont ajoutés à `src/i18n/fr.ts`.

## Erreurs

Une erreur de lecture suit l'état d'erreur existant de l'accueil. Une erreur d'enregistrement du
contexte laisse le sélecteur ouvert et affiche un message explicite ; l'interface ne prétend pas
avoir changé de dossier tant que l'écriture locale n'a pas réussi.

## Vérification

Les tests couvrent au minimum :

- le comportement global inchangé quand aucun dossier n'existe ;
- le premier choix parmi dossiers et « Sans dossier » ;
- la persistance du contexte ;
- une suggestion limitée au dossier choisi ;
- un dossier vide sans repli silencieux ;
- un dossier supprimé qui invalide le choix ;
- la priorité inchangée d'un programme actif ;
- le libellé accessible de l'action de changement.

Le checkpoint téléphone vérifie le premier choix, le changement de dossier depuis la carte, la
survie du choix après fermeture/réouverture et le cas « Sans dossier ».
