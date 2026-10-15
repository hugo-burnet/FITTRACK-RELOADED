# Mensurations — Design

**Date :** 2026-10-14
**Statut :** décisions prises en autonomie (« corrige tout en autonomie »), à relire
**Périmètre :** RF-37 (mesures corporelles autres que le poids, champs personnalisés), RF-38 (la courbe
de chaque mesure) et la saisie rétroactive (recommandation M7 de l'audit). **Hors périmètre :** les
photos (RF-39), Health Connect (RF-40) — cf. la décision du 2026-08-11, qui les a reportées.

## Objectif

Le Lot 11 a été scindé le 2026-08-11 : les photos sortent, **les mesures restent**. Seul le poids de
corps a été livré, par la tuile de l'accueil, et il n'a ni courbe ni saisie datée. Le schéma n'attend
que du câblage : `BodyMeasurement.type` est une chaîne libre, `[type+measuredAt]` est indexé,
`measuredAt` accepte une date passée et la sauvegarde valide déjà la table.

Livrable : un écran **Mensurations** sous Progression (pas de sixième onglet, cf. §12.1), où l'on saisit
une mesure à n'importe quelle date et où l'on lit sa courbe.

Checkpoint de la feuille de route : « tu saisis ton poids sur 5 dates, le graphique se dessine ».

## Décisions structurantes

### 1. Un catalogue court, et des champs libres

Quinze mesures prédéfinies : poids de corps (kg), masse grasse (%), puis en centimètres le cou, les
épaules, la poitrine, la taille, les hanches, et **à gauche et à droite** le biceps, l'avant-bras, la
cuisse et le mollet. Les paires existent parce qu'une asymétrie est ce qu'un pratiquant cherche à voir.

Un champ personnalisé a un nom (40 caractères, espaces normalisés) et une unité parmi **cm, kg, %**.
Il est rangé sous `type = "custom:<nom>"` : le préfixe empêche une mesure libre nommée `body_weight`
de se faire passer pour le poids (qui, lui, touche aux records, cf. §3) et dit sans ambiguïté ce qui
est du catalogue. Le nom n'est jamais traduit ; il s'affiche tel qu'il a été saisi.

Chaque ligne **garde son unité** (`unit`) : l'affichage lit la ligne, pas le catalogue. Le catalogue
peut évoluer sans réécrire l'historique.

### 2. Une mesure par type et par jour local

La règle du poids, généralisée : saisir un type à un jour qui en porte déjà une **remplace sa valeur**
et garde son instant, plutôt que d'empiler des doublons à chaque correction. La feuille le dit
(« Une mesure existe déjà ce jour-là : elle sera remplacée ») avant l'enregistrement, pas après.

### 3. Le poids reste le poids

Le poids de corps nourrit le tonnage des exercices au poids du corps et les records qui en dérivent
(spec du 2026-08-10). Il passe donc **toujours** par `saveBodyWeight` — ajout, correction, saisie
rétrodatée — et sa suppression par un nouveau `deleteBodyWeight`, qui réconcilie les records des
séances de l'intervalle que la mesure couvrait (la séance qui précède la première mesure lit la
première valeur connue : la supprimer la fait lire la suivante). Les autres types n'ont aucun effet
sur les records : un dépôt plus simple (`measurements.ts`) les écrit.

Les deux dépôts se rejoignent à un seul endroit : `saveMeasurement` / `deleteMeasurement` aiguillent
`body_weight` vers le dépôt du poids.

### 4. La date

Un `<input type="date">` natif (le sélecteur d'Android vaut mieux que celui qu'on écrirait), plafonné
à aujourd'hui : on ne mesure pas demain. **Aujourd'hui** s'enregistre à l'instant présent — c'est ce que
fait déjà la tuile de l'accueil, au bit près. **Un autre jour** s'enregistre au **début de ce jour
local** : le poids du 3 octobre vaut pour toutes les séances du 3, pas seulement celles d'après midi.

### 5. Une valeur plausible

Une faute de frappe (825 cm de tour de taille) ne doit pas écraser l'échelle de la courbe pour toujours.
Plausible : pourcentage dans ]0 ; 100[, centimètres dans ]0 ; 300], kilogrammes dans ]0 ; 1 000]. Hors de
ces bornes, le bouton reste désactivé et une ligne dit pourquoi. Le **poids de corps garde la règle
de la spec du 2026-08-10** (« aucun maximum arbitraire ») : tout nombre fini strictement positif.

### 6. La courbe

`ChartSurface` (l'SVG, l'accessibilité, le geste) est réutilisé tel quel ; ce qui change est la
géométrie. Les séances d'un exercice sont des événements qu'on compte, donc espacés également. **Des
mesures sont des relevés dans le temps, et un trou de trois semaines doit se voir** : `plotTimedPoints`
place chaque point à l'abscisse de sa date. L'échelle verticale reste celle de `plotBounds` — bornée
par les données, minimum et maximum gravés aux deux bouts.

**Aucun point n'est « le record »** : un tour de taille plus petit n'est pas meilleur qu'un tour de bras
plus grand, et colorer un extrême ferait dire à l'écran un jugement qu'il n'a pas à porter. Le point
touché porte l'anneau de sélection, rien d'autre.

### 7. Les écrans

- `/analytics/measurements` : les mesures suivies (valeur la plus récente, date, écart avec la
  précédente), un bouton **Ajouter une mesure**, un état vide qui dit comment commencer. Entrée : une
  ligne « Mensurations » dans la vue d'ensemble de Progression, inconditionnelle comme les records.
- `/analytics/measurements/:type` : la valeur, sa date, la courbe, l'écart sur la période, le filtre de
  période (celui des autres courbes, `all` par défaut), l'historique. Toucher une ligne propose
  **Corriger** (la feuille de saisie, à cette date) et **Supprimer** (une confirmation). Le type est
  encodé dans l'URL (`encodeURIComponent`) : un nom libre contient des espaces.
- La feuille de saisie : le type (un sélecteur, ou figé quand on vient d'une fiche), la valeur
  (`NumberInput`, sans ±), la date. Le nom et l'unité d'un champ libre n'apparaissent que si on le choisit.

Le bouton retour d'Android remonte d'un cran, comme partout.

## Ce qui ne change pas

- Le schéma Dexie (aucune `version()`), les index, la validation de la sauvegarde.
- La tuile et la feuille du poids sur l'accueil.
- `resolveBodyWeightsAt`, `getLatestBodyWeight`, et la règle « un jour = une mesure ».

## Tests attendus

### Logique pure (TDD)

- catalogue : quinze types, unités attendues, aucun doublon de clé ; `custom:` reconnu ;
- nom libre : espaces normalisés, vide refusé, 40 caractères au plus ;
- plausibilité par unité, bornes incluses ou exclues comme ci-dessus ; poids sans maximum ;
- instant d'une date : aujourd'hui → maintenant, un autre jour → début du jour local, futur refusé ;
- écart : aucune mesure ou une seule → rien ; deux → la différence ;
- `plotTimedPoints` : abscisses proportionnelles au temps, un point centré, pas de division par zéro.

### Dépôts

- `deleteBodyWeight` : réconcilie les records de l'intervalle, y compris la première mesure et la
  dernière ; la mesure d'un autre type n'est pas touchée ; une transaction qui échoue ne supprime rien ;
- `saveMeasurement` : première saisie, correction le même jour sans doublon, autre jour, saisie
  rétrodatée, type libre ; `body_weight` aiguillé vers `saveBodyWeight` ;
- `listMeasurementTypes` : ordre du catalogue puis ordre alphabétique des champs libres, lignes
  supprimées ignorées, un type sans ligne vivante absent ;
- `deleteMeasurement` : suppression douce, ligne absente sans effet.

### Écrans

- liste : état vide, une ligne par type, écart signé ;
- feuille : la valeur implausible désactive le bouton, la mesure du même jour est annoncée, un champ
  libre demande son nom et son unité ;
- détail : lecture, correction, suppression confirmée ;
- E2E à 390 px : saisie rétrodatée, courbe, rechargement, suppression, aucun débordement aux trois
  tailles de police.

## Hors périmètre

- Les photos de progression et le verrouillage biométrique (RF-39, décision du 2026-08-11).
- Health Connect (RF-40), les unités impériales (RF-50, hors périmètre), les objectifs chiffrés.
- Une tendance lissée du poids (moyenne glissante) : c'est une règle à juger, pas un défaut.
- L'indice de masse corporelle et la masse maigre : ils demandent une taille ou un modèle.

## Checkpoint téléphone

- Progression › Mensurations › Ajouter : tour de taille, 84 cm, daté d'il y a un mois ; puis 82,5 cm
  aujourd'hui. La fiche dit « −1,5 cm », la courbe a deux points, le sélecteur de date d'Android
  s'ouvre et refuse demain.
- Le poids saisi sur l'accueil apparaît dans la liste, et un poids rétrodaté change le tonnage d'une
  traction faite ce jour-là.
