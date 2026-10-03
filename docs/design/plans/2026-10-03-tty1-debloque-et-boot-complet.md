# TTY1 à débloquer, ouverture complète — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** TTY1 se débloque à la première console rare jouée jusqu'au bout (ou d'office après 30 jours
d'usage, ou si le thème mémorisé l'est déjà), et son ouverture devient un démarrage complet tiré au
sort à chaque lancement : GRUB, noyau, services, vérifications, interlude DOS, une fonction réelle de
l'app qui s'affiche sans explication et dont la validation lance l'app.

**Architecture :** un petit store sans React (`stores/skinUnlock.ts`) et un dépôt d'une fonction
(`getFirstUseAt`) pour le déblocage ; la console rare gagne deux lignes ; l'ouverture TTY1 devient un
**script** (`bootTty1Script.ts`, pur, tiré une fois par `main.tsx`) que `BootScreen` rend au fil d'une
horloge dans une colonne ancrée en bas. Les textes sont des nœuds de `fr.ts` énumérés par `tAll`.

**Tech Stack :** React 19 + TypeScript strict, Tailwind CSS v4, Vitest + Testing Library +
`fake-indexeddb`. Aucune dépendance de plus.

**Spec :** `docs/design/specs/2026-10-03-tty1-debloque-et-boot-complet-design.md`

**Prérequis :** `docs/design/plans/2026-10-03-skin-tty1.md` (fait, v2.8.0).

## Global Constraints

- Code, noms de fichiers et de variables en **anglais** ; interface en **français**, tous les textes
  dans `src/i18n/fr.ts`. Un commentaire dit *pourquoi*, jamais *quoi*.
- Local-first : rien ne demande le réseau. Aucun secret dans le bundle. Aucune table, aucun index,
  aucune version de schéma, aucun changement d'export.
- Accès aux données **uniquement** par `src/data/repositories/*` : `main.tsx` n'importe pas `db`.
- Une ligne de console fait **41 caractères au plus** (téléphone de 360 px, police 16 px).
- `src/index.css` n'est touché que pour les deux délais de la révélation (Task 4) : `Boot.test.tsx`
  y lit des blocs par ancres. Les règles de l'ouverture TTY1 restent dans `src/styles/tty1.css`
  (décision du 2026-10-03, voir « Dette technique assumée »).
- Le dictionnaire n'a pas de tableaux : les listes sont des nœuds de chaînes, lus par `tAll`.
- TDD pour tout ce qui a une logique (Tasks 1 à 8). L'affichage pur (CSS) se vérifie à l'œil, en
  captures de Chromium (Task 10).
- À la fin de **chaque** tâche : `npm run typecheck`, `npm run lint`, `npm run test:run` verts avant
  le commit ; `npm run build` à la fin des Tasks 4, 8 et 10.
- Branche de la session, commits atomiques en français avec le scope `tty1`. Pas de PR sans demande,
  jamais de `push --force`. **Pas de fusion dans `master`, pas de tag, pas de version** avant
  l'accord explicite de l'utilisateur : celui de la v2.8.0 ne valait que pour elle.
- REQUIRED SUB-SKILL : `test-driven-development` pour les Tasks 1 à 8 ;
  `verification-before-completion` avant toute annonce de réussite et tout push.

## État de départ (mesuré le 2026-10-03)

- `master` et la branche de session sont à `a326b97` ; v2.8.0 publiée.
- `selectBootVariant(storage, now, random, theme)` renvoie `'tty1'` pour le thème TTY1 ;
  `BOOT_HOLD_MS` = `{ normal: 2180, console: 3360, tty1: 2180 }` ; `BootConsole` rend quatre
  `.boot-console-line`, l'invite, la commande et le curseur ; `BootTty1` rend les quatre lignes, l'invite
  et la devise avec des délais CSS par `nth-child`.
- `fr.ts` n'a aucun tableau ; `t()` ne résout que des feuilles de type chaîne ; `fr` n'est pas exporté.
- `seedDatabase` crée les exercices du catalogue avec `newEntity` : leur `createdAt` est celui du
  premier lancement. Aucun index sur `createdAt`.
- `Boot.test.tsx` lit `index.css` par ancres (`" * L'ouverture de l'app."`, `'.boot-console {'`) et
  `tty1.css` pour la règle de mouvement réduit.

## Carte des fichiers

**Créés :** `src/stores/skinUnlock.ts` (+ test), `src/data/repositories/firstUse.ts` (+ test),
`src/app/bootTty1Script.ts` (+ test), `src/app/bootFacts.ts` (+ test), `src/app/useBootClock.ts`
(+ test), `src/platform/reducedMotion.ts` (+ test), `src/i18n/fr.tAll.test.ts`.

**Modifiés :** `src/app/bootEasterEgg.ts` (+ test), `src/app/Boot.tsx` (+ test), `src/main.tsx`,
`src/features/settings/SettingsScreen.tsx` (+ test), `src/i18n/fr.ts`, `src/index.css` (huit lignes),
`src/styles/tty1.css`, `PROGRESS.md`, `docs/progress/decisions-et-pieges.md`.

---

### Task 1 : le coffre du déblocage

**Files:**

- Create: `src/stores/skinUnlock.ts`, `src/stores/skinUnlock.test.ts`
- Modify: `src/app/bootEasterEgg.ts` (exporte le type du stockage et `BOOT_EASTER_EGG_MAX_DELAY_DAYS`)

**Interfaces:**

- Produces: `TTY1_UNLOCK_KEY`, `SEASONED_AFTER_DAYS`, `isTty1Unlocked(storage)`, `unlockTty1(storage)`,
  `unlockTty1IfSeasoned(storage, firstUseAt, now)`, `unlockTty1IfInUse(storage, theme)`.

- [ ] **Step 1 : écrire les tests qui échouent.** Un stockage en mémoire, un stockage qui lève à la
  lecture, un qui lève à l'écriture, et `null`. Cas :
  - verrouillé par défaut ; `unlockTty1` puis `isTty1Unlocked` vrai ; la valeur écrite est `'1'` ;
  - une valeur inconnue (`'0'`, `'oui'`) ne débloque pas ;
  - `unlockTty1IfSeasoned` : 29 jours et 23 h non, 30 jours pile non, 30 jours + 1 ms oui ; une date
    future (horloge reculée) non ; `firstUseAt` non fini non ;
  - `unlockTty1IfInUse(storage, 'tty1')` débloque, `'dark'` et `'light'` non ;
  - stockage qui lève ou `null` : aucune exception, `isTty1Unlocked` faux ;
  - `SEASONED_AFTER_DAYS > BOOT_EASTER_EGG_MAX_DELAY_DAYS`.
- [ ] **Step 2 : constater le rouge** (`npx vitest run src/stores/skinUnlock.test.ts`).
- [ ] **Step 3 : écrire le store.** Le type du stockage est `Pick<Storage, 'getItem' | 'setItem'> | null`,
  celui de `getBootStorage`. Toute exception est avalée, avec le commentaire de `bootEasterEgg.ts` :
  le stockage est un confort, le démarrage doit aboutir.
- [ ] **Step 4 : constater le vert, puis `typecheck` et `lint`.**
- [ ] **Step 5 : commit** `feat(tty1): le coffre du déblocage de TTY1`.

### Task 2 : la première utilisation, lue dans la base

**Files:**

- Create: `src/data/repositories/firstUse.ts`, `src/data/repositories/firstUse.test.ts`

**Interfaces:**

- Produces: `getFirstUseAt(): Promise<number | undefined>`.

- [ ] **Step 1 : écrire les tests qui échouent** (`fake-indexeddb`, `resetDb`) : table vide → `undefined` ;
  trois exercices de `createdAt` 300, 100, 200 → 100 ; un exercice supprimé (`deletedAt > 0`) compte ;
  un exercice personnalisé compte.
- [ ] **Step 2 : constater le rouge, écrire la fonction** (`db.exercises.each`, un minimum glissant ;
  pas d'index, pas de `toArray` : la table fait mille lignes et la lecture est ponctuelle), vert.
- [ ] **Step 3 : commit** `feat(tty1): lire la première utilisation de l'app`.

### Task 3 : l'option verrouillée des Réglages

**Files:**

- Modify: `src/features/settings/SettingsScreen.tsx`, `src/i18n/fr.ts`
- Test: `src/features/settings/SettingsScreen.test.tsx`

**Interfaces:**

- Consumes: `isTty1Unlocked`, `getBootStorage`.
- Produces: clés `settings.themeTty1Locked`.

- [ ] **Step 1 : réécrire les tests du thème.** Les tests existants posent d'abord
  `localStorage.setItem(TTY1_UNLOCK_KEY, '1')` (le cas « débloqué » est celui d'aujourd'hui). Ajouter :
  - verrouillée : la troisième option est `aria-disabled="true"`, porte un cadenas, son toucher ne
    change ni `data-theme` ni le stockage, et `settings.themeTty1Locked` est à l'écran ;
  - verrouillée : les deux premières options se choisissent comme avant ;
  - débloquée : aucune phrase de verrou, aucun `aria-disabled`.
- [ ] **Step 2 : constater le rouge.**
- [ ] **Step 3 : implémenter.** `useState(() => isTty1Unlocked(getBootStorage()))` : lu une fois, le
  déblocage n'arrive qu'au démarrage. Le bouton garde `role="radio"` et reste focalisable
  (`aria-disabled`, pas `disabled`) pour que sa description soit annoncée (`aria-describedby`). Texte :
  « TTY1 est verrouillé. Garde un œil sur l'écran de chargement. »
- [ ] **Step 4 : vert, `typecheck`, `lint`, commit** `feat(tty1): l'option TTY1 verrouillée dans Réglages`.

### Task 4 : la révélation dans la console rare, et le branchement du déblocage

**Files:**

- Modify: `src/app/Boot.tsx`, `src/app/bootEasterEgg.ts`, `src/main.tsx`, `src/i18n/fr.ts`,
  `src/index.css`
- Test: `src/app/Boot.test.tsx`, `src/app/bootEasterEgg.test.ts`

La console rare est stylée dans `index.css`, dont `Boot.test.tsx` lit des blocs par ancres : les deux
règles de délai des lignes de révélation y vont **juste après**
`.boot[data-phase='in'] .boot-console-line:nth-child(4)`, là où se lisent déjà celles des quatre
premières, et aucune ancre ne bouge. C'est la seule fois que ce plan touche `index.css`, pour huit
lignes.

**Interfaces:**

- Produces: `bootHoldMs(variant, { unlocking, reducedMotion })`, `UNLOCK_REVEAL_EXTRA_MS = 1400`,
  prop `unlocking` de `BootScreen` et de `BootCurtain`, clés `boot.consoleUnlocked` et
  `boot.consoleUnlockedHint`.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - `Boot.test.tsx` : `unlocking` donne six `.boot-console-line` (quatre sinon), les textes des deux
    clés dans l'ordre, après l'invite ; sans `unlocking` aucune des deux ; les deux lignes ont la classe
    de la règle de mouvement réduit.
  - `bootEasterEgg.test.ts` : `bootHoldMs('console', { unlocking: true })` vaut `3360 + 1400`, sans
    `unlocking` 3360 ; `tty1` en mouvement réduit vaut `BOOT_HOLD_MS.normal`.
- [ ] **Step 2 : constater le rouge, implémenter.** `BOOT_HOLD_MS.tty1` passe à 4650 ici (sa valeur
  finale) ; le test « keeps the TTY1 opening as long as the normal one » devient « tient moins de
  cinq secondes ».
- [ ] **Step 3 : brancher `main.tsx`** (aucun test unitaire : il n'est pas exportable, il est vérifié
  par la capture de la Task 10) : lecture du thème, `unlockTty1IfInUse`, variante, `unlocking =
  variant === 'console' && !isTty1Unlocked(storage)`, `holdBootOpening(bootHoldMs(...), …)`, et dans
  `onFullOpening` : `scheduleNextBootEasterEgg` **et** `unlockTty1` pour la variante `console` ;
  après l'initialisation, `getFirstUseAt().then(first => unlockTty1IfSeasoned(...))` dans son propre
  `try`, avant `mount`.
- [ ] **Step 4 : vert, `typecheck`, `lint`, `build`, commit**
  `feat(tty1): la console rare débloque TTY1 et le dit`.

### Task 5 : `tAll` et les textes de l'ouverture

**Files:**

- Modify: `src/i18n/fr.ts`
- Create: `src/i18n/fr.tAll.test.ts`

**Interfaces:**

- Produces: `tAll(key: PoolKey): readonly string[]` ; les nœuds `boot.tty1.*` (le détail est dans la
  spec, section « Le script de l'ouverture »).

- [ ] **Step 1 : écrire les tests qui échouent.** `tAll` rend les chaînes d'un nœud dans l'ordre de
  déclaration ; un nœud inconnu rend un tableau vide ; le type refuse une feuille et un nœud mixte (test
  de type par `// @ts-expect-error`).
- [ ] **Step 2 : écrire le type `PoolKey` et `tAll`.** `PoolKey` : les chemins qui mènent à un nœud dont
  toutes les feuilles sont des chaînes.
- [ ] **Step 3 : écrire les textes** de `boot.tty1` : GRUB, noyaux, horloge, faits, services (`ok`,
  `warn`, `fail`), vérifications, interlude DOS (noms de fichiers en 8.3), porte, cible, ligne de saut.
  Anglais pour la console, français pour la ligne de saut. Chaque modèle ≤ 41 caractères avec ses
  valeurs typiques.
- [ ] **Step 4 : vert, commit** `feat(tty1): les textes de l'ouverture complète`.

### Task 6 : le générateur de script

**Files:**

- Create: `src/app/bootTty1Script.ts`, `src/app/bootTty1Script.test.ts`

**Interfaces:**

- Consumes: `tAll`, `t`, `BOOT_HOLD_MS`.
- Produces: `BootFacts`, `BootLine`, `BootScript`, `buildBootScript(random, facts)`,
  `seededRandom(seed)`.

- [ ] **Step 1 : écrire les tests qui échouent**, à partir de faits fixes (`now` construit en heure
  locale pour que le résultat ne dépende pas du fuseau) :
  - déterminisme : même graine → même script ; graines différentes → au moins deux scripts distincts
    sur vingt graines ;
  - les quatre textes de la console rare sont présents **dans leur ordre** ; GRUB ouvre ; la porte est
    l'avant-dernier genre de ligne significatif, suivie de la cible, de l'invite, de la devise ;
  - `at` croît (large) ; la porte a `doneAt > at` ; la dernière ligne tient avant `BOOT_HOLD_MS.tty1` ;
    `durationMs === BOOT_HOLD_MS.tty1` ; la première ligne n'apparaît pas avant 400 ms ;
  - sur 500 graines : aucune ligne de plus de 41 caractères, aucune accolade `{`/`}` restante, aucun
    `undefined` ni `NaN` dans le texte ;
  - une valeur absente (`cores`, `screen`, `online`) écarte la ligne qui la cite, sans exception ;
  - une liste de sondes vide : pas de porte, la cible suit directement les vérifications (le script
    reste valide) ;
  - `dir /s` : la date est celle de `now`, les tailles sont groupées par milliers (`41,216`), la somme
    des fichiers de la sortie est celle de la ligne de total, le numéro de série a la forme `XXXX-XXXX` ;
  - `seededRandom` : suite reproductible, valeurs dans `[0, 1[`.
- [ ] **Step 2 : constater le rouge.**
- [ ] **Step 3 : écrire le générateur.** Une fonction par partie (chargeur, noyau, services,
  vérifications, interlude, porte, fin), une disposition qui répartit les lignes libres entre 400 ms et
  l'instant d'attente de la porte, avec un plancher de 35 ms par ligne (un tirage trop dense perd des
  lignes de vérification d'abord).
- [ ] **Step 4 : vert, `typecheck`, `lint`, commit** `feat(tty1): le générateur de l'ouverture complète`.

### Task 7 : les faits, vrais

**Files:**

- Create: `src/app/bootFacts.ts`, `src/app/bootFacts.test.ts`

**Interfaces:**

- Produces: `readBootFacts(now, environment?)`.

- [ ] **Step 1 : écrire les tests qui échouent.** Les six sondes rendent chacune `{ call, result }` non
  vides ; `estimateOneRepMax(100, 5)` rend `116.7 kg` (la valeur de la bibliothèque, pas une copie :
  le test appelle `estimateOneRepMax` lui-même) ; une sonde qui lève est absente de la liste, les autres
  restent ; un `environment` sans `hardwareConcurrency` laisse `cores` absent ; les constantes viennent
  de `lib/rest`, `lib/deload`, `lib/plates` et de `CATALOGUE_SIZE`.
- [ ] **Step 2 : constater le rouge, implémenter.** `environment` par défaut : `navigator` et `window`
  (jsdom les fournit, sans `hardwareConcurrency` fiable : le test pose le sien).
- [ ] **Step 3 : vert, commit** `feat(tty1): des faits vrais pour l'ouverture`.

### Task 8 : l'horloge, le rendu, le saut

**Files:**

- Create: `src/app/useBootClock.ts`, `src/app/useBootClock.test.ts`, `src/platform/reducedMotion.ts`,
  `src/platform/reducedMotion.test.ts`
- Modify: `src/app/Boot.tsx`, `src/app/bootEasterEgg.ts` (signal d'abandon), `src/main.tsx`,
  `src/styles/tty1.css`
- Test: `src/app/Boot.test.tsx`, `src/app/bootEasterEgg.test.ts`

**Interfaces:**

- Produces: `useBootClock(instants, { immediate })` → millisecondes écoulées ;
  `prefersReducedMotion()` ; `holdBootOpening(durationMs, shouldSkip, onFullOpening, abort?)` ;
  prop `script` de `BootScreen` et de `BootCurtain`.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - `reducedMotion` : `matchMedia` absent → faux (jsdom) ; présent → sa réponse.
  - `useBootClock` (temporisateurs simulés) : 0 au montage ; la valeur saute d'instant en instant ;
    `immediate` donne le dernier instant sans temporisateur ; le démontage annule tout.
  - `Boot.test.tsx` : à t = 0 aucune ligne de console ; à 500 ms les premières ; à la fin toutes ;
    `exiting` les rend toutes sans temporisateur ; la colonne est ancrée en bas (classe) ; l'attente de
    la porte devient sa validation à `doneAt` ; le curseur n'est que sur la dernière commande ; une
    commande porte `--chars` ; le niveau et l'horodatage d'une ligne sont reconnus ; la ligne de saut est
    présente en jeu, absente en sortie ; sans `script`, le rendu retombe sur une graine fixe.
  - `holdBootOpening` : `abort()` avant la fin résout sans appeler `onFullOpening` ; un signal déjà
    annulé résout tout de suite.
- [ ] **Step 2 : constater le rouge, implémenter le crochet, le rendu, le signal.** Les anciens tests
  de `BootTty1` (quatre `.boot-tty1-line`, la commande, la devise) sont **remplacés** par ceux ci-dessus :
  la console fixe n'existe plus.
- [ ] **Step 3 : CSS** dans `tty1.css` : colonne ancrée en bas et estompe du bord haut, animation de la
  porte (`transform` + `steps(6)`), frappe par `--chars`, horodatage gris, ligne de saut ; les règles
  `nth-child` des quatre lignes fixes disparaissent ; la règle de mouvement réduit s'étend aux nouvelles
  classes. Brancher le saut dans `main.tsx` (un `AbortController` pour la variante `tty1`, un
  `pointerdown` unique, retiré en fin d'ouverture).
- [ ] **Step 4 : vert, `typecheck`, `lint`, `build`, commit** `feat(tty1): l'ouverture complète se joue
  au fil de l'horloge`.

### Task 9 : paramètres de développement

**Files:**

- Modify: `src/main.tsx`

- [ ] **Step 1 :** `?bootSeed=<entier>` (développement seulement) fixe le tirage ; sans lui, `Math.random`.
  Il n'existe pas en production : la branche est derrière `import.meta.env.DEV`.
- [ ] **Step 2 : commit** `chore(tty1): ?bootSeed= pour rejouer une ouverture en développement`.

### Task 10 : l'œil

**Files:**

- Modify: `src/styles/tty1.css` (réglages), éventuellement les constantes de cadence du générateur

- [ ] **Step 1 :** serveur de développement, captures de Chromium à 390 × 844 et 360 × 740, graine fixe,
  aux instants 300, 1 200, 2 400, 3 300, 3 700, 4 100, 4 600 ms de l'ouverture TTY1 ; puis avec
  `prefers-reduced-motion: reduce`.
- [ ] **Step 2 :** console rare avec et sans révélation (stockage vidé puis plein), 390 × 844 ; Réglages
  verrouillés et débloqués, thème Sombre.
- [ ] **Step 3 :** corriger ce que les images montrent : pas de ligne coupée à mi-hauteur, rien qui
  déborde de la marge, curseur unique, bord haut estompé sans bavure, indication de saut lisible et
  hors du chemin de la dernière ligne. Chaque correction dit pourquoi dans son commentaire.
- [ ] **Step 4 :** `typecheck`, `lint`, `test:run`, `build`.
- [ ] **Step 5 : commit** `feat(tty1): réglages de l'ouverture complète d'après les captures`.

### Task 11 : consigner et pousser

**Files:**

- Modify: `PROGRESS.md`, `docs/progress/decisions-et-pieges.md`

- [ ] **Step 1 :** `PROGRESS.md` : section de cette fonctionnalité (ce qui est fait, les trois chemins
  de déblocage, la durée fixe, les pièges rencontrés, le checkpoint téléphone), et la mise à jour du
  nombre de lignes de `tty1.css` dans « Dette technique assumée ».
- [ ] **Step 2 :** `npm run typecheck && npm run lint && npm run test:run && npm run build`.
- [ ] **Step 3 : commit** `docs: consigner le déblocage de TTY1 et l'ouverture complète`, puis
  `git push -u origin ccr-19a013d9-m9sh2y`.
- [ ] **Step 4 : demander** à l'utilisateur s'il veut la fusion dans `master`, le push et la version
  (mineure : 2.9.0). Ne rien faire sans réponse.
