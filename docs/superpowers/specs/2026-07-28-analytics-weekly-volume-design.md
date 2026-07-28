# G4 — Volume d’entraînement hebdomadaire

**Date :** 2026-07-28  
**Statut :** design validé  
**Périmètre :** dernier graphique de la première couche d’analyse

---

## 1. La question à laquelle l’écran répond

L’écran montre **combien d’entraînement chaque semaine a réellement porté**,
selon deux lectures :

- le **tonnage**, somme des charges externes réellement soulevées ;
- la **durée**, somme de la durée complète des séances.

Ces deux mesures partagent une structure temporelle : une valeur par semaine,
un zéro réel pour une semaine sans séance, et une comparaison utile avec les
semaines voisines. Elles vivent donc sur un seul écran, derrière un sélecteur de
métrique.

Ce n’est pas une extension de « Séances par semaine ». Le rythme répond
« combien de fois ? » et porte un objectif historique ; le volume répond
« combien au total ? » et ne possède aucun objectif. Mélanger les deux
donnerait au même vert deux contrats différents et rendrait la lecture de
l’objectif ambiguë.

Le titre de l’écran est **« Volume d’entraînement »**. Il est accessible depuis
`Historique → Analyses`, dans la section des relevés globaux.

---

## 2. Périmètre exact des deux métriques

### 2.1 Tonnage

Le tonnage d’une séance est celui de `sessionTotals()`, sans nouvelle formule :

- seules les séries validées entrent dans les sources ;
- les échauffements sont exclus par `sessionTotals()` ;
- seules les charges dont `measurementShape().weightRole` vaut `load` comptent ;
- assistance et lest sont donc exclus ;
- une charge sans répétitions ne produit aucun tonnage ;
- les valeurs décimales restent exactes jusqu’à l’affichage.

Le poids du corps n’est pas inventé. Une séance de tractions au poids du corps
peut avoir un tonnage nul sans être une séance nulle ; l’écran l’explique dans
sa note de métrique.

### 2.2 Durée

La durée est `Workout.durationSeconds`, c’est-à-dire la durée complète enregistrée
à la clôture de la séance. Ce n’est pas la somme des `Set.durationSeconds` :
cette dernière ne décrit que les exercices chronométrés et ferait apparaître
une séance de musculation classique comme une séance de zéro seconde.

Une séance terminée possède toujours cette valeur : elle est requise par
`Workout` et l’import Hevy la calcule avec ses bornes. Il n’existe donc pas
d’état « durée inconnue » à inventer dans G4.

### 2.3 Ce que les métriques ne permettent pas de conclure

Ni le tonnage ni la durée ne sont un score de qualité. Une grande valeur peut
venir d’une séance longue, d’un exercice dont la mécanique autorise une charge
élevée ou simplement d’un changement de programme.

L’écran décrit une charge de travail dans le temps ; il ne félicite pas, ne
signale pas de déficit et ne compare pas des muscles entre eux.

---

## 3. Une seule porte vers l’historique

La lecture reste :

```ts
listExportSources({ kind: 'period', from, to })
```

avec `periodBounds()` pour les bornes, et `all-history` pour « Tout ».

G1, G2 et G3 passent déjà par cette porte. G4 ne crée ni repository ni requête
analytique supplémentaire : séances archivées, lignes vivantes, séries validées
et bornes inclusives/exclusives doivent garder une définition unique.

`listCompletedWorkoutTimestamps()` répond à la même question auxiliaire qu’en
G2 et G3 : l’historique existait-il avant le début de la fenêtre ? Sans cette
information, une fenêtre de douze semaines précédant trois semaines
d’utilisation fabriquerait neuf semaines à zéro.

---

## 4. Agrégation pure

Un module `src/lib/analytics/volume.ts` possède l’agrégation et rien d’autre.
Il reçoit les sources déjà lues et les bornes de période, puis rend des seaux
hebdomadaires :

```ts
interface WeeklyVolumeBucket {
  weekStart: number;
  tonnage: number;
  durationSeconds: number;
}
```

Pour le tonnage, une semaine contenant uniquement des exercices sans charge
externe vaut **0 kg**. Une semaine sans séance à l’intérieur de l’historique
vaut **0 kg** et **0 minute** : ce sont des zéros observés, jamais des données
manquantes.

Les semaines sont construites avec les primitives déjà éprouvées de G2 :
`weekStartOf()` et `addLocalWeeks()`. Une séance du dimanche soir reste dans la
semaine de son propre offset ; les changements d’heure ne sont jamais calculés
par division de millisecondes.

Le module expose aussi des fonctions pures pour extraire les valeurs d’une
métrique et calculer total et moyenne sans dépendre du français.

Les semaines avant le premier historique ne sont pas rendues. Les trous à
l’intérieur de l’historique le sont.

---

## 5. Architecture de l’écran

Nouveaux composants :

- `WeeklyVolumeScreen.tsx` : lecture, période, métrique, sélection et états ;
- `WeeklyVolumeCard.tsx` : relevé, cadran et synthèse ;
- `WeeklyVolumeChart.tsx` : dessin SVG uniquement.

Le routeur ajoute `/analytics/volume` derrière la même frontière `lazy()` que
les autres analyses. La séance en direct ne paie pas le JavaScript de G4.

`AnalyticsScreen` ajoute une seule ligne :

- titre : **Volume d’entraînement** ;
- sous-titre : **Tonnage et durée par semaine**.

La route n’est proposée que lorsqu’un historique terminé existe, comme les
deux autres relevés globaux.

---

## 6. Composition visuelle

La charte du Lot 1 est figée ; G4 ne crée aucun nouveau jeton.

### Couleur

- surfaces : `--surface-1`, `--surface-2` ;
- tracé : `--text-2` ;
- axe et zéro : `--border` ;
- texte principal : `--text-1` ;
- aucun accent dans le graphique.

Une semaine très chargée n’est ni un record à célébrer ni un objectif atteint.
Le maximum reste gris. La sélection est la fente `--surface-2` déjà apprise sur
G2 et ne change jamais la couleur de la barre.

### Typographie

- lecture courante : `.metric`, chiffres tabulaires ;
- unité accolée dans la casse SI correcte (`kg`, jamais `KG`) ;
- dates et axes : texte utilitaire existant ;
- micro-libellés : `.label-xs`.

### Structure

```text
[ 12 semaines ] [ Tonnage ▾ ]

┌──────────────────────────────────┐
│ SEMAINE DU 20 JUILLET   8 420 kg │
│                                  │
│      ▂  ▄  ▆  ▃  █  ▅  ▇  ▂     │
│     4 mai              20 juil.  │
│ ──────────────────────────────── │
│ Total · 82 630 kg                │
│ Moyenne par semaine · 6 886 kg   │
└──────────────────────────────────┘

SEMAINES
20 juillet                8 420 kg
13 juillet                3 180 kg
```

Le premier filtre choisit la période avec `PERIOD_KEYS`. Le second choisit
`Tonnage` ou `Durée` via `OptionSheet`. La métrique sélectionnée survit à un
changement de période ; la semaine sélectionnée revient à la plus récente.

La signature de l’écran est la **bascule de cadran** : les semaines restent aux
mêmes positions tandis que hauteur, unité, lecture et synthèse changent
ensemble. Il n’y a ni animation morphologique ni fondu décoratif ; la transition
d’opacité existante couvre uniquement le temps de relecture Dexie.

---

## 7. Géométrie et interaction

G4 réutilise `ChartSurface` et `barLayout()` :

- une barre part toujours du zéro ;
- le plafond est le maximum observé, avec un minimum technique de 1 ;
- une semaine à zéro reçoit le moignon de 4 px dans `--border` de G2 ;
- la ligne de base est le seul filet ;
- aucune grille ;
- l’appui choisit la semaine la plus proche en x ;
- le SVG reste hors de l’ordre de tabulation.

La sélection est une fente verticale qui franchit la ligne de base. Elle reste
lisible sur une valeur égale à zéro et ne peut pas être prise pour une
quantité.

Le changement de métrique conserve la semaine civile sélectionnée si elle
existe toujours. Le changement de période sélectionne la semaine la plus
récente, car l’index précédent ne désigne plus le même seau.

---

## 8. Lectures et synthèse

Au-dessus du graphique :

- la semaine sélectionnée ;
- sa valeur formatée dans la métrique active.

Sous le graphique :

- total de la période ;
- moyenne par semaine observée.

La moyenne inclut les semaines observées à zéro. Elle ne divise jamais par la
largeur théorique de la période avant le début de l’historique.

Formats :

- tonnage : nombre localisé, au plus une décimale, suivi de `kg` ;
- durée hebdomadaire : format lisible en heures et minutes ;
- moyenne de durée : même format, sans secondes parasites.

Une note propre à chaque métrique fixe son sens :

- tonnage : charges externes, assistance, lest et échauffements exclus ;
- durée : somme des durées complètes des séances.

---

## 9. États limites

### Chargement

Pas de squelette. Comme les autres graphiques, l’ancien cadran reste visible à
opacité réduite pendant une nouvelle lecture.

### Période sans séance

La carte explique qu’aucune séance n’existe sur cette période et propose
« Voir tout l’historique » hors période `all`.

### Tonnage entièrement nul

Le graphique montre les semaines et leurs moignons à zéro. Le texte explique
que les séances de la période ne contiennent aucune charge externe comptable.
Ce n’est pas un état vide : l’app sait que le tonnage vaut zéro.

### Une seule semaine

Une seule colonne garde la largeur d’un emplacement normal et le texte nomme
explicitement l’absence de tendance, comme G2.

---

## 10. Accessibilité

`ChartSurface` porte un résumé lecteur d’écran contenant :

- métrique ;
- nombre de semaines ;
- première et dernière semaine ;
- minimum, maximum et moyenne des valeurs connues.

La liste HTML sous le cadran est la source accessible exhaustive. Chaque ligne
est un bouton de 48 px minimum qui sélectionne la semaine correspondante. Elle
porte chaque zéro ; aucune information n’est accessible uniquement par la forme
ou la couleur.

Le contraste non textuel est mesuré pour les barres, moignons de zéro, marqueurs
fente de sélection et axe contre la carte.

Le graphique fonctionne en thème sombre et clair, à 375 px de large, sans
débordement horizontal.

---

## 11. Tests

### Agrégation, en TDD

Les tests de `volume.ts` couvrent :

- plusieurs séances de la même semaine additionnées ;
- tonnage calculé par la règle existante, assistance, lest et échauffements
  exclus ;
- durée prise sur `Workout.durationSeconds`, pas sur les séries ;
- semaine sans séance après le début de l’historique → zéro ;
- semaines avant le premier historique absentes ;
- trou interne conservé ;
- dimanche soir et offset historique ;
- passage heure d’été / heure d’hiver ;
- tonnage nul conservé comme un zéro réel ;
- total et moyenne incluant les semaines à zéro ;
- période `all`.

### Composants

Les composants de dessin restent couverts par le parcours Playwright, selon la
règle du projet. Le checkpoint piloté vérifie :

- les deux métriques sur les mêmes semaines ;
- sélection par appui, y compris une semaine à zéro ;
- changement de période ;
- semaine de tonnage nul ;
- liste et graphique concordants ;
- aucune couleur d’accent ;
- résumé accessible ;
- cibles tactiles, contraste et débordement.

Avant livraison : `lint`, `typecheck`, `test:run` et `build`.

---

## 12. Hors périmètre

- tonnage par muscle : G3 porte déjà la répartition et des kilos de squat ne
  sont pas comparables à des kilos de mollets ;
- durée par muscle : une durée de séance ne peut pas être répartie honnêtement
  entre ses exercices ;
- objectif de tonnage ou de durée ;
- score, recommandation, alerte de surentraînement ou jugement de qualité ;
- 1RM estimé, carte corporelle, rapport mensuel et export PNG ;
- nouvelle bibliothèque de graphiques ;
- refonte de G1, G2 ou G3.
