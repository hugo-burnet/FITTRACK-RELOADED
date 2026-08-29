# Filtres du sélecteur d’exercices Hevy

## Objectif

Ajouter les filtres **Muscle** et **Matériel** à la fenêtre de choix manuel d’un
exercice pendant l’import Hevy.

## Comportement

- La recherche textuelle, le muscle et le matériel se combinent.
- La liste conserve sa contrainte actuelle sur le type de mesure de l’exercice
  Hevy (poids/répétitions, durée ou distance).
- Les puces et feuilles de sélection existantes sont réutilisées.
- Recherche et filtres sont remis à zéro après fermeture ou validation afin que
  chaque nouvelle association commence avec la liste complète.
- La suggestion automatique et la création d’un exercice personnalisé ne
  changent pas.

## Implémentation et validation

L’état des deux filtres reste local à `HevyExerciseMappingSheet`. Une fonction
pure filtrera le catalogue chargé en mémoire afin de tester indépendamment la
combinaison recherche, muscle, matériel et type de mesure. Des tests de composant
vérifieront aussi l’ouverture des deux sélecteurs et la remise à zéro.

