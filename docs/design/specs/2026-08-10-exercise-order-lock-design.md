# Verrouillage du réordonnancement des exercices

**Date :** 2026-08-10

**Statut :** design validé

**Périmètre :** éditeur de routine et séance en cours

## Objectif

Éviter les déplacements accidentels d’exercices sur mobile sans retirer la possibilité de les
réordonner volontairement. Chaque écran commence verrouillé et expose un cadenas tactile permettant
d’autoriser ou d’interdire le réordonnancement à volonté.

Le verrou concerne uniquement l’ordre des exercices. Il ne bloque ni leur édition, ni leur ajout,
ni leur suppression, ni les autres actions d’une routine ou d’une séance.

## Comportement utilisateur

L’éditeur de routine et la séance en cours possèdent deux verrous indépendants :

- les deux sont fermés au lancement de l’application ;
- toucher un cadenas fermé déverrouille uniquement l’écran correspondant ;
- toucher un cadenas ouvert reverrouille uniquement l’écran correspondant ;
- l’état reste en mémoire pendant toute la session de l’application, y compris après une navigation
  vers un autre écran ;
- fermer complètement puis relancer l’application remet les deux verrous à l’état fermé.

Quand un écran est verrouillé, ses poignées de déplacement sont entièrement masquées et ni un geste
tactile ni les flèches du clavier ne peuvent réordonner les exercices. Quand il est déverrouillé, les
poignées réapparaissent et le fonctionnement actuel du glisser-déposer reste inchangé.

## Placement et représentation

Dans la séance en cours, le cadenas se place dans la barre d’avancement immédiatement après le
contrôle « 80 % ». Dans l’éditeur de routine, il se place après le résumé « X exercices · Y séries »,
au-dessus de la liste qu’il contrôle.

Deux SVG distincts représentent les états :

- un cadenas fermé lorsque le réordonnancement est bloqué ;
- un cadenas ouvert lorsque le réordonnancement est autorisé.

Les SVG sont décoratifs. Le bouton porte le sens et expose un libellé accessible dépendant de l’état :

- « Déverrouiller l’ordre des exercices » lorsque le verrou est fermé ;
- « Verrouiller l’ordre des exercices » lorsque le verrou est ouvert.

Le bouton conserve une cible tactile de 48 × 48 px. L’état reste compréhensible sans dépendre de la
couleur.

## Architecture

Un store Zustand non persisté conserve deux booléens indépendants, un pour l’éditeur de routine et un
pour la séance en cours. Ce choix permet de conserver l’état lors des remontages et des navigations
internes tout en obtenant gratuitement le retour à l’état verrouillé après un véritable redémarrage.
Dexie ne stocke rien et aucune migration de données n’est nécessaire.

Le composant partagé `ReorderableList` reçoit une option de désactivation. Une liste désactivée
n’installe aucun comportement capable de démarrer ou de valider un déplacement, par pointeur comme au
clavier. Cette protection fonctionnelle reste la source de vérité ; masquer les poignées dans les
cartes n’est que sa représentation visuelle.

Les cartes d’exercice de routine et de séance reçoivent explicitement l’autorisation de réordonner.
Elles rendent la poignée uniquement lorsque cette autorisation est active. Un bouton de verrou partagé
et les deux icônes SVG évitent de dupliquer le comportement ou les règles d’accessibilité entre les
deux écrans.

Le changement d’état d’un verrou ne déclenche aucune écriture de routine, de séance ou d’ordre. Les
repositories de réordonnancement existants ne sont appelés qu’après un déplacement autorisé et
effectivement terminé.

## États limites

- Une liste vide ou réduite à un exercice peut afficher le cadenas à son emplacement habituel ; le
  bouton reste cohérent et n’introduit aucun cas particulier dans les données.
- Verrouiller pendant qu’aucun déplacement n’est actif est synchrone et immédiat. Le bouton ne doit
  pas être rendu actionnable pendant un geste déjà capturé ; l’interface actuelle ne permet pas de
  toucher simultanément le cadenas et une poignée avec le même pointeur.
- Les deux états du store doivent être réinitialisables explicitement dans les tests afin d’éviter une
  fuite entre scénarios.

## Vérification

Les tests du store couvrent l’état fermé initial, les bascules indépendantes, la conservation pendant
un remontage de composant et la réinitialisation équivalente à un nouveau lancement.

Les tests de `ReorderableList` vérifient qu’une liste désactivée ignore les gestes de pointeur et les
flèches du clavier, puis que le comportement actuel fonctionne toujours après activation.

Les tests d’intégration de l’éditeur de routine et de la séance vérifient :

- le cadenas fermé et l’absence de poignées au premier rendu ;
- les libellés accessibles des deux états ;
- l’apparition des poignées après déverrouillage ;
- la disparition des poignées après reverrouillage ;
- l’indépendance entre le verrou de routine et celui de séance ;
- le réordonnancement persistant uniquement lorsqu’il est autorisé.

Le checkpoint manuel se fait au doigt sur téléphone : ouvrir une routine puis une séance, confirmer
qu’aucun exercice ne bouge par défaut, déverrouiller chaque écran séparément, déplacer un exercice,
reverrouiller, puis relancer complètement l’application et constater que les deux cadenas sont fermés.

## Hors périmètre

- Verrouiller l’édition, l’ajout ou la suppression d’exercices.
- Persister le choix après un redémarrage de l’application.
- Partager un seul état entre routine et séance.
- Modifier les règles métier de calcul du tonnage des exercices au poids du corps ; ce sujet fera
  l’objet d’un design séparé.
