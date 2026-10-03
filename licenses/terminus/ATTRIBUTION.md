# Attribution

La police du thème TTY1 (`src/assets/fonts/tty1/`) est une œuvre dérivée de **Terminus Font 4.49.1**,
une police bitmap libre, distribuée sous la **SIL Open Font License 1.1** (le texte est dans `LICENSE`).

Crédits :

- Dimitar Toshkov Zhekov — Terminus Font, © 2020

## Ce qui a été modifié

Les polices bitmap (BDF) 6×12, 8×16, 12×24 et 16×32 sont converties en polices à contours : chaque pixel
allumé devient un carré, un pixel de police vaut 64 unités et l'em est la hauteur du bitmap. Le jeu de
caractères est réduit à ce que l'application affiche (latin, typographie française, flèches, cadres et
blocs), et l'espace fine insécable U+202F, que Terminus n'a pas, est dessinée comme une cellule vide.
Le script qui fait tout cela est `scripts/tty1-font/build_tty1_font.py` ; son `README.md` dit où
trouver les sources et comment régénérer les fichiers.

## Le nom

« Terminus Font » est un nom de police réservé (OFL, clause 3). La police dérivée ne le porte pas : ses
familles s'appellent `TTY12`, `TTY16`, `TTY24` et `TTY32`. Le copyright et la licence voyagent dans la
table `name` de chaque fichier (clause 2).

## Conséquence pratique

L'OFL autorise l'usage, l'étude, la modification et la redistribution, y compris dans une application,
à condition de ne pas vendre la police seule et de garder cet avis avec elle. Cela n'impose rien au
reste du code de FitTrack.

L'écran « À propos et crédits » reçoit une section pour la police : l'attribution doit être accessible à
l'utilisateur de l'application, pas seulement à qui clone le dépôt.
