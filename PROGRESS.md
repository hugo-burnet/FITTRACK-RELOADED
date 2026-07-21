# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session Claude Code. C'est la mémoire du projet entre les sessions.

**Dernière mise à jour :** 2026-07-21 (Lot 1 terminé — en attente du checkpoint téléphone)

## Lot en cours

Aucun. **Lot 1 terminé, checkpoint utilisateur à valider.** Prochaine étape :
**Lot 2 — Couche de données** (`docs/plans/lot-02-data-layer.md`).

**Site en ligne :** https://hugo-burnet.github.io/FITTRACK-RELOADED/

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

### Checkpoint Lot 1 — ⬜ à valider sur le téléphone

- [ ] Les 5 onglets du bas fonctionnent, l'onglet actif est visuellement évident.
- [ ] Ça ressemble à une application : pas de zoom au double-tap, pas de rebond
      « pull to refresh », les cibles se touchent sans viser.
- [ ] La bascule clair/sombre (Réglages → Apparence) marche et survit à un rechargement.
- [ ] Tu descends tout en bas d'un écran : rien n'est caché derrière la barre de navigation.
- [ ] Réglages → Saisie : tu tapes `102,5`, la virgule reste affichée et « valeur retenue »
      indique bien 102,5 kg.

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
| 1 | Design system & coquille | ✅ terminé | 2 | ⬜ |
| 2 | Couche de données | ⬜ à faire | — | ⬜ |
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
- **Le panneau navigateur intégré perd parfois l'injection d'événements** (clics et captures
  d'écran expirent) alors que l'exécution JavaScript continue de répondre. Le contournement :
  vérifier par `javascript_tool` (styles calculés, rectangles, clics `element.click()`), et
  ouvrir un onglet neuf pour retrouver les captures. Les messages de console peuvent aussi être
  ceux de la session précédente — toujours confirmer l'état réel du DOM avant de diagnostiquer.

## Dette technique assumée

_(Raccourcis pris volontairement, à rembourser plus tard.)_

- _(vide)_
