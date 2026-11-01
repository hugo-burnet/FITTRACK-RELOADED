# Skin Cyber

**Date :** 2026-11-01

**Statut :** implémenté sur `ccr-8abf77c4-43lck3`, non publié. Les écarts qui restent sont dans « Limites
connues ».

**Périmètre :** un quatrième thème, et une fonctionnalité pour tous les thèmes (−15 s / +15 s pendant
le repos).

**Maquette :** `docs/design/mockups/2026-11-01-skin-cyber.html` (douze versions, toutes validées en
conversation avec l'utilisateur). Elle fait foi pour l'apparence et le mouvement ; ce document pour le
comportement et le code.

## Objectif

L'utilisateur voulait « un nouveau skin cyberpunk », puis précisément « une inspiration de Cyberpunk
2077 ». Le thème reprend la **grammaire visuelle** du jeu — sa police étroite et carrée, ses coins
coupés, ses titres en capitales, son rouge qui encadre, son jaune qui agit, ses glitchs — **sans ses
marques** : ni son nom, ni son logo, ni ses lieux, ni ses sons (voir « Ce qui n'entre pas »).

## Décisions retenues (avec l'utilisateur)

1. **Trois couleurs, trois métiers.** Le ROUGE encadre (filets, libellés, équerres : `--border`,
   `--text-2`), le JAUNE agit (`--accent-*` : bouton principal, série validée, onglet courant, repos,
   record), le CYAN compte (`--accent-data`, le champ qu'on saisit). Libellés rouges gardés (« on garde
   tout »), malgré la critique connue du jeu (« trop de rouge »).
2. **Le nom : « Cyber ».** « Cyberpunk 2077 » est une marque. « Cyber » tient aussi dans le sélecteur à
   200 % de taille de police. **Disponible d'office**, sans déblocage.
3. **Les formes** : plaques à deux coins coupés (`corner-shape: bevel`), équerres, zone hachurée,
   trame de points, commandes en parallélogramme, bouton principal hachuré avec un plot.
4. **Les fonds** (« j'aime particulièrement les fonds ») : grille de 28 px, trame de balayage, halo
   rouge en haut, halo cyan en bas, sous 2 % de luminance.
5. **La coche** doit être « percutante et satisfaisante, comme dans les menus du jeu » : frappe avec
   gel (hit-stop), éclair, déchirure rouge et cyan, équerres qui se verrouillent, deux ondes, huit
   éclats, balayage de la ligne, carte qui encaisse, éclair d'écran, étiquette du tonnage ajouté.
   **Son : l'impact de la cadence** (`public/audio/rep-impact.wav`), choisi par l'utilisateur après
   quatre essais de sons dédiés jugés « pas impact ».
6. **Le repos en barre de vie** : la piste jaune est la vie qui reste, elle se vide ; traînée blanche ;
   rouge et palpitante dans les dix dernières secondes ; un −15 s la fait encaisser.
7. **−15 s / +15 s pendant le repos**, pour **tous les thèmes** (« J'aime bcp ton +15 -15 »).
8. **L'arrivée sur un écran** : « pas de barre bleue, simplement l'animation du glitch », avec un **son
   glitch**. Elle remplace le glissé de 18 px des autres thèmes.
9. **Glitchs d'ambiance « Rares »** : une déchirure toutes les 30 à 60 s au plus, un micro-glitch toutes
   les 10 à 20 s.

## Ce qui ne change pas

- La structure des écrans, les gestes, les données (aucune table, aucun export).
- Les cibles de 48 px ; −15 et +15 font 48 px de haut.
- Le hors-ligne : police et sons sont dans le bundle et le précache (`woff2`, `mp3`, `wav` sont déjà
  dans `globPatterns`).
- Le sens ne passe pas par la couleur seule : l'erreur garde son mot (et un rouge plus vif que la
  structure, `--danger-ink: #ff2e63`).

## Architecture

### Le thème

`Theme` gagne `'cyber'` (barre système `#0b0c12`) ; `THEMES`, `SYSTEM_BAR_COLOR` et le script bloquant
d'`index.html` aussi (le test du script les tient ensemble). Réglages › Apparence passe en **deux lignes
de deux** : quatre boutons sur une ligne débordent à 200 %. La phrase d'aide sort d'une table
`THEME_HINT` (`settings.themeCyberHint`).

### La feuille

`src/styles/cyber.css`, importé par `index.css` après `tty1.css`, hors couche. Comme TTY1, il ne renomme
aucune classe : `rounded-2xl` est une plaque, `rounded-xl` une commande, et il s'accroche aux `data-part`
existants (`button`, `segmented`, `cell`, `field`, `input`, `set-check`, `meter`, `meter-rail`) et à
trois nouveaux : `shell` (la coquille, rendue transparente pour laisser voir les fonds de `body`),
`rest-shift`, `set-fx`. `cyber.test.ts` vérifie la complétude des jetons contre le thème clair, les
seuils de contraste, la police et son précache.

Les coins coupés reposent sur `corner-shape: bevel` (Chrome 139) plutôt que sur `clip-path` : le filet
suit la diagonale et rien n'est rogné (une feuille, un menu, une ombre). Une WebView plus ancienne garde
les arrondis du thème sombre.

### La police

**Cyber Sans**, dérivée de **Rajdhani** (Indian Type Foundry, OFL 1.1), la police de l'interface du
jeu. Une seule modification : des chiffres à chasse fixe (Rajdhani n'a pas de `tnum` ; le temps de
repos tremblerait). Quatre graisses, 15 Ko chacune, `src/assets/fonts/cyber/`. Générateur :
`scripts/cyber-font/`. Licence : `licenses/rajdhani/`, et une section dans « À propos et crédits ».
Toutes les tailles montent d'un cran (Rajdhani est étroite).

### −15 s / +15 s (tous les thèmes)

`restTimer.shift(setId, secondes)` déplace **le début et la fin** du repos ensemble : la barre avance ou
recule de quinze secondes du repos entier, au lieu de se redessiner contre une durée plus courte (défaut
trouvé à l'œil : « 0:13 » s'affichait comme une barre presque pleine). La fin ne passe jamais avant
maintenant — un repos raccourci à zéro se termine comme un repos écoulé, par le minuteur de `RestRail`
(même son, même relais vers la cadence) — et le début jamais après maintenant (un instantané l'exige :
ce qui ne peut pas être rembobiné allonge le repos). Un repos fini n'est pas ranimé. `RestShift` : deux
boutons sous l'en-tête de l'exercice qui se repose.

### La barre de vie du repos

Le composant ne change pas de sens : en Cyber, la piste devient la vie (jaune) et la barre du temps
écoulé devient la perte, ancrée à droite par `direction: rtl`, avec une traînée blanche à son bord.
`RestRail` porte deux attributs que seul Cyber dessine : `data-crit` (dix dernières secondes,
`msUntilCritical`, par minuteur) et `data-hit` (repos raccourci, 450 ms).

### La coche

- `WorkoutSetRow`, en Cyber seulement : à la validation, `data-fired` sur la ligne pendant 900 ms,
  `SetCheckFx` remonté (sa clé change) avec l'étiquette `setImpactTag` (« +500 kg », ou « +1 série »
  sans tonnage ; un échauffement n'en revendique pas), et `buzzSetImpact` (40 ms, écho 12 ms). La
  ligne de série vit dans `SwipeToDelete`, qui rogne : l'étiquette reste dans sa hauteur.
- Le son : `skinTone` remplace, en Cyber, le ton du cue `set-validated` par `repTap` (l'impact de la
  cadence). Le plan du cue décide toujours s'il y a un son.
- Le hit-stop est un palier tenu dans les images-clés de la frappe ; la carte encaisse par
  `.rounded-2xl:has([data-fired])`, l'éclair d'écran par `body:has([data-fired])::after`.

### Les glitchs

`CyberGlitch`, monté dans `AppShell`, ne rend rien hors de Cyber (il suit `data-theme` par un
`MutationObserver`). La DÉCHIRURE : un filtre SVG (turbulence en bandes → déplacement → canaux rouge et
cyan séparés) posé sur `#root` cinq images de 50 ms, plus des bandes de couleur et un bloc inversé
ajoutés à `body`, puis retirés. À chaque changement d'écran (pas au premier rendu : l'ouverture a la
sienne), avec `playScreenGlitch` (`public/audio/screen-glitch.mp3`, muet en silence et en voix seule).
L'AMBIANCE : deux rythmes (`cyberGlitch.ts`) ; `mayGlitch` refuse sous un doigt (1,5 s), pendant une
saisie, écran caché, en mouvement réduit. Le MICRO-GLITCH pose `data-glitch` (un attribut, que React ne
réécrit pas) sur un titre, un libellé ou un pictogramme.

## Ce qui n'entre pas

- **Les sons du jeu.** Demandés par l'utilisateur ; ils appartiennent à leur studio et l'app est
  publiée (Pages, APK) : les embarquer serait les redistribuer. Les sons du thème sont la cadence
  existante (CC0, AudioPapkin) et un glitch mixé à partir des packs CC0 de Kenney
  (`scripts/cyber-sounds/`).
- Les marques : nom, logo, lieux, typographie de titre propriétaire.

## Limites connues

- **Le mouvement réduit** coupe tout (règle globale d'`index.css`, garde de `mayGlitch`, garde de
  `tearScreen`) : l'état final est là d'emblée.
- **La déchirure sur un écran chargé à la demande** : au premier passage, le contenu peut n'être pas
  encore là pendant le quart de seconde ; la déchirure passe sur un écran vide.
- **Le filtre SVG sur `#root`** pendant 250 ms : sur une WebView lente, une image peut sauter.
- Ce que la maquette montre et que l'app ne fait pas encore : le compteur de séries en barre de vie
  (l'app n'a pas cette jauge), le titre qui se « décode » (réécrire un nœud texte que React possède
  serait fragile), le filigrane du nom de l'écran, le chargement de l'ouverture en barre de vie.

## Vérification

TDD sur la logique : `restTimer.shift`, `msUntilCritical`, `skinTone`, `setImpactTag`,
`nextAmbientDelay` / `mayGlitch`, `playScreenGlitch`. Composants : Réglages (quatre thèmes, Cyber
appliqué), crédits, `RestShift`, `RestRail` (`data-crit`, `data-hit`), `WorkoutSetRow` (vibration et
effets en Cyber seulement), `CyberGlitch` (déchirure et son à la navigation, rien au premier rendu ni
ailleurs). Jetons et contrastes : `cyber.test.ts`. E2E : Cyber à 100, 130 et 200 % dans « aucun écran
ne déborde » ; −15 / +15 sur un vrai repos (`seance.spec.ts`). Le reste — le son, la vibration, le
ressenti de la coche — se juge au doigt : `docs/recette-telephone.md` § 6.
