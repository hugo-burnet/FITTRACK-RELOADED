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
| `--surface-0` (page) | `#12110f` | `#f7f8f6` | `#000000` | `#0b0c12` |
| `--surface-1` (cartes, lignes) | `#1b1916` | `#ffffff` | `#000000` + filet | `#12131c` |
| `--surface-2` (champs, éléments levés) | `#25221e` | `#eef1ec` | `#1c1c1c` | `#1c1d29` |
| `--border` | `#3a352f` | `#d9e0d8` | `#555555` | `#5a2328` |
| `--text-1` | `#f5f3f0` (17,0:1) | `#182019` (15,7:1) | `#ffffff` | `#e8f3f3` (17,2:1) |
| `--text-2` | `#b9b1a8` (8,9:1) | `#5c675e` (5,9:1) | `#aaaaaa` | `#ff6b63` (6,6:1) |
| `--text-3` (réservé) | `#7e766d` | `#8e998f` | `#555555` | `#7d3b3b` |
| `--accent-fill` | `#ff8a3d` | `#b54708` | `#55ff55` | `#fcee0a` |
| `--accent-fill-pressed` | `#ffa15f` | `#93370d` | `#aaffaa` | `#fff56b` |
| `--accent-on-fill` | `#21130a` (7,7:1) | `#ffffff` | `#000000` | `#0b0c12` (16,2:1) |
| `--accent-ink` | `#ff8a3d` | `#93370d` | `#55ff55` | `#fcee0a` |
| `--accent-soft` | `#3a2115` | `#ffedd5` | `#00260b` | `#2b2a0c` |
| `--accent-data` | `#a85a20` | `#b96b35` | `#00aa00` | `#2fc6d6` |
| `--axis` | `#756e64` | `#869087` | `#878787` | `#a5524f` |
| `--danger-ink` | `#ff5c5c` (5,8:1) | `#b91c1c` (6,5:1) | `#ff5555` | `#ff2e63` |
| `--scrim` | `rgb(0 0 0 / 0.6)` | (hérite du sombre) | `rgb(0 0 0 / 0.72)` | `rgb(5 5 9 / 0.75)` |

Jetons propres à Cyber : `--cyber-focus` `#5ef6ff`, `--cyber-crit` `#ff3c46`, `--cyber-line`.
Jetons exposés à Tailwind (`@theme`) : `--color-accent` (= `--accent-fill`), `--color-accent-dim`
(= `--accent-fill-pressed`), `--color-accent-fg` (= `--accent-on-fill`).

**Rôles**
- **Aplat d'accent** (`--color-accent` + `--color-accent-fg`) : l'action, la valeur choisie, l'onglet engagé.
- **Encre d'accent** (`--accent-ink`) : l'accent *en texte ou en filet sur une surface*. Jamais `--accent-fill` en texte : il rate le contraste en clair, d'où deux jetons.
- **`--accent-soft`** : un *mode* choisi (« Aucun »), un état pressé, le flash d'une ligne qui bouge. Subordonné à l'aplat.
- **`--accent-data` / `--axis`** : séries ordinaires et ligne de base d'un graphique (≥ 3:1) ; l'encre d'accent reste la série mise en avant.
- **`--danger-ink`** : texte destructif sur surface, jamais un aplat. Ne s'appuie jamais sur la couleur seule : le mot reste.
- **Règle des petits libellés : `--text-2`, jamais `--text-3`.** Tout micro-libellé, placeholder, valeur lue ou relevé est en `--text-2`. `--text-3` est *réservé* (écho non lisible) ; il rate 3:1 en clair. Aucun composant ne l'emploie aujourd'hui.
- Focus : contour 2 px `--accent-ink` (Cyber : `--cyber-focus`), décalé de 2 px.

Thèmes : **Sombre** chaud et orange, défaut. **Clair** vert-gris, accent brique. **TTY1** console Linux
(noir pur, vert ANSI, police bitmap, coins carrés, déblocable). **Cyber** rouge qui encadre, jaune qui
agit, cyan qui compte ; coins coupés (`corner-shape: bevel`) ; repli propre sur les arrondis du sombre.

## Typographie

- Famille : `--font-sans` = `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. TTY1 : `--tty1-16` (Terminus, quatre tailles natives 12/16/24/32 px, sans flou). Cyber : `'Cyber Sans'` (Rajdhani, chiffres de chasse égale), un cran plus grand (`--text-xs` 0.8125rem, `--text-sm` 0.9375rem, `--text-base` 1.0625rem, `--text-lg` 1.1875rem).
- Échelle : celle de Tailwind (`text-xs` … `text-7xl`). Usages réels : titre d'écran `text-2xl font-semibold tracking-tight` (une ligne, tronquée) ; corps et ligne `text-base` ; sous-titre `text-sm` en `--text-2` ; bande d'action `text-lg font-semibold` ; chiffre d'une tuile `text-2xl` ; état vide `text-7xl`.
- Utilitaires maison : `label-xs` (0.75rem, interligne 1.35, +0.06em, majuscules — le registre « gravé », toujours `--text-2`) ; `tabular` (chiffres tabulaires) ; `metric` (tabulaires, −0.03em : toute valeur qui se compare ou change) ; `record-figure` (monospace, −0.035em : chiffres de records).
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
| `Screen` | Cadre de tout écran : titre, flèche retour (`onBack`), `action` (icône), `sub` (instruments épinglés), `footer` (une `ActionBand`). |
| `BottomNav` | Cinq onglets, `min-h-14`, repère `--accent-ink` de 3 px en haut de l'onglet courant. Hors du défilement. |
| `Card` | La seule surface levée. `padded` seulement si elle contient du contenu libre ; vide de padding autour de `ListRow`. |
| `ListRow` | Une entrée qui est un lien, ou dont l'état tient en un mot : titre + sous-titre + `trailing`. Empilée dans une `Card`. |
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

## Règle de mise en page : tuile ou ligne

Décidée avec l'utilisateur le 2026-11-21.

**Tuile ou ligne.** Une *tuile* est une entrée qui affiche un chiffre ou un état chiffré à lire d'un coup d'œil (un tableau de bord : Progression › vue d'ensemble). Une *ligne* est une entrée qui n'est qu'un lien, ou dont l'état tient en un mot (Réglages, Planifier, Exercices, Historique). Pas de tuile qui ne montre qu'un nom. Un même type d'écran utilise un même motif.

Motifs existants : la ligne est `ListRow` dans une `Card`. La tuile n'a pas de composant partagé ; son
seul exemple propre est `Tile` dans `src/features/home/HomeStatsIsland.tsx:84` (valeur `metric text-2xl`
+ libellé `label-xs`, `min-h-20`, cellules de grille séparées par `border-l`).

## À respecter / à éviter

- Respecter : jetons seuls ; `--text-2` pour tout petit libellé ; 48 px minimum ; un `Card` pour tout bloc ; une `ActionBand` par écran ; `metric` sur tout chiffre ; textes via `src/i18n/fr.ts`.
- Éviter : hex ou `rgba` en dur dans un composant ; `--text-3` pour du lisible ; `--accent-fill` en texte ; ombres ; `sticky` par-dessus le contenu ; un nouveau geste d'animation ; un nouveau motif quand `Card`/`ListRow`/`ChoiceChip` suffisent.

## Responsive

Mobile seulement, mesuré à 390 px (E2E) et 375 px (leçons des titres). Colonne unique, `max-w-[36rem]` centrée.
Doit tenir sans débordement dans les quatre thèmes à 200 % de taille de police : d'où les `grid-cols-2` de
quatre boutons et les cibles en pixels CSS.

## Écarts constatés

Rien n'a été corrigé. 12 écarts.

1. **Tuiles qui ne montrent qu'un nom** — `src/features/home/HomeBodyCard.tsx:65-77` : trois cellules de grille (`LINKS`) avec seulement un libellé, `min-h-14`. Contredit « pas de tuile qui ne montre qu'un nom » ; ce sont des liens, donc des lignes.
2. **Progression › vue d'ensemble en lignes** — `src/features/analytics/AnalyticsScreen.tsx:51-111` : sept `ListRow` titre + sous-titre, aucun chiffre. L'exemple même de la règle (tableau de bord → tuiles) est aujourd'hui une liste de liens.
3. **Tuile non partagée, dupliquée en esprit** — `HomeStatsIsland.tsx:84` définit `Tile` en local ; `HomeBodyCard.tsx:65` réécrit une cellule voisine à la main. Aucun composant `ui/` pour le motif que la règle rend officiel.
4. **`Card` réécrite à la main** — `features/settings/SettingsScreen.tsx:207` (`rounded-2xl bg-[var(--surface-1)] p-4`, soit `Card padded`) ; `features/exercises/ExerciseDocumentationView.tsx:45,97,177` (même surface en `p-5`, hors échelle de `Card`).
5. **Variante de carte avec filet** — `features/programs/ProgramListScreen.tsx:121`, `ProgramWeeksStep.tsx:123` : `overflow-hidden rounded-2xl border` au lieu de `Card` ; `SelectionReview.tsx:16` idem. Le thème sombre dit « surfaces pleines et sans bordure » (`AddRow.tsx`).
6. **Trois motifs d'onglets/segments** — `planning/PlanningTabs.tsx:25` (segmenté, aplat d'accent), `settings/SettingsScreen.tsx:213` (segmenté en grille 2×2), `history/HistoryScreen.tsx:162-166` (onglets à soulignement). Pas de composant `ui/` ; contredit « un même type d'écran utilise un même motif ».
7. **Corps de micro-libellé hors `label-xs`** — `text-[0.6875rem]` (11 px) en dur : `ui/RestPicker.tsx:99`, `ui/NumberInput.tsx:128`, `routines/RoutineExerciseCard.tsx:35`, `workout/SetValueCell.tsx:43`, `workout/WorkoutExerciseCard.tsx:488`, `workout/PaceSheet.tsx:109` ; `app/BottomNav.tsx:67` en `text-[11px]`. `label-xs` fait 12 px.
8. **Commentaire périmé** — `ui/SectionTitle.tsx:3` parle de 11 px et de `#a1a1aa` ; le composant rend du `label-xs` (12 px) en `--text-2`.
9. **Jetons non thémés** — `src/index.css:15-16` : `--color-danger` (`#ff5c5c`) et `--color-warn` (`#ffb020`) figés dans `@theme`, hors des quatre blocs ; `--color-danger` n'est cité nulle part, `--color-warn` seulement par `app/Boot.tsx:196`. Le rouge d'erreur réel est `--danger-ink`.
10. **Hex en dur hors CSS** — `stores/theme.ts:16-19` (couleur de barre système ; dupliqué de `--surface-0`, tenu par `themeBootScript.test.ts`) ; `ui/muscleMap/muscleMap.ts:54-57` (quatre couleurs de la silhouette, non thémées) ; `features/analytics/ChartExportAction.tsx:41-43` (replis hex des jetons).
11. **Ombres et `rgba` en dur** — `features/tutorial/TutorialHud.tsx:92,110` (`rgba(0,0,0,…)`) ; seules ombres du dépôt, alors que la profondeur se fait par surfaces ; aucun jeton. `RecordRail.tsx:124,126` : halo en `var(--surface-0)` (propre, mais hors vocabulaire).
12. **Squelettes dupliqués et hors des quatre gestes** — `h-NN animate-pulse rounded-2xl bg-[var(--surface-1)]` répété une quinzaine de fois (`history/HistoryJournal.tsx:121`, `HistoryDetailScreen.tsx:73`, `HevyImportScreen.tsx:298`, `benchmark/BenchmarkScreen.tsx:59`…) sans composant ; `animate-pulse` n'est pas l'un des quatre gestes déclarés dans `index.css:19-38`.
