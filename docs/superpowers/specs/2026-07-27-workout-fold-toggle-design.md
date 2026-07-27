# Bascule globale des cartes de séance

**Date :** 2026-07-27  
**Statut :** validé — autonomie donnée par l’utilisateur

## Problème

La commande livrée sous le libellé accessible « Tout replier » est à sens unique :
elle émet un signal monotone que chaque carte interprète uniquement comme une fermeture.
Un second appui ne peut donc pas rouvrir les cartes. Son pictogramme, composé de panneaux
et de chevrons, se lit en outre comme un sablier.

## Approches considérées

1. **Bascule pilotée par le parent — retenue.** `WorkoutScreen` alterne une commande
   explicite `collapsed` / `expanded`. Chaque carte applique la cible reçue. Le bouton
   affiche toujours l’action disponible.
2. **Remonter l’état de chaque carte.** Le parent saurait si toutes les cartes sont
   ouvertes ou fermées, mais chaque ouverture manuelle devrait remonter dans l’arbre.
   Ce couplage n’apporte rien au geste global.
3. **Deux boutons séparés.** Le comportement serait explicite, mais deux cibles de 48 px
   encombreraient la ligne d’avancement sur 375 px.

## Comportement retenu

- À l’ouverture d’une séance, la commande propose **Tout replier**.
- Un appui replie toutes les cartes et transforme la même commande en
  **Tout déplier**.
- L’appui suivant déplie toutes les cartes et rétablit **Tout replier**.
- Une carte reste ouvrable ou refermable individuellement entre deux commandes globales.
  Cela ne change pas le prochain geste global : il reste l’inverse de la dernière
  commande de masse.
- Les règles existantes restent prioritaires lors d’un changement métier :
  terminer la dernière série replie la carte ; décocher ou ajouter une série la rouvre.
- L’état reste éphémère et n’est jamais écrit en base.

## Icônes et accessibilité

Le contrôle conserve sa cible carrée de 48 × 48 px et n’affiche aucun texte.

- **Tout replier :** une liste miniature de cartes accompagnée d’un chevron haut.
- **Tout déplier :** la même liste accompagnée d’un chevron bas.

Le pictogramme reprend ainsi le vocabulaire liste + chevron déjà appris sur les cartes,
sans silhouette de sablier ni croix involontaire.
Le `aria-label` correspond toujours à l’action disponible et change en même temps
que le pictogramme.

## Architecture

`WorkoutScreen` conserve une commande globale versionnée :

```ts
type FoldCommand = {
  version: number;
  expanded: boolean;
};
```

Chaque appui inverse `expanded` et incrémente `version`. `WorkoutExerciseCard` mémorise
la dernière version appliquée ; lorsqu’elle change, la carte prend exactement la valeur
`expanded` de la commande. La version garantit qu’une nouvelle commande reste observable
même si la cible est identique à l’état local d’une carte.

## Vérification

- test unitaire du réducteur pur de commande : replier puis déplier ;
- test unitaire de la décision appliquée par une carte lorsqu’une nouvelle version arrive ;
- contrôle navigateur en 375 × 812 px avec trois cartes :
  toutes ouvertes → toutes repliées → toutes dépliées ;
- contrôle des deux libellés accessibles, des deux SVG, de la cible 48 × 48 px et de
  l’absence de débordement horizontal ;
- `typecheck`, `lint`, `test:run` et `build`.
