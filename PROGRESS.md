# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session Claude Code. C'est la mémoire du projet entre les sessions.

**Dernière mise à jour :** 2026-07-21 (Lot 2 terminé, checkpoint validé sur PC)

## Lot en cours

Aucun. **Lot 2 terminé et validé.** Prochaine étape : **Lot 3 — Bibliothèque d'exercices**.
À partir de là, l'agent génère le plan détaillé du lot en début de session à partir du cadrage de
`00-ROADMAP.md`.

**Le checkpoint a été fait sur PC, pas sur téléphone.** Acceptable pour le Lot 2 qui ne livre aucune
interaction tactile — mais le Lot 3 (recherche, filtres, liste longue) doit impérativement être
vérifié au doigt sur le téléphone.

**Fin de la Phase 0.** L'app a une charte, une navigation et une base. Le Lot 3 commence à livrer
des fonctionnalités visibles.

**Site en ligne :** https://hugo-burnet.github.io/FITTRACK-RELOADED/

---

## Lot 2 — Couche de données

### Definition of Done — vérifiée le 2026-07-21

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (**65 tests**), `npm run build`
  passent tous les quatre.
- ✅ **168 exercices** au catalogue. Un test vérifie la couverture des **18 groupes musculaires**,
  des **10 équipements** et des **6 types de mesure** — aucun trou.
- ✅ **Seed idempotent vérifié dans un vrai navigateur**, pas seulement en test : 168 → relance →
  168, message « Seed terminé. ».
- ✅ **Cycle complet vérifié** : 168 → *Réinitialiser la base* → 0 (état vide affiché) → *Relancer
  le seed* → 168. **Zéro erreur console.** `useLiveQuery` survit bien à `db.delete()` + `db.open()`,
  ce qui était le point risqué de l'écran.
- ✅ Contrastes **mesurés** sur l'écran de diagnostic, thème sombre **et** clair : toutes les paires
  texte/fond ≥ 4,5:1 (min. relevé 6,63:1). Un échec trouvé et corrigé, cf. ci-dessous.
- ✅ Mise en page mesurée en 375×812 : aucun débordement horizontal, 32 px de marge sous le dernier
  élément une fois défilé tout en bas. Cibles tactiles : boutons 48 px, ligne « Diagnostic » 90 px.

### Catalogue d'exercices — verdict de licence

`yuhonas/free-exercise-db` est sous **The Unlicense** (domaine public), vérifié via l'API GitHub.
**Juridiquement utilisable sans aucune réserve.** Il a quand même été **écarté**, pour deux raisons
qui n'ont rien à voir avec la licence :

1. Le jeu est **entièrement en anglais**. L'interface est en français (ADR-007). Traduire 800 noms
   d'exercices est un projet en soi, et un catalogue à moitié traduit est pire que pas de catalogue.
2. Les images sont référencées par **URL distante** — incompatible avec la règle non négociable
   n°2 (100 % hors-ligne, une salle = un sous-sol sans 4G).

**Option 2 retenue** : 168 exercices écrits à la main en français. Largement au-dessus des ~150
visés, et l'utilisateur peut créer les siens sans limite (RF-08).

### Décisions et écarts par rapport au plan

- **`getLastPerformance` ne suit pas le §5.1 de l'architecture à la lettre.** Le plan lit la
  dernière série de l'index puis filtre les supprimées. Conséquence **vérifiée en remettant le code
  du plan** : supprimer une séance mal saisie **vide** l'affichage de la valeur précédente au lieu
  de faire réapparaître la séance d'avant. L'implémentation retenue remonte l'index et s'arrête sur
  la première série vivante. Un test fige la différence — et il échoue bien avec la version du plan.
- **`MUSCLE_GROUPS` / `EQUIPMENT` / `MEASUREMENT_TYPES` sont des tableaux `const`**, les unions en
  sont dérivées. `exercises.json` n'est pas typé à la compilation : sans ça, une faute de frappe
  dans un `primaryMuscle` produit un exercice qu'**aucun filtre du Lot 3 ne trouvera jamais**, et
  rien dans la pile ne le signale. Un test valide chaque ligne du catalogue contre ces tableaux.
  Les chips de filtre du Lot 3 s'en serviront aussi.
- **`softDelete` prend une interface structurelle étroite**, pas un `EntityTable<T, 'id'>`. La
  fonction ne lit jamais `T`, et TypeScript ne sait pas prouver que `IDType<T, 'id'>` vaut `string`
  tant que `T` est un paramètre de type. Typer au plus juste évite un double cast.
- **`touch` prend `NoInfer` sur ses changements.** Sans ça, un appelant passant un type de
  changement plus étroit fait inférer `T` à `Syncable` et l'écriture est rejetée.
- **`addSet` dérive `exerciseId` et `workoutId` de la ligne parente** au lieu de les accepter de
  l'appelant : ils sont dénormalisés pour l'index, et une copie qui peut diverger de sa source est
  un bug en attente.
- **`createCustomExercise` n'attribue pas de slug** (le slug est la clé du catalogue) et
  **`updateExercise` interdit d'écrire les champs `Syncable`** — signatures plus strictes que celles
  du plan.
- **Un exercice du catalogue supprimé n'est pas ressuscité** par un seed suivant : il garde son
  slug. Supprimer un exercice qu'on ne fait jamais est une décision, pas un accident à annuler.
- **`\p{M}` au lieu de la plage `[U+0300-U+036F]` écrite littéralement** pour retirer les accents.
  Écrite en clair, cette plage est une suite de **caractères invisibles** qu'aucun relecteur ne voit
  et qu'un éditeur peut manger : le fichier a effectivement été écrit deux fois avant que ce soit
  repéré.
- **`SectionTitle` extrait dans `ui/`** (il était dupliqué dans Réglages), **`ChevronRightIcon`
  dessiné à la main** dans `NavIcons.tsx` plutôt qu'un caractère `›` emprunté à la police courante —
  §8 de l'architecture exclut les composants tiers, et le Lot 1 dessine déjà ses icônes.
- **Le quota de stockage est en `--text-2`, pas `--text-3`.** Mesuré : `--text-3` sur une carte en
  thème clair donne **2,33:1**, et 3,81:1 en sombre. `--text-3` reste réservé aux valeurs qui sont
  volontairement des échos (la valeur précédente du Lot 5, les placeholders) — un quota est un
  chiffre qu'on lit. **Trouvé en mesurant, pas en regardant**, encore une fois.
- **Sur l'écran de diagnostic, l'explication est au-dessus du bouton**, et à la confirmation
  « Annuler » est le bouton **rempli**, placé en premier. Les variantes `danger` et `ghost` sont
  toutes deux transparentes par charte : côte à côte, effacer la base ressemblait exactement à
  renoncer à l'effacer.

### Checkpoint Lot 2 — ✅ validé le 2026-07-21

**Validé sur PC**, pas sur téléphone : c'est équivalent ici (le Lot 2 ne livre aucune interaction
tactile), mais le Lot 3 devra bien être vérifié au doigt.

- [x] `npm run test:run` : 65 tests passent (le plan en annonçait ~20).
- [x] Sur `#/settings/debug` : **168** exercices, la liste s'affiche.
- [x] Navigateur entièrement fermé puis rouvert : les données sont toujours là.
- [x] Trois rechargements de suite : le nombre ne bouge pas.
- [x] *Réinitialiser la base* vide réellement la base, et le catalogue revient au rechargement
      suivant. Le bouton *Relancer le seed* a été vérifié côté agent : 168 → 168, sans doublon.

**Un point relevé par l'utilisateur pendant le checkpoint** : « si j'efface tout, les exos se
wipent, mais si je fais Ctrl+F5 ils reviennent ». Comportement **correct** — le seed tourne à chaque
démarrage — mais le message de l'écran **mentait** en laissant croire que le bouton était le seul
chemin de retour. Réécrit (commit `17ef1cf`). La bonne ligne de partage à retenir pour toute la
suite : **le catalogue appartient à l'app et revient toujours ; les séances et les exercices
personnalisés appartiennent à l'utilisateur et ne reviennent jamais.**

**Deuxième point relevé** : `GET /favicon.ico 404` à chaque chargement, réclamé à la racine du
domaine. Corrigé par une icône SVG inline de 305 octets (commit `5b6d7ca`) — pas cosmétique, ce
bruit permanent aurait masqué de vraies erreurs pendant les Lots 3 à 8.

---

## Lot 1 — Design system & coquille

### Definition of Done — vérifiée le 2026-07-21

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (11 tests), `npm run build` passent.
- ✅ Les 5 écrans répondent en mode hash, l'onglet actif porte `aria-current="page"`.
- ✅ Contrastes mesurés dans le navigateur, **thème sombre et thème clair** : chaque paire
      texte/fond de l'app est ≥ 4,5:1. Aucun échec.
- ✅ Cibles tactiles vérifiées en pixels réels : onglets 56 px, boutons ± 48×48, segments de
      thème 48 px.
- ✅ Vérifié en descendant tout en bas de Réglages sur un écran court (375×520) : rien n'est
      masqué par la barre de navigation, 32 px de marge restent sous le dernier élément.
- ✅ Saisie décimale vérifiée dans un vrai navigateur : `102,5` et `102.5` donnent tous deux
      102,5 ; les boutons ± affichent `102,5`.

### Décisions et écarts par rapport au plan

- **`--accent-ink` ajouté** (absent du plan). Le plan n'override pas l'accent en thème clair :
  `#c7f252` en **texte** sur blanc vaut **1,3:1**, invisible. D'où la scission
  **fill / ink** : `--color-accent` reste le vert acide et n'est jamais qu'un *remplissage*
  portant `--color-accent-fg` par-dessus ; `--accent-ink` est tout ce qui doit se lire *contre*
  une surface (texte, icônes, barre d'onglet actif, anneau de focus) et vaut `#46660a` en clair.
  **Trouvé en mesurant, pas en regardant** — la barre d'onglet actif était à 1,18:1.
- **`--text-3` n'est plus utilisé pour les micro-libellés.** `#a1a1aa` sur blanc = 2,3:1. Tous
  les libellés gravés (unités, titres de section) sont en `--text-2`. `--text-3` est réservé aux
  valeurs volontairement atténuées : la « valeur précédente » du Lot 5, les placeholders.
- **`@utility` au lieu de classes CSS nues** pour `tabular`, `safe-bottom`, `safe-top`. Une règle
  `.safe-bottom` hors couche bat silencieusement tous les `pb-*` avec lesquels on la combine.
- **`NumberInput` : resynchronisation pendant le rendu, pas dans un `useEffect`.**
  `react-hooks` v7 (installé ici) interdit `setState` synchrone dans un effet
  (`set-state-in-effect`) et l'accès aux refs pendant le rendu (`refs`) — les deux snippets du
  plan échouent au lint. Motif React officiel « ajuster un état quand une prop change ». Même
  comportement, une frame de moins. **L'état `draft` — le vrai garde-fou — est intact.**
- **`NumberInput` affiche la virgule pour les valeurs venues de l'extérieur.** Après `+2,5` le
  plan affichait `102.5` (point) alors que la frappe clavier donne `102,5`. Le séparateur
  décimal est du texte d'interface, et l'interface est en français. **Une assertion du plan a été
  changée** en conséquence (`toHaveValue('102,5')`), et un test a été ajouté pour figer le fait
  qu'on **ne réécrit jamais ce que l'utilisateur vient de taper**.
- **Barre de navigation en frère flex, pas en `position: fixed`.** Elle est épinglée en bas de la
  même façon, mais aucun écran ne peut plus cacher sa dernière ligne derrière elle — le bug que
  l'étape 4.4 du plan signale devient structurellement impossible.
- **`#root { height: 100dvh }`** en plus du `height: 100%` du plan : avec `100%`, la barre
  d'URL rétractable des navigateurs mobiles laisse la barre de navigation sous le chrome.
- **Script bloquant dans `index.html`** pour poser `data-theme` avant le premier rendu. Le module
  principal est différé : sans lui, un utilisateur en thème clair voit un flash noir à chaque
  démarrage. `applyTheme` met aussi à jour `<meta name="theme-color">`.
- **`Screen.tsx` ajouté** (hors plan) : cadre commun h1 + gouttières + `max-w-[36rem]`, pour
  qu'aucun écran ne redérive ses marges.
- **Icônes dessinées à la main**, pas de librairie : §8 de l'architecture exclut les composants
  UI tiers, et le vocabulaire de la salle (barre, disque, curseurs de charge) est plus juste
  qu'un jeu générique. Zéro dépendance ajoutée.
- **Tâche 5 (i18n) faite avant la tâche 4 (écrans)** : écrire les écrans puis remplacer les
  chaînes en dur aurait été deux fois le travail.

### Parti pris visuel (à respecter dans les lots suivants)

Le plan fixe la palette. Les axes qu'il laissait libres ont été tranchés ainsi :

- **Deux registres typographiques, pas trois.** Cette app n'a presque pas de prose. Le couple
  n'est donc pas « display / texte courant » mais **chiffres tabulaires** (`.metric`, serrés à
  −0,03em) **vs micro-libellés gravés** (`.label-xs` : 11 px, capitales, +0,12em). Le texte
  courant est l'exception. **Exception à `.label-xs` : jamais sur un symbole SI** — c'est `kg`,
  pas `KG`.
- **L'état vide est un relevé à zéro**, pas un échec. `EmptyState` affiche le compteur de la
  collection (`0` + unité) dans exactement la typo qu'il aura une fois plein. Le type l'impose :
  une collection fournit `reading` + `unit`, tout le reste fournit `title`.
- **Mouvement mécanique** : une courbe (`--ease-mech`), deux durées (`--dur-1`, `--dur-2`), et
  seulement deux usages (barre d'onglet actif, montée du Sheet). Rien d'élastique, rien d'autre
  n'est animé. `prefers-reduced-motion` neutralise tout.

### Checkpoint Lot 1 — ✅ validé le 2026-07-21

- [x] Les 5 onglets du bas fonctionnent, l'onglet actif est visuellement évident.
- [x] Ça ressemble à une application : pas de zoom au double-tap, pas de rebond
      « pull to refresh », les cibles se touchent sans viser.
- [x] La bascule clair/sombre (Réglages → Apparence) marche et survit à un rechargement.
- [x] Tu descends tout en bas d'un écran : rien n'est caché derrière la barre de navigation.
- [x] Réglages → Saisie : tu tapes `102,5`, la virgule reste affichée et « valeur retenue »
      indique bien 102,5 kg.

Validé par l'utilisateur sur téléphone. **La charte visuelle et les primitives sont donc figées :
les lots suivants s'appuient dessus au lieu de les redécider.** La section « parti pris visuel »
ci-dessus fait foi.

---

## Lot 0 — Bootstrap & déploiement

### Definition of Done du Lot 0 — vérifiée le 2026-07-21

- ✅ `npm run typecheck`, `npm run test:run` (1 test), `npm run build`, `npm run lint` passent en local.
- ✅ Le workflow passe sur le runner Ubuntu : `npm ci`, typecheck, tests, build, `configure-pages`,
  `upload-pages-artifact`, `deploy-pages` — tous verts (run #2 après correctif de branche).
- ✅ `https://hugo-burnet.github.io/FITTRACK-RELOADED/` répond **HTTP 200**, les deux assets
  (`index-*.js` 190 793 o, `index-*.css` 10 751 o) répondent **200** — donc `base` est correct,
  pas de 404 sur `assets/`.
- ✅ Rendu réel vérifié dans un navigateur : React monté, `<h1>FitTrack</h1>`, fond
  `oklch(0.145 0 none)` (Tailwind v4 compile bien).
- ✅ Les versions d'actions du plan (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`,
  `upload-pages-artifact@v3`, `deploy-pages@v4`) sont acceptées telles quelles, aucune obsolescence.

### Checkpoint Lot 0 — ✅ validé le 2026-07-21

- [x] L'URL s'ouvre et affiche « FitTrack » sur fond sombre (vérifié par l'utilisateur).
- [x] Modifier un texte de `src/App.tsx` → pousser → site à jour. Mesuré : **~40 s** entre le push
      et la fin du job `deploy`. Le hash du bundle change bien
      (`index-8UZIjSV8.js` → `index-Bvk5C3d_.js`), donc c'est un vrai redéploiement.

## Avancement

| Lot | Titre | État | Session(s) | Checkpoint validé |
|-----|-------|------|-----------|-------------------|
| 0 | Bootstrap & déploiement | ✅ terminé | 1 | ✅ |
| 1 | Design system & coquille | ✅ terminé | 2 | ✅ |
| 2 | Couche de données | ✅ terminé | 3 | ✅ |
| 3 | Bibliothèque d'exercices | ⬜ à faire | — | ⬜ |
| 4 | Routines | ⬜ à faire | — | ⬜ |
| 5 | Séance en direct (cœur) | ⬜ à faire | — | ⬜ |
| 6 | Outils de séance | ⬜ à faire | — | ⬜ |
| 7 | Historique & calendrier | ⬜ à faire | — | ⬜ |
| 8 | Réglages & export/import | ⬜ à faire | — | ⬜ |
| 9 | PWA & installation | ⬜ à faire | — | ⬜ |
| 10 | Android (Capacitor) | ⬜ à faire | — | ⬜ |
| 11 | Mesures & photos | ⬜ à faire | — | ⬜ |
| 12 | Statistiques | ⬜ à faire | — | ⬜ |
| 13 | Records & notifications | ⬜ à faire | — | ⬜ |
| 14 | Sync cloud (optionnel) | ⬜ à faire | — | ⬜ |
| 15 | Health Connect | ⬜ à faire | — | ⬜ |
| 16 | Widgets | ⬜ à faire | — | ⬜ |
| 17 | Périodisation | ⬜ à faire | — | ⬜ |
| 18 | Auto-progression | ⬜ à faire | — | ⬜ |
| 19 | Assistant IA | ⬜ à faire | — | ⬜ |
| 20 | Voix & accessibilité | ⬜ à faire | — | ⬜ |

Légende : ⬜ à faire · 🟨 en cours · ✅ terminé · ⏭️ sauté

## Décisions prises en cours de route

_(Toute décision qui contredit ou complète `docs/plans/01-ARCHITECTURE.md` est consignée ici,
avec la date et la raison.)_

### 2026-07-21 — Lot 0

- **Le dépôt s'appelle `FITTRACK-RELOADED`, pas `fittrack`.** Le remote existait déjà
  (`hugo-burnet/FITTRACK-RELOADED`, public, vide). Conséquence :
  `base: '/FITTRACK-RELOADED/'` dans `vite.config.ts`. C'est le **seul** endroit où le nom
  apparaît. Si le dépôt est un jour renommé, c'est la seule ligne à changer — et une erreur ici
  produit une page blanche avec des 404 sur `assets/`.
- **Alias `@` : `fileURLToPath`, pas `.pathname`.** Le snippet du plan
  (`new URL('./src', import.meta.url).pathname`) est cassé sous Windows : il produit
  `/C:/Users/.../FITTRACK%20RELOADED/src` — préfixe `/C:` invalide **et** espace encodé en `%20`
  à cause de l'espace dans le nom du dossier. `fileURLToPath()` règle les deux. Nécessite
  `@types/node` (ajouté en devDep et dans `types` du tsconfig).
- **`baseUrl` supprimé du tsconfig.** TypeScript 6 le refuse (`TS5101: deprecated`). Depuis TS 5,
  `paths` se résout relativement à l'emplacement du `tsconfig.json` — `baseUrl` est inutile.
- **`src/vite-env.d.ts` ajouté** (absent du plan). Sans lui, TS 6 rejette l'import à effet de bord
  `import './index.css'` dans `main.tsx` (`TS2882`).
- **`tsconfig.node.json` non créé.** Listé dans les fichiers de la Tâche 1 mais jamais spécifié, et
  inutile ici : `vite.config.ts` est directement dans le `include` du tsconfig principal.
- **ESLint + Prettier ajoutés.** Livrable annoncé du Lot 0 dans `00-ROADMAP.md` et commande
  documentée dans `CLAUDE.md`, mais absents du plan détaillé. Config plate
  (`eslint.config.js`) avec `typescript-eslint`, `react-hooks`, `react-refresh`, et
  `@typescript-eslint/no-explicit-any: error` pour tenir la règle « pas de `any` ».
  **`npm run lint` n'est volontairement pas dans le workflow CI** : le plan ne fait bloquer le
  déploiement que sur le typecheck et les tests. Un warning de style ne doit pas empêcher une mise
  en ligne.
- **`*.tsbuildinfo` ajouté au `.gitignore`** : `tsc -b` le génère à la racine.

**Versions réellement installées** (le plan ne les fixe pas ; à connaître si un comportement
diverge de la doc) : Vite **8.1.5**, Vitest **4.1.10**, Tailwind **4.3.3** (bien la v4, plugin Vite,
sans `tailwind.config.js`), React **19.2.8**, TypeScript **6.0.3**, Node 24.18. Les versions
d'actions GitHub du plan (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`,
`upload-pages-artifact@v3`, `deploy-pages@v4`) ont été gardées telles quelles — non encore
vérifiées à l'exécution.

## Pièges rencontrés / à ne pas refaire

_(Ce que la prochaine session doit savoir pour ne pas perdre du temps.)_

- **`github-pages` était verrouillé sur la branche `main` alors qu'on travaille sur `master`.**
  Symptôme : le job `build` est **entièrement vert**, le job `deploy` échoue en **1 seconde avec
  0 étape exécutée**. Ce n'est ni le `base`, ni les permissions, ni les versions d'actions — c'est
  une *deployment branch policy* sur l'environnement. Cause : Pages a été activé alors que le dépôt
  était encore vide, donc GitHub a créé l'environnement épinglé sur son nom de branche par défaut
  (`main`), qui n'existe pas ici. Correctif : Settings → Environments → `github-pages` →
  *Deployment branches and tags* → remplacer `main` par `master`.
  **Pour les prochains projets : pousser `master` d'abord, activer Pages ensuite.**
- **Le push SSH ne marche pas sur cette machine** : `Host key verification failed`. Contourné en
  passant le remote en HTTPS (`git remote set-url origin https://github.com/hugo-burnet/FITTRACK-RELOADED.git`).
  Git Credential Manager exige une fenêtre interactive : le push ne part que si la commande est
  lancée avec `GIT_TERMINAL_PROMPT=1` et `credential.interactive=true`. Les identifiants sont
  maintenant mémorisés par GCM.
- **Le serveur de dev n'est pas sur `/`** mais sur `http://localhost:5173/FITTRACK-RELOADED/`,
  à cause du `base`. Ouvrir la racine donne une 404 — ce n'est pas un bug.
- **Après un déploiement, le navigateur sert un `index.html` périmé** pendant quelques minutes
  (cache HTTP de GitHub Pages). Constaté pendant le test de la boucle : le fetch direct renvoyait
  déjà le nouveau bundle alors que l'onglet affichait encore l'ancien. Un `Ctrl+Shift+R` ou un
  `?cachebust=1` suffit. Ce n'est pas un bug **mais c'est exactement le problème que le Lot 9
  devra traiter** : les assets sont hashés donc sûrs, c'est `index.html` qui est le point faible.
  Raison de plus pour `registerType: 'prompt'` et l'écran « nouvelle version disponible ».
- **Le chemin du projet contient un espace** (`FITTRACK RELOADED`). Tout code qui manipule des
  chemins doit passer par `fileURLToPath` / `path.join`, jamais par de la concaténation de chaînes
  ou `URL.pathname`.
- **TypeScript 6 est nettement plus strict que ce que supposent les plans** (`baseUrl` déprécié,
  imports à effet de bord typés). Si un snippet de plan écrit avant cette session ne compile pas,
  regarder d'abord de ce côté avant de le réécrire.
- **`eslint-plugin-react-hooks` v7 rejette deux motifs très présents dans les plans** :
  `setState` synchrone dans un `useEffect` (`react-hooks/set-state-in-effect`) et lecture d'un
  `ref.current` pendant le rendu (`react-hooks/refs`). Ce ne sont pas des avertissements de
  style, ce sont des `error` qui font échouer `npm run lint`. Le remplacement est toujours le
  même : ajuster l'état **pendant le rendu** derrière un `if (prop !== lastProp)`, ou passer le
  ref en `useState` s'il pilote l'affichage.
- **Un commentaire JSX `{/* … */}` ne peut pas être placé entre `{cond && (` et l'élément.**
  Dans cette position `{}` est un littéral objet, pas un commentaire, et le fichier ne compile
  plus. Le commentaire va **au-dessus** de la ligne `{cond && (`. (`// …` juste après `return (`
  est en revanche parfaitement valide.)
- **Le cache de dépendances de Vite survit mal à l'ajout d'un gros paquet.** Après le premier
  import de `react-router-dom`, la page a servi trois pré-bundles de hash `?v=` différents →
  deux copies de React → « Invalid hook call » sur `RouterProvider`. `npm ls react` confirmait
  pourtant une seule version dédupliquée. `rm -rf node_modules/.vite` puis redémarrage du
  serveur suffit. **Ne pas chercher le bug dans le code.**
- **Dans DevTools, la base s'appelle `fittrack` en version `10`, pas `1`.** Dexie multiplie le
  numéro de `version(n)` par 10 en interne pour pouvoir intercaler des versions plus tard. Ce n'est
  pas un schéma parti en vrille — ne pas « corriger » ça.
- **Réinitialiser la base ne fait pas disparaître le catalogue durablement**, et c'est voulu : le
  seed tourne à chaque démarrage, donc un simple rechargement réinstalle les 168 exercices. Seules
  les données de l'utilisateur (séances, routines, exercices personnalisés) sont réellement perdues.
  Le message de l'écran a dû être réécrit : il laissait croire que le bouton « Relancer le seed »
  était le seul chemin de retour.
- **`git commit -m` avec un here-string PowerShell casse si le message contient des guillemets
  doubles.** Le here-string est pourtant littéral côté PowerShell, mais l'exécutable `git` reparse
  ses arguments à la mode Windows et coupe le message au premier `"` : le symptôme est une pluie de
  `error: pathspec '...' did not match any file(s)`. **Écrire le message dans un fichier et faire
  `git commit -F fichier`.** C'est la seule forme fiable ici, d'autant que les messages sont en
  français avec des apostrophes typographiques.
- **PowerShell et Bash partagent le répertoire courant dans cette session.** Un `cd` fait depuis
  l'outil Bash déplace aussi l'outil PowerShell — un `npm run typecheck` a fini par échouer en
  `Missing script` parce qu'il tournait dans `node_modules/dexie/dist`. Préfixer les commandes
  longues d'un `Set-Location` sur la racine du projet.
- **Les captures d'écran du panneau navigateur ont encore expiré** (30 s, systématiquement), alors
  que `javascript_tool` répondait normalement. Contournement confirmé et suffisant : tout vérifier
  par JS — `element.click()` pour les interactions, `getBoundingClientRect()` pour la mise en page,
  et un calcul de ratio de contraste maison sur les styles calculés. Ouvrir un onglet neuf **n'a pas
  suffi** cette fois.
- **Le panneau navigateur intégré perd parfois l'injection d'événements** (clics et captures
  d'écran expirent) alors que l'exécution JavaScript continue de répondre. Le contournement :
  vérifier par `javascript_tool` (styles calculés, rectangles, clics `element.click()`), et
  ouvrir un onglet neuf pour retrouver les captures. Les messages de console peuvent aussi être
  ceux de la session précédente — toujours confirmer l'état réel du DOM avant de diagnostiquer.

## Dette technique assumée

_(Raccourcis pris volontairement, à rembourser plus tard.)_

- _(vide)_
