# Police TTY1

La police console du skin TTY1, dérivée de **Terminus Font 4.49.1**
(© 2020 Dimitar Toshkov Zhekov, SIL Open Font License 1.1).

Terminus est une police bitmap. `build_tty1_font.py` en convertit quatre tailles (12, 16, 24 et
32 px) en polices à contours : chaque pixel allumé devient un carré, un pixel de police vaut 64 unités
et l’em est la hauteur du bitmap. À sa taille d’origine ou à un multiple, aucun pixel n’est flou.
Chaque taille est une famille (`TTY12`, `TTY16`, `TTY24`, `TTY32`) en deux graisses.

Le nom « Terminus Font » est réservé par sa licence : la police dérivée ne le porte pas. Le copyright
et la licence voyagent dans la table `name` de chaque fichier.

## Régénérer

1. Télécharger la source, hors du dépôt :
   `https://sourceforge.net/projects/terminus-font/files/terminus-font-4.49/terminus-font-4.49.1.tar.gz`
   (sha256 `d961c1b781627bf417f9b340693d64fc219e0113ad3a3af1a3424c7aa373ef79`), puis l’extraire.
2. Installer les deux dépendances, hors du dépôt aussi :
   `python3 -m venv /tmp/tty1-venv && /tmp/tty1-venv/bin/pip install fonttools brotli`
3. Depuis la racine du dépôt :
   `/tmp/tty1-venv/bin/python scripts/tty1-font/build_tty1_font.py <dossier terminus-font-4.49.1>`

La sortie va dans `src/assets/fonts/tty1/` : huit fichiers `woff2` de 5 à 8 Ko et `glyphs.json`, la
liste des caractères conservés.

## Quand la relancer

Quand un caractère entre dans l’app sans être dans la police. Le test de couverture
(`src/styles/tty1Font.test.ts`) le dit et nomme les caractères : il suffit alors de les ajouter à
`wanted()` dans le script, de régénérer et de commiter les fichiers.

Terminus n’a pas U+202F (l’espace fine insécable que `fr-FR` met entre les milliers) : le script le
dessine comme une cellule vide. Un caractère que Terminus n’a pas du tout se traite de la même façon,
dans `SYNTHETIC_SPACES`, s’il s’agit d’une espace, et par un repli sur la police du système sinon.
