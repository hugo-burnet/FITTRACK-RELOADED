# RPE masquable — Design RF-30

## Périmètre

RF-30 ajoute un RPE facultatif à chaque série de la séance en direct. La plage est déjà
figée par l’architecture : de 6 à 10 par pas de 0,5. Le RIR, les objectifs de RPE dans les
routines et le réglage global d’affichage restent hors de cette tâche.

## Sens de « masquable »

- La grille principale ne reçoit ni colonne, ni badge, ni préférence d’affichage RPE.
- La feuille de série garde une entrée « Effort perçu (RPE) » toujours découvrable.
- Cette entrée est repliée par défaut. Son sous-titre indique « Non renseigné » ou la
  valeur courante, par exemple « 8,5 / 10 ».
- Un appui déplie l’échelle dans la même feuille. Fermer la feuille fait disparaître
  l’échelle : l’ouverture est un état local et éphémère.
- La valeur choisie est écrite immédiatement dans `WorkoutSet.rpe`. La case d’effacement
  écrit `undefined`. La préférence de visibilité n’est pas persistée ; le réglage global
  prévu au Lot 8 n’est pas anticipé.

## Interaction et composition

La feuille existante reste le seul point d’entrée de la série :

```text
┌─────────────────────────────┐
│ Série 2                 ×   │
├─────────────────────────────┤
│ Effort perçu (RPE)          │
│ 8,5 / 10                  ▾ │
│                             │
│ [ 6 ] [6,5] [ 7 ] [7,5] [8]│
│ [8,5] [ 9 ] [9,5] [10] [—]│
├─────────────────────────────┤
│ Type de série               │
│ Normale                     │
├─────────────────────────────┤
│ Supprimer la série          │
└─────────────────────────────┘
```

Chaque case mesure au moins 48 px. La valeur sélectionnée est marquée par contraste,
graisse et bordure neutre. L’accent reste réservé aux records et séries validées. La
dixième case efface la valeur et possède un nom accessible explicite.

## Données et erreurs

`WorkoutSet.rpe`, `SetValues` et `updateSetValues` existent déjà. Le composant reçoit la
valeur et un callback `onChange`; il n’accède jamais à Dexie. Les neuf valeurs proposées
empêchent toute valeur hors plage. Si la série disparaît pendant l’animation de fermeture,
la feuille reçoit simplement `undefined` et n’écrit rien.

## Vérification

- Test du composant interactif : état replié, ouverture, choix d’une valeur et effacement.
- Pilotage à 375 px sur `/FITTRACK-RELOADED/`.
- Mesure des dix cibles RPE et des autres actions avec le DOM et `getComputedStyle`.
- Lecture IndexedDB après choix, rechargement, puis effacement.
- `typecheck`, `lint`, `test:run`, `build`.
