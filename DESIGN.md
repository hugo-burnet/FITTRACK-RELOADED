# FitTrack — Langue visuelle

Extraite du code le 2026-11-21 (`src/index.css`, `src/styles/tty1.css`, `src/styles/cyber.css`,
`src/ui/*`, `src/app/Screen.tsx`, `src/app/BottomNav.tsx`). Tout jeton cité existe sous ce nom.
Les règles produit (mobile d'abord, une main, cibles ≥ 48 px, contraste élevé, sombre par défaut)
viennent de `CLAUDE.md`.

**Ambiance :** dense, mécanique, lisible en sueur. Un instrument de salle, pas une vitrine :
surfaces pleines sans ombre, un seul accent par thème, chiffres tabulaires, mouvement court.

## Couleurs

Un thème = un bloc de jetons sémantiques, sélectionné par `:root[data-theme='…']`. Les quatre
blocs portent **les mêmes noms** (`tty1.test.ts` et `cyber.test.ts` les comparent à ceux du thème
clair). Un composant ne cite jamais une valeur : il cite un jeton.

| Jeton | Sombre (défaut) | Clair | TTY1 | Cyber |
|---|---|---|---|---|
| `--surface-0` (page) | `#12110f` | `#f1f3ef` | `#000000` | `#0b0c12` |
| `--surface-1` (cartes, lignes) | `#1b1916` | `#ffffff` | `#000000` + filet | `#12131c` |
| `--surface-2` (champs, éléments levés) | `#25221e` | `#e8ece6` | `#1c1c1c` | `#1c1d29` |
| `--border` | `#3a352f` | `#d0d8cf` | `#555555` | `#5a2328` |
| `--text-1` | `#f5f3f0` (17,0:1) | `#182019` (15,7:1) | `#ffffff` | `#e8f3f3` (17,2:1) |
| `--text-2` | `#b9b1a8` (8,9:1) | `#5c675e` (5,9:1) | `#aaaaaa` | `#ff6b63` (6,6:1) |
| `--text-3` (réservé) | `#7e766d` | `#8e998f` | `#555555` | `#7d3b3b` |
| `--accent-fill` | `#ff8a3d` | `#b54708` | `#55ff55` | `#fcee0a` |
| `--accent-fill-pressed` | `#ffa15f` | `#93370d` | `#aaffaa` | `#fff56b` |
| `--accent-on-fill` | `#21130a` (7,7:1) | `#ffffff` | `#000000` | `#0b0c12` (16,2:1) |
| `--accent-ink` | `#ff8a3d` | `#93370d` | `#55ff55` | `#fcee0a` |
| `--accent-soft` | `#3a2115` | `#ffedd5` | `#00260b` | `#2b2a0c` |
| `--accent-data` | `#a85a20` | `#b96b35` | `#00aa00` | `#2fc6d6` |
| `--axis` | `#756e64` | `#808a81` | `#878787` | `#a5524f` |
| `--danger-ink` | `#ff5c5c` (5,8:1) | `#b91c1c` (6,5:1) | `#ff5555` | `#ff2e63` |
| `--warn-ink` | `#f5c518` (10,8:1) | `#7a5c00` (6,3:1) | `#ffff55` (19,7:1) | `#ff9f1c` (9,0:1) |
| `--scrim` | `rgb(0 0 0 / 0.6)` | (hérite du sombre) | `rgb(0 0 0 / 0.72)` | `rgb(5 5 9 / 0.75)` |

Jetons propres à Cyber : `--cyber-focus` `#5ef6ff`, `--cyber-crit` `#ff3c46`, `--cyber-line`, `--cyber-prose` `#c4ccd3`.

**Cyber, deux registres secondaires (v3.0, décidé avec l'utilisateur).** Le rouge `--text-2` reste au registre gravé
(`label-xs`, `SectionTitle`, unités) : « le rouge encadre ». Les *phrases* — aide, corps des feuilles et de la
confirmation, sous-titres de ligne, valeurs lues, champs et placeholders — prennent `--cyber-prose` (≥ 10:1), pour que
`--danger-ink` soit le seul rouge vif d'une confirmation. Les chiffres lus en `--text-2` (`.metric`, `.record-figure`)
prennent `--accent-data`, le cyan : « le cyan compte ». Tout se fait dans `cyber.css`, aucun composant ne le sait.

**Clair (v3.0).** Page `#f1f3ef` sous des cartes blanches (1,12:1 au lieu de 1,07:1) : la carte se détache.
Jetons exposés à Tailwind (`@theme`) : `--color-accent` (= `--accent-fill`), `--color-accent-dim`
(= `--accent-fill-pressed`), `--color-accent-fg` (= `--accent-on-fill`).

**Rôles**
- **Aplat d'accent** (`--color-accent` + `--color-accent-fg`) : l'action, la valeur choisie (`Segmented`).
- **Encre d'accent** (`--accent-ink`) : l'accent *en texte ou en filet sur une surface* ; c'est aussi le repère de l'onglet courant (`BottomNav`, `Tabs`) : naviguer n'est pas choisir. Jamais `--accent-fill` en texte : il rate le contraste en clair, d'où deux jetons.
- **`--accent-soft`** : un *mode* choisi (« Aucun »), un état pressé, le flash d'une ligne qui bouge. Subordonné à l'aplat.
- **`--accent-data` / `--axis`** : séries ordinaires et ligne de base d'un graphique (≥ 3:1) ; l'encre d'accent reste la série mise en avant.
- **`--danger-ink`** : texte destructif sur surface, ou ce qui *a échoué* (une écriture, un import, une saisie refusée). Jamais un aplat. Ne s'appuie jamais sur la couleur seule : le mot reste.
- **`--warn-ink`** : un risque ou un état à régler, quand *rien n'est perdu et rien n'a échoué* (« Aucune sauvegarde », « Recalcul nécessaire »). Texte, ou filet de 2 px d'un bandeau posé sur `--surface-2` ; pas de fond propre, aucun bandeau n'en a besoin. Se distingue du danger par le mot, jamais par la teinte seule. Contrastes : ≥ 4,5:1 sur `--surface-0/1/2` dans les quatre thèmes (tableau de l'écart 9).
- **Règle des petits libellés : `--text-2`, jamais `--text-3`.** Tout micro-libellé, placeholder, valeur lue ou relevé est en `--text-2`. `--text-3` est *réservé* (écho non lisible) ; il rate 3:1 en clair. Aucun composant ne l'emploie aujourd'hui.
- Focus : contour 2 px `--accent-ink` (Cyber : `--cyber-focus`), décalé de 2 px.

Thèmes : **Sombre** chaud et orange, défaut. **Clair** vert-gris, accent brique. **TTY1** console Linux
(noir pur, vert ANSI, police bitmap, coins carrés, déblocable). **Cyber** rouge qui encadre, jaune qui
agit, cyan qui compte ; coins coupés (`corner-shape: bevel`) ; repli propre sur les arrondis du sombre.

## Typographie

- Famille : `--font-sans` = `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. TTY1 : `--tty1-16` (Terminus, quatre tailles natives 12/16/24/32 px, sans flou). Cyber : `'Cyber Sans'` (Rajdhani, chiffres de chasse égale), un cran plus grand (`--text-xs` 0.8125rem, `--text-sm` 0.9375rem, `--text-base` 1.0625rem, `--text-lg` 1.1875rem).
- Échelle : celle de Tailwind (`text-xs` … `text-7xl`). Usages réels : titre d'écran `text-2xl font-semibold tracking-tight` (une ligne, tronquée) ; corps et ligne `text-base` ; sous-titre `text-sm` en `--text-2` ; bande d'action `text-lg font-semibold` ; chiffre d'une tuile `text-2xl` ; état vide `text-7xl`.
- Utilitaires maison : `label-xs` (0.75rem, interligne 1.35, +0.06em, majuscules — le registre « gravé », toujours `--text-2`) ; `tabular` (chiffres tabulaires) ; `metric` (tabulaires, −0.03em : toute valeur qui se compare ou change) ; `record-figure` (chiffres tabulaires de la police du thème, −0.03em : chiffres de records ; plus de monospace système, dont la virgule prenait une cellule entière — « 36, 4 »).
- Titre `h1` : un par écran. Un titre est choisi par l'utilisateur : il tronque, ne se replie pas.

## Espacements

Échelle de Tailwind (base 4 px), pas de jeton propre. Constantes du cadre :
- Gouttière d'écran `px-4` (16 px) ; mesure max `36rem` (`Screen`) ; en-tête `min-h-16`, `px-4 pt-5 pb-4` ; contenu `pt-3 pb-8`.
- **Entre deux blocs d'un écran : `space-y-7` (28 px)** — l'en-tête et le contenu s'y alignent exprès (`pb-4` + `pt-3`).
- Dans un bloc : `gap-2` / `gap-3`, `space-y-3` / `space-y-4`. Ligne : `px-4 py-3`, `gap-3`. Carte avec contenu libre : `p-4`. Feuille : `px-5`.
- Zones sûres : `safe-top`, `safe-bottom`, `sheet-bottom` (marge de geste + 1.75rem).
- Hauteur : `#root` en `100dvh` ; le défilement vit dans `Screen`, entre l'en-tête et le pied (frère flex, jamais `sticky` par-dessus).

## Rayons

`rounded-xl` boutons, chips, boutons d'en-tête, bascule segmentée (conteneur) ; `rounded-2xl` `Card` et plaques ;
`rounded-lg` champs et segments intérieurs ; `rounded-t-3xl` feuille ; `rounded-full` interrupteur, poignées.
Une ligne (`ListRow`) n'est **pas** arrondie : elle vit dans une `Card`. `ActionBand`, barre de reprise : bord à bord, sans arrondi.
TTY1 et Cyber remettent tout à `0` (Cyber : coins coupés).

## Cibles tactiles

- **≥ 48 px, non négociable.** `min-h-12` pour boutons, chips, champs, segments, `AddRow`, `Toggle` (`h-12`). `ListRow`, `ActionBand`, onglets du bas, `Button size="lg"` : `min-h-14` (56 px).
- Boutons d'en-tête : `size-[48px]` en pixels CSS, **pas** `size-12` (une cible ne grandit pas avec la taille de police système : à 200 %, `size-12` en ferait 96).
- Pas de croix de 20 px à côté d'une cible de 48 : on efface un filtre là où on le règle.
- Pressé : `active:` (fond `--surface-2`/`--surface-1`, `brightness`, `scale-[0.97]` sur `Button`) ; désactivé : `opacity-40`.

## Mouvement

Quatre gestes, courts, qui partent près de l'arrivée. Ils disent d'où vient une chose, jamais ne font spectacle.

| Jeton | Valeur | Usage |
|---|---|---|
| `--dur-1` | 120 ms | pressé, survol, changement de couleur |
| `--dur-2` | 220 ms | apparition, feuille, interrupteur |
| `--ease-mech` | `cubic-bezier(0.2, 0, 0, 1)` (TTY1 : `steps(3, end)`) | toutes les courbes |
| `animate-rise` | 8 px + fondu, `--dur-2` | carte, liste, écran |
| `animate-fade` | fondu, `--dur-2` | contenu de feuille |
| `animate-pop` | échelle 0,86 → 1,04 → 1, `--dur-2` | série validée, record |
| `animate-flash` | `--accent-soft` → transparent, 640 ms | « cette ligne vient de bouger » |

`prefers-reduced-motion` : `rise` et `pop` perdent le déplacement et gardent le fondu, `flash` garde tout,
la feuille garde une transition d'opacité (elle démonte sur `transitionend`). Tout vit dans `@layer base`
d'`index.css` : un override écrit plus bas serait inerte.

## Profondeur

Pas d'ombre : les niveaux sont des surfaces (`--surface-0` page → `--surface-1` carte → `--surface-2` champ/levé),
séparées par `--border`. Une feuille se pose sur `--scrim` avec un filet haut. La barre du bas : `border-t`.

## Composants partagés (`src/ui/`, `src/app/`)

| Composant | Quand l'utiliser |
|---|---|
| `Screen` | Cadre de tout écran : titre, flèche retour (`onBack`), `action` (icône), `sub` (instruments épinglés), `footer` (une `ActionBand`). En-tête de hauteur fixe (48 px + 2,25 rem), avec ou sans action : le titre ne saute pas d'un écran à l'autre. |
| `BottomNav` | Cinq onglets, `min-h-14`, repère `--accent-ink` de 3 px en haut de l'onglet courant. Hors du défilement. |
| `Card` | La seule surface levée. `padded` seulement si elle contient du contenu libre ; vide de padding autour de `ListRow`. |
| `ListRow` | Une entrée qui est un lien, ou dont l'état tient en un mot : titre + sous-titre + `trailing`. Empilée dans une `Card`. Chevron automatique sur toute ligne cliquable sans `trailing` ; `chevron={false}` pour une ligne qui *agit* (exporter, installer). Titre sur deux lignes au plus (`line-clamp-2`), jamais tronqué sur une. Une seule flèche de lien dans l'app : `ChevronRightIcon`, jamais « → ». |
| `SectionTitle` | Annote un groupe (`h2`, `label-xs`, `--text-2`). Ne narre pas. |
| `Button` | `primary` (aplat d'accent), `secondary` (défaut), `ghost`, `danger` (texte `--danger-ink`) ; `md` / `lg`. |
| `ActionBand` | L'unique verbe d'un écran, pleine largeur au-dessus des onglets. `accent` ou `quiet` (sortie). Jamais une navigation. |
| `HeaderAction` | Bouton du coin haut-droit : une icône, jamais un mot. |
| `AddRow` | Le seul geste d'ajout, en pied de `Card`. |
| `Toggle` | État on/off visible dans sa forme (interrupteur + repère). Pas un `HeaderAction`. |
| `ChoiceChip` | Choix parmi quelques-uns, à plat : valeur = aplat d'accent, mode (`quietActive`) = `--accent-soft`. |
| `FilterChip` | Ouvre un sélecteur et montre sa valeur courante. |
| `Input` / `Textarea` / `NumberInput` | Champs `--surface-2`, `min-h-12`, anneau `--accent-ink`, placeholder `--text-2`. |
| `Sheet` | Conteneur de tout sélecteur, monte du bas ; se ferme par glissé, voile ou Échap. |
| `OptionSheet` / `MultiOptionSheet` / `ActionSheet` / `ConfirmSheet` | Choix unique (ferme au tap) / multiple (reste ouverte, bouton « fini ») / menu d'actions / seconde confirmation. |
| `ConfirmAction` | Armement en place dans une carte, quand il y a une ligne à armer. |
| `UndoRow` | Retour arrière d'une suppression, 6 s, à la place de la ligne. Pas un toast. |
| `SwipeToDelete`, `ReorderableList` | Suppression et réordonnancement par geste. |
| `EmptyState` | Une collection vide montre son chiffre (`0` + unité) ; sans chiffre, un titre. |
| `TileGrid` + `Tile` | Un groupe de tuiles qui répond à une question. Contrat : « Grille modulaire ». |
| `Segmented` | Choisir une valeur parmi deux à quatre, à plat (`radiogroup`). Décision de l'écart 6. |
| `Tabs` | Passer d'une vue à l'autre du même objet, ou entre routes sœurs. Décision de l'écart 6. Colonnes `minmax(0,1fr)` avec césure : « Documentation » tient à 200 %. |
| `Skeleton` | La place d'une carte pendant une lecture. Immobile. Décision de l'écart 12. |

## Règle de mise en page : tuile ou ligne

Décidée avec l'utilisateur le 2026-11-21.

**Tuile ou ligne.** Une *tuile* est une entrée qui affiche un chiffre ou un état chiffré à lire d'un coup d'œil (un tableau de bord : Progression › vue d'ensemble). Une *ligne* est une entrée qui n'est qu'un lien, ou dont l'état tient en un mot (Réglages, Planifier, Exercices, Historique). Pas de tuile qui ne montre qu'un nom. Un même type d'écran utilise un même motif.

Motifs : la ligne est `ListRow` dans une `Card` ; la tuile est `Tile` dans un `TileGrid` (`src/ui/`, contrat
ci-dessous). Premier écran qui s'en sert : l'îlot de l'accueil (`HomeStatsIsland`).

## Grille modulaire

Décidée le 2026-11-21 pour la v3.0 (pages d'objet, Progression en tableau de bord). Elle dit comment
les tuiles se rangent ; quand c'est une tuile et quand c'est une ligne, la règle précédente l'a tranché.

### Tailles

Une tuile déclare sa taille d'après ce qu'elle contient, jamais d'après la place libre.

| Taille | Largeur de base | Hauteur min. | Ce qu'elle a le droit de contenir |
|---|---|---|---|
| `S` petite | 1 colonne | `min-h-20` | Un chiffre et son libellé ; ou deux chiffres empilés du même sujet. Chiffre : six signes au plus, espaces comprises, plus une unité de deux lettres (`6 420 kg`, `1 h 05`, `3 / 4`) — ce qui tient dans la colonne la plus étroite. Libellé : 16 signes au plus, aucun mot de plus de 10 lettres. |
| `L` large | 2 colonnes (1 si la grille n'en a qu'une) | `min-h-20` | Un chiffre et un `detail` : une tendance (« ↑ 6 % sur 4 sem. ») ou une phrase, `text-sm` en `--text-2`, deux lignes au plus. |
| `G` grande | La rangée entière, seule | `min-h-40` | Un chiffre, son `detail` et un corps : mini-courbe ou liste courte (3 lignes de texte au plus). **Une seule par écran.** |

- Un chiffre ne se tronque ni ne se coupe (`whitespace-nowrap`). Seule l'unité peut passer sous lui : c'est un
  filet de sécurité, pas une mise en page. Le libellé se replie (`[overflow-wrap:anywhere]` en dernier recours),
  jamais `truncate` : un libellé coupé est une tuile qu'on ne sait plus lire.
- Ce qui dépasse ces contenus ne fait pas une tuile plus grande : c'est une deuxième tuile, ou une `Card` de `ListRow`.
- Mini-courbe : un `<svg>` de polyligne écrit à la main, `h-[64px]` en pixels (elle n'a pas de texte, rien à
  faire grandir avec la police), série en `--accent-ink`, base en `--axis`, sans axe ni libellé, `aria-hidden` :
  le chiffre et le `detail` disent ce qu'elle montre. Jamais le module de graphiques, qui ne doit pas entrer dans
  le chunk d'une page d'objet. L'échelle se prend sur les points complets ; une période en cours (`partialLast`, en
  pointillé) est bornée à la zone et ne fait plus plonger la courbe chaque semaine ; 8 px de jour au-dessus de la base,
  pour que le minimum ne se lise pas comme un zéro.
- Une `S` qui resterait seule sur sa rangée (la suite `G, S, L` à deux colonnes l'étire sur toute la largeur pour un
  chiffre) passe en `L` avec un `detail` : c'est la composition qu'on corrige, pas `placeTiles`.

### Colonnes

`TileGrid` est un conteneur (`@container`). Le nombre de colonnes suit **sa** largeur, mesurée en `rem` :

| Largeur du conteneur | Colonnes | Colonne la plus étroite (contenu, `p-4` déduit) |
|---|---|---|
| < 15,5 rem | 1 | — |
| 15,5 à 30 rem | 2 | 7,375 rem (5,375 rem) |
| ≥ 30 rem | 3 | 9,5 rem (7,5 rem) |

- `rem` et non `px` : c'est ce que la taille de police d'Android fait grandir, et ce que l'E2E émule. À 200 %,
  les colonnes tombent d'elles-mêmes au lieu de se serrer. Pas `em` non plus : dans une requête de conteneur il
  vaut la police du conteneur, que Cyber change ; `rem` reste celle du système.
- Jamais quatre colonnes : la mesure plafonne à 36 rem, et une tuile de 8 rem n'apporte qu'un chiffre de plus
  par rangée pour un libellé sur trois lignes.
- Seuils choisis par la tuile la plus étroite qu'ils produisent : au seuil de deux colonnes, 5,375 rem de
  contenu ; `6 420 kg` y mesure 5,3 rem (Inter, plus large que Roboto), 5,0 en TTY1, 4,2 en Cyber.
- Ce que donne la mesure de `Screen` (largeur utile = écran − 2 × `px-4`, gouttière qui suit aussi la police) :

| Écran | 100 % | 130 % | 200 % |
|---|---|---|---|
| 360 px | 20,5 rem → 2 (158 px) | 15,3 rem → 1 | 9,25 rem → 1 |
| 390 px (référence) | 22,4 rem → 2 (173 px) | 16,75 rem → 2 (166 px) | 10,2 rem → 1 (326 px) |
| 576 px (`max-w-[36rem]`) | 34 rem → 3 (173 px) | 25,7 rem → 2 (259 px) | 16 rem → 2 (244 px) |

  Mesuré dans Chromium sur un prototype hors dépôt, avec les polices des quatre thèmes : aucun débordement, y
  compris pile aux seuils ; au seuil de deux colonnes, l'unité de `6 420 kg` passe sous le chiffre en Sombre et
  TTY1, et « LA DERNIÈRE FOIS » tient en trois lignes. Une `L` en grille de deux colonnes prend donc toute la
  rangée à 390 px : les croquis de `cartographie.md` §5 qui posent une large à côté d'une petite valent pour
  trois colonnes.

### Rangées pleines

Pas de trou : une rangée incomplète se remplit en élargissant une tuile, la plus importante.

- **L'importance, c'est l'ordre.** La première tuile est la plus importante ; l'écran les écrit du plus regardé
  au moins regardé (`cartographie.md` §5.1). Pas de propriété `priority` : deux ordres finiraient par se
  contredire, et un lecteur d'écran lit le DOM, pas une priorité. L'ordre visuel reste celui du DOM : on
  élargit, on ne déplace jamais.
- **Une fonction pure de placement, pas du CSS seul.** Le CSS ne sait pas « élargir la première tuile quand la
  rangée a un trou » avec des tailles mêlées (les requêtes de quantité ne comptent que des tuiles égales).
  `TileGrid` appelle `placeTiles` pour 1, 2 et 3 colonnes et pose les trois résultats en variables CSS sur
  chaque tuile ; la requête de conteneur choisit la bonne. Le CSS décide du nombre de colonnes, la fonction
  de ce qu'y occupe chaque tuile : pas de `ResizeObserver`, pas de rendu en deux temps.

```ts
// src/ui/tileLayout.ts — TDD (règle « logique métier » de CLAUDE.md)
export type TileSize = 'S' | 'L' | 'G';
export type TileColumns = 1 | 2 | 3;
/** La largeur, en colonnes, de chaque tuile, dans l'ordre reçu. Pure et totale. */
export function placeTiles(sizes: readonly TileSize[], columns: TileColumns): number[];
```

Règle, à `n` colonnes :
1. Base : `S` → 1, `L` → min(2, n), `G` → n.
2. Une `G` est seule sur sa rangée : elle coupe la liste en segments qui se placent indépendamment.
3. Dans un segment, on garde l'ordre et le **moins de rangées possible** : aucun élargissement n'ajoute de rangée.
4. Parmi ces placements, celui où la 1ʳᵉ tuile est la plus large, puis la 2ᵉ, etc. (ordre lexicographique).
   Construction : chaque rangée prend le moins de tuiles possible tant que la suite tient dans les rangées
   restantes (au moins une tuile par rangée), et le vide de la rangée va à sa première tuile.

Cas de test (entrée → spans à 1 / 2 / 3 colonnes) :

| Entrée | n = 1 | n = 2 | n = 3 |
|---|---|---|---|
| `[]` | `[]` | `[]` | `[]` |
| `S` | 1 | 2 | 3 |
| `S S` | 1 1 | 1 1 | 2 1 |
| `S S S` | 1 1 1 | **2** 1 1 | 1 1 1 |
| `S S S S` | 1 1 1 1 | 1 1 1 1 | **3** 1 1 1 |
| `S S S S S` | 1 1 1 1 1 | **2** 1 1 1 1 | **2** 1 1 1 1 |
| `S S S S S S S` | 1 … | **2** 1 1 1 1 1 1 | **3** 1 1 1 1 1 1 |
| `L` | 1 | 2 | 3 |
| `L S` | 1 1 | 2 2 | 2 1 |
| `S L` | 1 1 | 2 2 | 1 2 |
| `L L` | 1 1 | 2 2 | 3 3 |
| `L S S` | 1 1 1 | 2 1 1 | 3 2 1 |
| `S L S` | 1 1 1 | 2 2 2 | 3 2 1 |
| `S S L` | 1 1 1 | 1 1 2 | 3 1 2 |
| `S L S S` | 1 1 1 1 | 2 2 1 1 | 1 2 2 1 |
| `L S L` | 1 1 1 | 2 2 2 | 3 1 2 |
| `G` | 1 | 2 | 3 |
| `G S` | 1 1 | 2 2 | 3 3 |
| `S S G` | 1 1 1 | 1 1 2 | 2 1 3 |
| `G S S` | 1 1 1 | 2 1 1 | 3 2 1 |
| `S S G S` | 1 1 1 1 | 1 1 2 2 | 2 1 3 3 |
| `S S G S S S S` | 1 … | 1 1 2 1 1 1 1 | 2 1 3 3 1 1 1 |
| `L S G` | 1 1 1 | 2 2 2 | 2 1 3 |

Plus quatre propriétés, vérifiées par un oracle de force brute (toutes les largeurs de base à n, gardées si les
rangées sont pleines dans l'ordre et chaque `G` seule ; moins de rangées d'abord, puis lexicographique) sur toutes
les suites de `S`/`L`/`G` jusqu'à 7 tuiles et n = 1, 2, 3 — 9 840 cas, sans écart sur le prototype qui a servi à
écrire cette table : même longueur ; base ≤ span ≤ n ; parcourues dans l'ordre, les rangées font exactement n ;
le nombre de rangées est celui du rangement glouton sans élargissement.

### Groupes et empilement

- **Un groupe = une question = un `TileGrid`.** Le titre est un `SectionTitle` (« Cette semaine », « Records ») :
  il nomme le sujet, ne pose pas la question en toutes lettres. Titre obligatoire dès qu'un écran a deux groupes ;
  un groupe seul peut s'en passer quand le titre de l'écran le nomme déjà (l'accueil). Six tuiles au plus par
  groupe : au-delà, c'est une liste.
- Entre deux groupes, et entre un groupe et un autre bloc : `space-y-7`, comme tout bloc d'écran. Entre deux
  tuiles : `gap-3`. Un `TileGrid` ne vit jamais dans une `Card` : chaque tuile est sa propre surface.
- **Empiler** deux chiffres du même sujet dans une `S` (« plancher 8 / plafond auto 11 ») : l'un sous l'autre,
  chacun `metric text-2xl` suivi de sa `caption` (`text-sm`, `--text-2`, qui passe sous le chiffre si la place
  manque) ; entre eux un filet `border-t border-[var(--border)]` sur la largeur du contenu, `pt-2`. Un seul
  libellé, celui du sujet, en bas comme ailleurs. Deux au plus : trois chiffres font une liste (`G`) ou deux tuiles.
  Les tuiles voisines s'étirent à la hauteur de la rangée ; leur libellé reste en bas, sur la ligne des autres.

### La tuile comme lien, la tuile sans donnée

- **Toute la tuile est la cible** (`<button>`, comme `ListRow`) ; rien de touchable à l'intérieur. Pressé :
  `active:bg-[var(--surface-2)]`, `--dur-1`. Focus : le contour global (2 px `--accent-ink`, décalé de 2 px ; le
  `gap-3` lui laisse la place). Sans `onClick`, la tuile est un `<div>` sans état pressé (la séance passée).
- **Nom accessible = ce qu'on voit**, libellé d'abord (« poids du jour 82,4 kg ») : le libellé est premier dans le
  DOM et descend en bas par `order-last`. Pas d'`aria-label` qui remplacerait le chiffre (WCAG 2.5.3) : ce que la
  tuile fait (« Renseigner le poids du jour ») va dans `hint`, lu en description (`aria-describedby`).
- **En lecture** (`value === undefined`, la convention de `useLiveQuery`) : la tuile se dessine avec son libellé
  et une ligne de chiffre vide à sa hauteur ; rien qui saute sous le pouce quand la valeur arrive.
- **Sans donnée**, la règle d'`EmptyState` : un compte qui vaut zéro s'affiche `0` (+ unité) — ce n'est pas une
  absence, c'est une jauge à zéro, et l'appelant passe `'0'`. Une mesure jamais prise (`value === null` : aucune
  pesée, aucun 1RM) montre `—` en `--text-2`, masqué aux lecteurs d'écran au profit de « aucune mesure »
  (`fr.ts`) ; la tuile reste un lien, vers là où la mesure se prend. Quand toutes les tuiles d'un écran
  montreraient un tiret, l'écran montre son `EmptyState` à la place de la grille.

### TTY1 et Cyber

- La tuile porte `rounded-2xl` : TTY1 lui donne son cadre d'un pixel, Cyber sa plaque (filet, équerres) ; le
  pressé de TTY1 est la vidéo inverse de tout bouton.
- TTY1 : le libellé d'une `G` porte `data-part="legend"` et se pose sur le filet du haut, comme le titre d'une
  carte ; le filet d'empilement (`data-part="tile-split"`) rejoint la règle des pointillés de `[data-part='row']`.
- Cyber, deux règles à écrire dans `cyber.css` : la hachure du coin (88 × 26 px) passe à 44 × 12 px sur
  `[data-part='tile']`, sinon elle court sous le chiffre d'une tuile de 173 px ; et
  `[data-part='tile']:active { background-color: var(--surface-2) }` — la plaque pose sa couleur hors couche,
  elle écraserait l'utilitaire `active:` et la tuile pressée ne bougerait pas.
- Aucune animation propre : ni la tuile ni le changement de colonnes ne transitionnent.

### Contrat des composants

```ts
// src/ui/Tile.tsx
export type TileValue = {
  value: string;          // déjà formaté (formatNumber…), jamais un number
  unit?: string;          // `text-sm font-semibold --text-2`, après une espace
  caption?: string;       // empilement seulement : « plancher »
  spoken?: string;        // ce que lit un lecteur d'écran quand le chiffre se lit mal (« 3 sur 4 »)
};
type Common = { label: string; onClick?: () => void; hint?: string };
export type TileProps =
  | (Common & { size: 'S'; value: TileValue | readonly [TileValue, TileValue] | null | undefined })
  | (Common & { size: 'L'; value: TileValue | null | undefined; detail?: string })
  | (Common & { size: 'G'; value: TileValue | null | undefined; detail?: string; children: ReactNode });

// src/ui/TileGrid.tsx
type TileGridProps = {
  title?: string;         // un SectionTitle ; la section est nommée par lui (aria-labelledby)
  children: ReactNode;    // des éléments qui portent chacun `size` : Tile, ou un composant qui la transmet
};
```

- **`Tile`** : `<button type="button">` ou `<div>`, `data-part="tile"`, `data-size`. Classes : `flex h-full w-full
  min-w-0 flex-col gap-2 rounded-2xl bg-[var(--surface-1)] p-4 text-left` + `min-h-20` (`S`, `L`) ou `min-h-40`
  (`G`). Enfants **phrasing** seulement (`span`, `svg`) : un `<button>` n'accepte ni `div` ni `ul`, d'où une liste
  courte écrite en `span.block`. Chiffre : `metric text-2xl leading-none font-semibold text-[var(--text-1)]
  whitespace-nowrap`. Libellé : `label-xs order-last mt-auto font-semibold text-[var(--text-2)]` (en haut pour
  une `G`). `hint` : un `span.sr-only` dont l'id (`useId`) nourrit `aria-describedby`.
- **`TileGrid`** : `<section className="@container" aria-labelledby>` ; `SectionTitle` reçoit pour cela une prop
  `id?: string`. Puis `<ul role="list" className="grid grid-cols-1 gap-3 @min-[15.5rem]:grid-cols-2
  @min-[30rem]:grid-cols-3">` (`role="list"` : WebKit tait une liste sans puces). Chaque enfant dans un
  `<li className="flex min-w-0 col-span-(--tile-span-1) @min-[15.5rem]:col-span-(--tile-span-2)
  @min-[30rem]:col-span-(--tile-span-3)">` dont le `style` porte les trois spans de `placeTiles`. Les tailles se
  lisent sur `Children.toArray(children)` (un enfant conditionnel absent sort du placement) ; un enfant sans `size`,
  ou un fragment, lève une erreur : une tuile qu'on ne sait pas placer est un bogue, pas un repli.
- E2E : `mise-en-page.spec.ts` couvre déjà `/analytics` dans les quatre thèmes ; il gagne une assertion par grille
  — le bord droit de sa dernière tuile touche celui de la grille (pas de trou) à 390 px, 100 / 130 / 200 %.

**Migration de `HomeStatsIsland`.** La `Card` à deux cellules et son `Tile` local disparaissent au profit d'un
`TileGrid` sans titre et de deux `Tile size="S"` : la semaine (`{ value: '2 / 4', spoken }`, `spoken` lu
dans `fr.ts` : « 2 sur 4 » ; `hint` = `home.weekLink`) et le poids (`{ value: formatNumber(kg), unit: 'kg' }`, `null` sans pesée, `undefined`
en lecture, `hint` = `home.weightLink`). Ce qui change à l'œil : deux plaques séparées de 12 px au lieu d'une
bande coupée d'un filet, et une seule colonne à partir de 140 % de police sur 390 px, là où la bande serrait. Les
tests qui cherchaient le bouton par `name: 'Renseigner le poids du jour'` le cherchent par `description` : le
nom est désormais la valeur lue, et c'est le but.

## Motifs de la finition v3.0

- **Tonnage** : toujours groupé (« 10 872 kg », `groupedNumber`), jamais `formatNumber`, qui est un formateur de champ.
- **Fin de séance et détail de séance** : un même `TileGrid` « Totaux » (Durée, Tonnage, Séries de travail, Répétitions).
- **Carte d'exercice en séance** : boutons d'icône en `w-[48px]`, nom sur deux lignes au plus.
- **Relevés « N exercices · N séries »** : `metric text-sm`, jamais en capitales `label-xs`.
- **Deux boutons ou deux puces côte à côte** : `grid-cols-[repeat(auto-fit,minmax(min(Nrem,100%),1fr))]`, qui
  s'empilent à 200 % ; le `min(…,100%)` est indispensable dans une carte étroite.

## À respecter / à éviter

- Respecter : jetons seuls ; `--text-2` pour tout petit libellé ; 48 px minimum ; un `Card` pour tout bloc ; une `ActionBand` par écran ; `metric` sur tout chiffre ; textes via `src/i18n/fr.ts`.
- Éviter : hex ou `rgba` en dur dans un composant ; `--text-3` pour du lisible ; `--accent-fill` en texte ; ombres ; `sticky` par-dessus le contenu ; un nouveau geste d'animation (`animate-pulse` compris) ; un nouveau motif quand `Card`/`ListRow`/`ChoiceChip` suffisent.

## Responsive

**Portrait uniquement.** L'APK (`android:screenOrientation="portrait"`) et la PWA (`orientation: 'portrait'` du
manifeste, `vite.config.ts`) sont verrouillés : aucun écran n'a de variante paysage, et aucune n'est à écrire.

- Mobile seulement, mesuré à 390 px (E2E) et 375 px (leçons des titres). Une colonne d'écran, `max-w-[36rem]`
  centrée : au-delà de 576 px (tablette, fenêtre de bureau), l'app reste un téléphone au milieu.
- **La largeur se gagne en colonnes de tuiles, pas en colonnes d'écran.** Seul `TileGrid` lit la largeur, par
  requête de conteneur en `rem` (« Grille modulaire ») : 1 colonne sous 15,5 rem de conteneur, 2 jusqu'à 30, 3
  au-delà. La police compte autant que l'écran : 390 px à 100 % donne deux colonnes, à 200 % une seule ; 576 px
  donne trois colonnes à 100 %, deux à 200 %. Les lignes, les cartes et les feuilles ne changent pas avec la largeur.
- Doit tenir sans débordement à 200 % de taille de police : d'où les `grid-cols-2` de quatre boutons, les cibles en
  pixels CSS, et les colonnes de tuiles qui tombent. Exception consignée : TTY1, police bitmap à tailles fixes, est
  mesuré jusqu'à 130 % seulement (`e2e/mise-en-page.spec.ts`, `decisions-et-pieges.md`) — la grille y tombe
  pareil, c'est la barre du bas qui ne tient pas.

## Écarts constatés

Relevés le 2026-11-21 sur la v2.18 ; **traités le même jour** sur la branche de la v3.0 (fondations).
Les constats ci-dessous sont gardés tels qu'écrits, avec leur décision ; l'état de chacun :

| # | État |
|---|---|
| 1 | Corrigé : les trois liens du corps sont des `ListRow`. |
| 2 | **Reste** : Progression passe en tuiles avec la page d'objet (étape 7 de `cartographie.md` §7, maquette validée). |
| 3 | Corrigé : `ui/Tile`, `ui/TileGrid`, `ui/tileLayout` ; `HomeStatsIsland` migré. |
| 4 | Corrigé pour 15 surfaces (`Card` gagne une `className` de placement seulement). **Laissés exprès** : les cartes du wiki et de la documentation en `p-5`, les articles à barre d'accent, un `<details>`, deux `rounded-xl`. |
| 5 | Corrigé pour les deux listes de programmes. **Laissés exprès** : un `<details>` dont le filet délimite le panneau, les blocs `role="status"` dont le filet dit l'état, les cartes `p-5` du wiki. |
| 6 | Corrigé : `ui/Segmented` (4 écrans), `ui/Tabs` (Historique, fiche exercice, Planifier — soulignement validé par l'utilisateur). |
| 7 | Corrigé en `text-xs` (aucun de ces textes n'est en majuscules, donc pas `label-xs`). **Exception** : les libellés de `BottomNav` restent en `text-[11px]`, en pixels exprès — en `rem`, « Progression » sort de l'écran à 200 % (`mise-en-page.spec.ts`). |
| 8 | Corrigé. |
| 9 | Corrigé : `--warn-ink` dans les quatre thèmes, cinq usages basculés, `@theme` nettoyé. |
| 10 | **Laissés exprès** : `stores/theme.ts` (couleur de barre système avant le CSS) ; les défauts de `muscleMap.ts`, inatteignables (`MuscleMapView` passe des jetons) et exigés en hex par `mixHex` ; les replis de `ChartExportAction`, qui dessine sur un canevas. |
| 11 | `TutorialHud` supprimé avec le tutoriel (v2.19). **Laissés exprès** : l'anneau de `RecordRail` (il découpe le rail derrière le marqueur, ce n'est pas une profondeur) ; les ombres de `cyber.css` (halo, biseaux, liserés) et de `tty1.css` (focus), qui sont la grammaire de ces thèmes ; l'anneau du curseur RPE d'`index.css`. |
| 12 | Corrigé : `ui/Skeleton`, immobile ; les 18 `animate-pulse` remplacés, la zone en `aria-busy`. |

1. **Tuiles qui ne montrent qu'un nom** — `src/features/home/HomeBodyCard.tsx:65-77` : trois cellules de grille (`LINKS`) avec seulement un libellé, `min-h-14`. Contredit « pas de tuile qui ne montre qu'un nom » ; ce sont des liens, donc des lignes.
2. **Progression › vue d'ensemble en lignes** — `src/features/analytics/AnalyticsScreen.tsx:51-111` : sept `ListRow` titre + sous-titre, aucun chiffre. L'exemple même de la règle (tableau de bord → tuiles) est aujourd'hui une liste de liens.
3. **Tuile non partagée, dupliquée en esprit** — `HomeStatsIsland.tsx:84` définit `Tile` en local ; `HomeBodyCard.tsx:65` réécrit une cellule voisine à la main. Aucun composant `ui/` pour le motif que la règle rend officiel.
4. **`Card` réécrite à la main** — `features/settings/SettingsScreen.tsx:207` (`rounded-2xl bg-[var(--surface-1)] p-4`, soit `Card padded`) ; `features/exercises/ExerciseDocumentationView.tsx:45,97,177` (même surface en `p-5`, hors échelle de `Card`).
5. **Variante de carte avec filet** — `features/programs/ProgramListScreen.tsx:121`, `ProgramWeeksStep.tsx:123` : `overflow-hidden rounded-2xl border` au lieu de `Card` ; `SelectionReview.tsx:16` idem. Le thème sombre dit « surfaces pleines et sans bordure » (`AddRow.tsx`).
6. **Trois motifs d'onglets/segments** — `planning/PlanningTabs.tsx:25` (segmenté, aplat d'accent), `settings/SettingsScreen.tsx:213` (segmenté en grille 2×2), `history/HistoryScreen.tsx:162-166` (onglets à soulignement). Pas de composant `ui/` ; contredit « un même type d'écran utilise un même motif ».

   **Décision :** deux composants, parce que choisir une valeur et changer de vue sont deux gestes : l'un modifie une donnée, l'autre déplace le regard. Les Réglages réécrits (v2.19) n'en ont plus ; les motifs vivent dans les fichiers cités ci-dessous.
   - **`ui/Segmented`** — choisir une valeur parmi deux à quatre. `{ label: string; value: V; options: readonly { value: V; label: string; locked?: { describedBy: string; icon?: ReactNode } }[]; onChange: (value: V) => void; inline?: boolean }`, `V extends string | number`. `role="radiogroup"`, options `role="radio"` + `aria-checked`, flèches gauche/droite qui déplacent et choisissent, une seule option dans la tabulation (motif radio de l'APG). Dessin actuel : `data-part="segmented"`, gouttière `rounded-xl bg-[var(--surface-2)] p-1 gap-1`, option `min-h-12 rounded-lg text-base font-semibold [overflow-wrap:anywhere]`, choisie en aplat d'accent, les autres en `--text-2`. Deux ou trois options : une rangée ; quatre : deux rangées de deux, par règle et non par prop (quatre sur une ligne débordent à 200 %) ; au-delà, `OptionSheet`. `inline` : largeur intrinsèque, à côté d'un intitulé (Oui / Non). Une option verrouillée reste focalisable (`aria-disabled`, sa raison en `aria-describedby`). Remplace `settings/AppearanceSettingsScreen.tsx:32` (thème, avec TTY1 verrouillé), `settings/AnnouncerSettings.tsx:79`, `routines/RoutineSetSheet.tsx:116`, `exercises/ExerciseFormScreen.tsx:341` (`inline`).
   - **`ui/Tabs`** — passer d'une vue à l'autre du même objet, ou entre routes sœurs. Deux formes, un dessin. `{ label; value: V; items: readonly { value: V; label: string }[]; onChange; children }` rend `role="tablist"`, des `role="tab"` + `aria-selected` + `aria-controls`, les flèches, et le `role="tabpanel"` qui enveloppe `children`. `{ label; items: readonly { to: string; label: string }[] }` rend un `<nav>` de `Link` à `aria-current="page"` (actif : chemin courant ou sous-chemin) : un onglet qui change l'URL est une navigation, pas un `tablist`. Dessin de l'Historique : colonnes égales, `min-h-12`, `text-base font-semibold`, courant en `--accent-ink` avec le repère de 3 px de `BottomNav`, les autres en `--text-2` ; `data-part="tabs"`, dont les crochets TTY1 s'étendent à `aria-selected` et `aria-current`. Remplace `history/HistoryScreen.tsx:156` (journal / calendrier, aujourd'hui des `aria-pressed` dans un `group`), `exercises/ExerciseDetailScreen.tsx:201` (Suivi / Documentation, aujourd'hui un segmenté) et `planning/PlanningTabs.tsx` (forme route). `data-part="segmented"` ne marque plus que des valeurs : ses règles TTY1 et Cyber perdent les sélecteurs `aria-current`, `aria-selected`, `aria-pressed`.
   - Hors des deux : les boutons à `aria-pressed` posés côte à côte (recette de bloc, jour d'une séance, RPE, cadence), qui sont des `ChoiceChip`.

7. **Corps de micro-libellé hors `label-xs`** — `text-[0.6875rem]` (11 px) en dur : `ui/RestPicker.tsx:99`, `ui/NumberInput.tsx:128`, `routines/RoutineExerciseCard.tsx:35`, `workout/SetValueCell.tsx:43`, `workout/WorkoutExerciseCard.tsx:488`, `workout/PaceSheet.tsx:109` ; `app/BottomNav.tsx:67` en `text-[11px]`. `label-xs` fait 12 px.
8. **Commentaire périmé** — `ui/SectionTitle.tsx:3` parle de 11 px et de `#a1a1aa` ; le composant rend du `label-xs` (12 px) en `--text-2`.
9. **Jetons non thémés** — `src/index.css:15-16` : `--color-danger` (`#ff5c5c`) et `--color-warn` (`#ffb020`) figés dans `@theme`, hors des quatre blocs ; `--color-danger` n'est cité nulle part, `--color-warn` seulement par `app/Boot.tsx:196`. Le rouge d'erreur réel est `--danger-ink`.

   **Décision :** `--color-danger` et `--color-warn` sortent de `@theme` (le premier n'a aucun usage). Un jeton thémé les remplace, **`--warn-ink`**, posé dans les quatre blocs (`:root`, clair, `tty1.css`, `cyber.css` : les tests de noms l'exigent). Pas de `--warn-soft` : le seul bandeau, `SeedErrorBanner`, est une `--surface-2` à filet, et le rappel de sauvegarde est une `Card`. Valeurs, contrastes WCAG (formule de `cyber.test.ts`) et distance à l'accent et au danger (ΔE CIE76) :

   | Thème | `--warn-ink` | sur `--surface-0` | sur `--surface-1` | sur `--surface-2` | ΔE accent / danger |
   |---|---|---|---|---|---|
   | Sombre | `#f5c518` | 11,6:1 | 10,8:1 | 9,7:1 | 43 / 77 |
   | Clair | `#7a5c00` | 5,9:1 | 6,3:1 | 5,5:1 | 33 / 55 |
   | TTY1 | `#ffff55` (ANSI 11) | 19,7:1 | 19,7:1 | 16,0:1 | 57 / 100 |
   | Cyber | `#ff9f1c` | 9,5:1 | 9,0:1 | 8,1:1 ; plaque sur halo 8,9:1 | 49 / 73 |

   Sombre : un jaune, pas l'ambre `#ffb020`, trop près de l'orange de l'accent. Cyber : un orange, puisque le jaune agit et le rouge encadre. `cyber.test.ts` et `tty1.test.ts` gagnent `['--warn-ink', '--surface-1', 4.5]`. Basculent vers `--warn-ink` : `app/Boot.tsx:196` (filet du bandeau de catalogue, depuis `--color-warn`) ; `settings/SettingsScreen.tsx:55` (« Aucune sauvegarde sur cet appareil ») ; `settings/RecordRepairAction.tsx:48` (« Recalcul nécessaire ») ; `programs/ProgramSessionList.tsx:145` (« La routine prévue … n'existe plus ») ; `programs/ProgramActionsSheet.tsx:83` (« Le bloc a déjà commencé… »). Restent en `--danger-ink` les échecs, dont `home/HomeBackupNudge.tsx:72` : ce n'est pas le rappel, c'est « La sauvegarde n'a pas pu être enregistrée », une écriture ratée. Le rappel lui-même reste en `--text-2` : « factuel, jamais une alarme » (`fr.ts`).

10. **Hex en dur hors CSS** — `stores/theme.ts:16-19` (couleur de barre système ; dupliqué de `--surface-0`, tenu par `themeBootScript.test.ts`) ; `ui/muscleMap/muscleMap.ts:54-57` (quatre couleurs de la silhouette, non thémées) ; `features/analytics/ChartExportAction.tsx:41-43` (replis hex des jetons).
11. **Ombres et `rgba` en dur** — `features/tutorial/TutorialHud.tsx:92,110` (`rgba(0,0,0,…)`) ; seules ombres du dépôt, alors que la profondeur se fait par surfaces ; aucun jeton. `RecordRail.tsx:124,126` : halo en `var(--surface-0)` (propre, mais hors vocabulaire).
12. **Squelettes dupliqués et hors des quatre gestes** — `h-NN animate-pulse rounded-2xl bg-[var(--surface-1)]` répété une quinzaine de fois (`history/HistoryJournal.tsx:121`, `HistoryDetailScreen.tsx:73`, `HevyImportScreen.tsx:298`, `benchmark/BenchmarkScreen.tsx:59`…) sans composant ; `animate-pulse` n'est pas l'un des quatre gestes déclarés dans `index.css:19-38`.

   **Décision :** **`ui/Skeleton`, immobile** : ni `animate-pulse`, ni fondu, ni geste nouveau. Les lectures sont locales et répondent en quelques millisecondes : une pulsation de deux secondes n'y fait jamais un cycle, ce n'est qu'un clignement, un cinquième geste pour rien, que le mouvement réduit fige déjà. Ce qui informe, c'est la place gardée (précédent : la trame vide de `HomeBodyCard`, « jamais un spinner ») ; ce qui la remplace arrive avec son `animate-rise` là où il en a un. API : `{ height: 'h-14' | 'h-16' | 'h-20' | 'h-24' | 'h-28' | 'h-40' | 'h-44' | 'h-52' | 'h-64' | 'h-72' | 'h-80'; shape?: 'plate' | 'row' }`, des classes littérales que Tailwind trouve dans la source. `plate` (défaut) : `rounded-2xl bg-[var(--surface-1)]`, la forme d'une `Card` (cadre en TTY1, plaque vide en Cyber) ; `row` : `border-b border-[var(--border)]`, une ligne de feuille. Toujours `aria-hidden="true"` ; la zone qui attend porte `aria-busy="true"`. Remplace les 18 occurrences de 9 fichiers (`grep -rn animate-pulse src`), y compris les deux `rounded-xl` de `records/RecordsScreen.tsx:140-141`, qui deviennent des plaques. Une tuile en lecture n'est pas un squelette : elle se dessine avec son libellé (« Grille modulaire »).
