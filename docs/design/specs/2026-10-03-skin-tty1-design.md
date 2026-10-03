# Skin TTY1

**Date :** 2026-10-03

**Statut :** design à relire. La maquette est validée.

**Périmètre :** le thème de l’application : jetons, police, formes, commandes, ouverture et réglages

**Maquette :** `docs/design/mockups/2026-10-03-skin-tty1.html`. Elle fait foi pour l’apparence, ce
document pour le comportement et le code. Les contrastes et les tailles de l’une sont ceux de l’autre.

## Objectif

Ajouter un troisième thème, **TTY1**, qui habille toute l’application comme la première console
virtuelle d’un Linux : police à chasse fixe, noir et gris, une seule couleur vive, angles droits,
vidéo inverse pour ce qui est pressé.

C’est un thème au même titre que Sombre et Clair. Il se choisit dans Réglages > Apparence, s’applique
sans recharger l’app et reste actif jusqu’à ce qu’on en choisisse un autre. Il ne change ni la
structure des écrans, ni les gestes, ni les données.

L’ouverture de l’app y devient la console que `Boot` joue déjà de temps en temps (variante
`console`). Avec ce thème, elle se joue à chaque lancement.

## Décisions retenues

Ces choix sont ceux de la maquette. Le coût de chacun, s’il fallait en changer, est indiqué.

1. **Un troisième thème.** `Theme` passe à `'dark' | 'light' | 'tty1'`. Un réglage d’habillage
   séparé obligerait à dire ce que serait un « TTY1 clair », et la réponse est : rien. Changer
   d’avis coûte un second sélecteur et une table des combinaisons permises.
2. **Le vert ANSI comme accent unique.** `#55ff55`, 15,8:1 sur le noir. La palette du Lot 1 était
   déjà un vert acide. L’ambre et l’orange de la maquette sont des variantes d’essai et ne sont pas
   livrés. Changer d’avis coûte quatre jetons, ou un attribut `data-accent` si l’on veut un choix.
3. **Quatre tailles de police, pas une de plus.** 12, 16, 24 et 32 px, les bitmaps natives de
   Terminus : un pixel de police est un pixel d’écran, donc rien n’est flou. L’échelle actuelle compte
   une dizaine de tailles, de 11 à 36 px, qui se replient sur ces quatre (tableau plus bas).
4. **Pas de trame CRT.** Elle coûte de la lisibilité en salle et n’apporte rien à un écran qu’on lit
   à bout de bras.
5. **Les pictogrammes restent.** Ils ne sont pas redessinés : extrémités carrées, angles vifs et
   `shape-rendering: crispEdges` suffisent. Les glyphes texte ne remplacent que ce qui en a un
   naturel : la coche `[x]`, les replis ▼ et ►, les chevrons `>`, les interrupteurs `[ON ]` et `[OFF]`.
6. **L’ouverture console est permanente avec ce thème.** La rare surprise disparaît tant que TTY1 est
   actif et reprend son rythme en le quittant. Une séance en cours saute toujours l’ouverture, comme
   aujourd’hui.
7. **Le skin ne renomme aucune classe.** Il lit les classes Tailwind existantes comme des rôles
   (`rounded-2xl` est une fenêtre, `rounded-xl` une commande) et n’ajoute que des attributs
   `data-part` là où aucun point d’accroche stable n’existe. Des tests lisent déjà des noms de
   classes : un renommage les casserait pour rien.

## Ce qui ne change pas

- La structure des écrans, l’ordre des blocs, la navigation, les gestes et les zones du pouce.
- Les cibles tactiles de 48 px au minimum. Une ligne de série fait trois cellules de haut, pas une.
- Les données : aucune table, aucun index, aucune version de schéma, aucun export.
- Le hors-ligne. La police est dans le bundle et dans le précache du service worker, rien ne vient
  d’un CDN.
- Les règles de la charte. L’accent reste réservé aux actions principales, aux séries validées et aux
  records ; la carte du corps garde sa rampe de gris ; `--text-3` ne porte jamais une valeur qu’on lit.
- Le sens ne passe jamais par la couleur seule : une série validée se lit `[x]`, un record porte son
  étoile et son texte, un type de série garde son pictogramme.
- Les textes de `src/i18n/fr.ts`, à trois ajouts près (voir Architecture).

## Comportement utilisateur

### Choisir le thème

Le sélecteur de Réglages > Apparence passe de deux à trois options : Sombre, Clair, TTY1. Choisir
TTY1 s’applique immédiatement et se mémorise sous la clé existante `fittrack:theme`. La phrase d’aide
sous le sélecteur suit le thème choisi : celle d’aujourd’hui pour Sombre et Clair, une phrase propre
à TTY1 pour lui.

Une valeur mémorisée inconnue retombe sur Sombre, comme aujourd’hui.

### Ce qu’on voit

| Rôle | Jeton | Valeur | Contraste |
|---|---|---|---|
| Fond de l’écran et des fenêtres | `--surface-0`, `--surface-1` | `#000000` | |
| Champs, séries validées, bande d’effort | `--surface-2` | `#1c1c1c` | texte 2 dessus : 7,3:1 |
| Filets | `--border` | `#555555` | 2,8:1, décoratif |
| Texte principal, chiffres saisis | `--text-1` | `#ffffff` | 21,0:1 |
| Texte secondaire et micro-libellés | `--text-2` | `#aaaaaa` | 9,0:1 |
| Texte réservé, jamais lu | `--text-3` | `#555555` | 2,8:1 |
| Accent sur fond noir | `--accent-ink` | `#55ff55` | 15,8:1 |
| Boutons pleins, onglet actif, série validée | `--accent-fill`, `--accent-on-fill` | `#55ff55`, `#000000` | 15,8:1 |
| Barres de graphique ordinaires | `--accent-data` | `#00aa00` | 6,7:1 |
| Axes, contours du corps | `--axis` | `#878787` | 5,8:1 |
| Erreur, suppression | `--danger-ink` | `#ff5555` | 6,7:1 |

Les valeurs viennent de la palette VGA par défaut du noyau Linux, plus un gris xterm-256 pour les
champs. `--accent-soft`, `--accent-fill-pressed` et `--scrim` complètent le bloc ; leurs valeurs sont
dans la maquette.

Les formes : angles droits partout, filets de 1 px, un double filet de 3 px en tête des feuilles. Les
cartes, qui n’ont plus de fond distinct, gardent un contour de 1 px. Les lignes d’une liste se
séparent par un filet pointillé.

### Les quatre tailles

| Taille d’origine | Devient | Où |
|---|---|---|
| 11 et 12 px (`text-xs`, `label-xs`, 11 px arbitraires) | 12 px | libellés en capitales, en-têtes de colonne, onglets |
| 14, 15 et 16 px (`text-sm`, `text-base`) | 16 px | texte courant, lignes de liste, boutons |
| 18, 20 et 24 px (`text-lg`, `text-xl`, `text-2xl`) | 24 px | titres d’écran, valeurs de série |
| 28, 30, 36 et 40 px (`text-3xl`, `text-4xl`, deux arbitraires) | 32 px | gros chiffres : tuiles, graphiques, plaques |

Le texte courant passe de 14 à 16 px, soit 14 % de plus. Sous 373 px de large, la colonne
« Précédent » d’une série passe en 12 px pour que les quatre autres colonnes gardent leur place.

Les interlignes sont de 16, 24, 32 et 40 px. L’interlettrage est nul partout, sauf pour les libellés
en capitales, qui gardent 1 px.

### Les états

- Pressé : vidéo inverse (fond gris, texte noir). Plus de mise à l’échelle au toucher.
- Une série à faire se lit `[ ]`, une série validée `[x]` sur un bloc de l’accent.
- Un exercice ouvert porte ▼, un exercice replié ►.
- Un interrupteur se lit `[ON ]` ou `[OFF]`, avec sa marque (« 80% ») devant.
- Un bouton plein est un bloc de l’accent ; un bouton secondaire est un cadre gris. Tous portent
  leurs crochets.
- L’onglet actif de la barre du bas est un bloc de l’accent, texte noir.

### Le mouvement

Les quatre gestes de l’app (`rise`, `fade`, `pop`, `flash`) gardent leurs durées et leurs départs
mais avancent par paliers, comme un écran de texte qui se redessine. Seul un curseur bloc clignote,
et un seul par écran : à la fin du titre de l’accueil, devant le temps de repos pendant une série, au
bout de la console à l’ouverture. « Réduire les animations » l’arrête, sans règle de plus : la règle
globale de `index.css` s’en charge déjà.

### L’ouverture

Avec TTY1, l’ouverture montre le logo et le nom en haut, puis la console en dessous : les quatre
lignes d’état déjà dans `fr.ts`, l’invite, la commande qui se tape, puis la devise de l’app en
commentaire (`# Production was the gym`). Sa durée est celle de l’ouverture normale, 2 180 ms. Une
séance en cours la saute, comme les autres.

## Architecture

### Le thème

`src/stores/theme.ts` expose `THEMES`, sa table `SYSTEM_BAR_COLOR` gagne `tty1: '#000000'`, et
`loadTheme` retombe sur `'dark'` pour toute valeur hors de `THEMES`.

Le script bloquant de `index.html` pose `data-theme` et `theme-color` avant le premier rendu. Il
apprend le troisième thème et garde la même table de couleurs que le store. Un test exécute ce script
tel quel et le compare à `applyTheme` pour chaque thème : la dérive que son commentaire redoute
devient impossible.

`src/platform/systemBars.ts` passe de « sombre si le thème est sombre » à « clair seulement si le
thème est clair ». TTY1 a les icônes claires de la barre sombre.

### Les jetons et les variables Tailwind

Un nouveau fichier `src/styles/tty1.css`, importé en tête de `index.css`, porte tout le skin. Les
tests de `Boot` lisent `index.css` par ancres ; le skin n’y touche donc que par cet `@import`.

Son premier bloc, `:root[data-theme='tty1']`, redéfinit **chaque** jeton que le thème clair redéfinit,
et un test le vérifie. Un jeton oublié ne serait pas une erreur visible : il retomberait sur la valeur
du thème sombre, un orange dans un écran vert.

Il surcharge aussi les variables de thème de Tailwind v4. Le CSS généré montre que les utilitaires
les lisent par `var()` : `.rounded-2xl` vaut `var(--radius-2xl)`, `.text-sm` vaut `var(--text-sm)`,
`body` vaut `var(--font-sans)`. Surcharger `--font-sans` et les `--text-*` donne la police et
l’échelle sans toucher un composant. Le fichier n’est pas dans une couche : une règle sans couche
l’emporte sur celles de Tailwind, quelle que soit sa spécificité.

Ce que les variables ne couvrent pas, le fichier le traite à part :

- `.rounded`, `.rounded-full` et `.rounded-[0.3rem]` ont un rayon écrit en dur. Une seule règle,
  `border-radius: 0` sur tout, remplace les deux jeux.
- Cinq classes de taille arbitraires, onze usages (`text-[0.6875rem]`, `text-[11px]`,
  `text-[0.9375rem]`, `text-[1.75rem]`, `text-[2.5rem]`), sont écrites en dur. Elles reçoivent une
  règle chacune.
- `active:scale-*` écrit la propriété `scale`, pas `transform`. Cinq usages à neutraliser, par leurs
  noms de classes exacts : `scale-x-0` de l’onglet actif doit rester intact.
- `record-figure` fixe sa propre famille. Elle hérite à la place.

### La police

Terminus 4.49.1 (SIL OFL 1.1, nom réservé) est convertie de bitmap en contours aux quatre tailles
natives, en deux graisses. La police dérivée s’appelle **TTY1** et chaque taille a sa famille :
`TTY12`, `TTY16`, `TTY24`, `TTY32`. Huit fichiers `woff2` de 5 à 8 Ko, rangés dans
`src/assets/fonts/tty1/` pour que Vite les nomme par empreinte et les base.

Tailwind ne pose que `font-size` et `line-height` : il ne peut pas lier une famille à une taille. Le
fichier le fait par des règles sur les utilitaires de taille (une famille pour 12 px, une pour
24 px, une pour 32 px ; 16 px est la famille par défaut). Un élément qui porte une classe de taille
porte donc toujours la bonne famille.

Trois points demandent une attention particulière :

- **Précache.** `globPatterns` de `vite.config.ts` n’inclut pas `woff2`. Sans lui, la police
  manquerait au premier démarrage hors-ligne. C’est la règle n° 2 de `CLAUDE.md`, pas un détail.
- **Sous-ensemble.** Un audit des 436 fichiers de `src` trouve trois caractères que la maquette n’a
  pas : `›` (U+203A, 753 occurrences, presque toutes dans la base de preuves), `≠` (U+2260) et
  l’espace fine insécable U+202F, que `fr.ts` emploie et que `Intl.NumberFormat('fr-FR')` met entre
  les milliers. Ils s’ajoutent au sous-ensemble, et un test garde la couverture : un nouveau
  caractère hors de la police fait échouer la suite au lieu de retomber en silence sur la police du
  système.
- **Licence.** Le dossier `licenses/terminus/` reçoit le texte de la licence et l’attribution, comme
  `licenses/z-anatomy/`, et l’écran « À propos et crédits » en reçoit une section. Le projet traite
  l’attribution comme une obligation affichée, pas comme un fichier de dépôt.

Le script de conversion (`bdf2ttf`, Python et `fonttools`) rejoint le dépôt : les fichiers `woff2`
sont des binaires, et sans leur générateur personne ne saurait les refaire.

### Les points d’accroche

Les classes existantes disent presque tout. Là où elles ne disent rien de stable, un attribut
`data-part` s’ajoute. Il est sans effet hors du thème.

| Composant | Attribut | Pourquoi |
|---|---|---|
| `Button` | `data-part="button"`, `data-variant` | crochets, et un style par variante |
| `ActionBand` | `data-part="action-band"`, `data-tone` | bande pleine ou cadre |
| `AddRow`, `FilterChip` | `data-part="add-row"`, `data-part="chip"` | `[+]` et cadre |
| `ListRow`, ligne d’historique | `data-part="row"` | filet pointillé |
| Coche de série | `data-part="set-check"` | `[x]` à la place du carré et de son icône |
| Pli d’un exercice ou d’un dossier | `data-part="fold"` | ▼ et ► à la place du chevron qui tourne |
| Sélecteurs segmentés de Réglages | `data-part="segmented"` | cadre à filets, option choisie en vidéo inverse |
| Piste de jauge (repos, objectif) | `data-part="meter"` | cellules par masque, sans toucher à la barre |
| Point du temps de repos | `data-part="rest-dot"` | le curseur bloc qui clignote |

Tout le reste s’accroche à ce qui existe : `role="radiogroup"` et `role="switch"`, `aria-pressed`,
`aria-expanded`, `aria-current`, `.bottom-nav`, `.sheet-panel`, `.resume-bar`, `.rpe-gauge`, `.boot-*`.

Un seul ajout n’est pas un attribut : `Screen` reçoit une prop `cursor`, que seul l’accueil passe. Elle
rend un élément décoratif que le CSS cache hors du thème et montre, clignotant, sous TTY1.

### L’ouverture

`BootVariant` gagne `'tty1'`. `selectBootVariant` reçoit le thème et renvoie `'tty1'` sans toucher à
la date de la surprise rare : elle reprend là où elle en était quand on quitte le thème. Seule la
variante `console` reprogramme la surprise ; `tty1` ne le fait pas.

`BootScreen` affiche pour `tty1` le logo, le nom et la ligne de version, puis les lignes de la
console avec les mêmes textes que `console`. La ligne de version demande que l’app connaisse son
numéro : `vite.config.ts` le lit dans `package.json` et le publie comme constante. C’est aussi ce
qui dit, sur le téléphone, si la PWA et l’APK sont à la même version.

### Les réglages

`THEME_OPTIONS` reçoit la troisième valeur. Trois clés s’ajoutent à `fr.ts` : `settings.themeTty1`
(« TTY1 »), `settings.themeTty1Hint` (« TTY1 : la console. Noir, gris, une seule couleur vive. ») et
`boot.versionLine`. L’écran « À propos et crédits » reçoit les siennes.

## Limites connues

- **Le fond avant le premier rendu.** `theme_color` et `background_color` du manifeste, le
  `backgroundColor` de Capacitor et le splash natif d’Android valent `#12110f` et ne suivent pas le
  thème. En TTY1, une image brun-noir précède le noir. Les changer ferait de même pour Sombre.
- **L’image exportée d’un graphique.** Ses couleurs suivent les jetons, donc elle sort noire et
  blanche. Son texte garde la police du système.
- **Le titre incrusté de « À lancer ».** La maquette le pose sur le filet de la carte. L’app le garde
  dans la carte, au-dessus du nom du dossier : l’en-tête de la carte (un `min-h-12`) resterait vide
  sans dossier, et le corriger demande de toucher à son balisage. C’est un raffinement, à reprendre
  si la carte reçoit un jour un titre en prop.
- **Les caractères hors du sous-ensemble.** Ils retombent sur la police monospace du système, avec des
  métriques proches mais pas identiques.
- **La première image.** `font-display: block` masque le texte le temps de charger une police servie
  par le précache, soit quelques millisecondes ; l’ouverture dure plus de deux secondes.

## Vérification

Du TDD sur ce qui a une logique :

- le store de thème (`tty1` mémorisé, valeur inconnue, couleur de barre, synchronisation native) ;
- le script de `index.html`, exécuté et comparé à `applyTheme` pour chaque thème ;
- `syncSystemBars` pour le nouveau thème ;
- le sélecteur de Réglages (trois options, application immédiate, phrase d’aide) ;
- `selectBootVariant` et `BootScreen` pour `tty1` ;
- les jetons : complétude contre le thème clair et seuils de contraste de la maquette ;
- la couverture de la police et le précache des `woff2`.

Le reste est de l’affichage, que la charte du dépôt ne teste pas : `typecheck`, `lint`, `test:run` et
`build` doivent rester verts à chaque tâche, et la vérification se fait à l’œil, écran par écran,
contre la maquette. Le dépôt n’a pas de Playwright : il n’y a pas de test visuel automatique.

Le checkpoint manuel se fait au doigt sur téléphone, en salle ou à défaut à bout de bras : choisir
TTY1, relancer l’app et regarder l’ouverture, lancer une séance, valider une série et suivre le
repos, ouvrir la feuille des plaques, parcourir l’historique et le volume, puis repasser en Sombre et
constater que rien n’a changé. Il faut aussi couper le réseau, tuer l’app et la rouvrir : la police
doit être là.

## Hors périmètre

- Une variante claire de TTY1.
- Un sélecteur d’accent (ambre, orange).
- La trame CRT.
- D’autres habillages.
- Le splash natif d’Android et les couleurs du manifeste.
- Redessiner les pictogrammes ou les définir en glyphes texte.
- Changer la police du texte des images exportées.
