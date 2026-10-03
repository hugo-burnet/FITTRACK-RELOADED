# La version de l’app dans l’en-tête

**Date :** 2026-10-03

**Statut :** demandé par l’utilisateur (« de façon générale, dans le header, la version de l’app »),
implémenté avant le skin TTY1

**Périmètre :** l’en-tête partagé de tous les écrans, dans tous les thèmes

**Plan d’exécution :** `docs/design/plans/2026-10-03-version-en-tete.md`

## Objectif

Lire le numéro de version de l’app en haut de chaque écran, sans ouvrir de menu.

C’est ce qui dit, sur un téléphone, de quelle construction il s’agit, et donc si la PWA et l’APK sont
sur la même. L’écart existe : un correctif poussé après un tag laisse la PWA devant l’APK
(`PROGRESS.md`, revue des cibles d’une routine), et rien dans l’app ne permettait de le constater.

## Comportement utilisateur

Chaque écran porte, en haut à droite de son en-tête, le numéro sous la forme `v2.8.0`. Il est écrit
en 12 px, en chiffres tabulaires, dans `--text-2` : jamais l’accent, que la charte réserve aux actions
principales, aux séries validées et aux records ; jamais `--text-3`, qui ne porte pas un texte qu’on lit.

L’étiquette vit dans la marge haute de l’en-tête, les 20 px de son `pt-5`. Deux conséquences voulues :

- **Pas un pixel de hauteur de plus.** L’en-tête de la séance en direct, l’écran le plus important de
  l’app, ne bouge pas.
- **Jamais à côté du titre.** Le titre est choisi par l’utilisateur (un nom de routine peut être
  n’importe quoi) et se tronque sur une ligne : un second texte à son côté se disputerait les 375 px.
  C’est la leçon du Lot 4 que `Screen` et `HeaderAction` consignent déjà.

Ce n’est pas une commande : pas de cible tactile, pas d’appui (`pointer-events: none`). Le `h1` garde
le titre seul pour nom accessible.

Le numéro est celui de `package.json`, donc celui de l’APK (`versionName`) et du tag.

## Ce qui ne change pas

- La hauteur de l’en-tête, la place du titre, de la flèche de retour et des actions.
- Les données : aucune table, aucun index, aucune version de schéma, aucun export.
- Le hors-ligne. La version est une constante du bundle : aucune requête, aucun service tiers.
- Les thèmes. L’étiquette lit les jetons existants, donc suit Sombre, Clair et TTY1 sans règle propre.

## Architecture

- **Source unique : `package.json`.** `vite.config.ts` lit son champ `version` et le publie comme
  constante de build `__APP_VERSION__` (`define`). Le workflow Android lit le même champ pour le
  `versionName` de l’APK. Un numéro écrit à la main dans le code se périmerait à la première release ;
  celui-ci ne le peut pas, et une release n’a toujours qu’un numéro à changer.
- **Un seul lecteur : `src/app/version.ts`**, qui exporte `APP_VERSION`. Un composant ou un test importe
  cette constante, jamais le global de build.
- **`Screen`** porte l’étiquette. Son format est dans `src/i18n/fr.ts` (`app.versionLabel`, `v{version}`),
  comme tout texte de l’interface.
- L’ouverture console du skin TTY1 réutilise `APP_VERSION` pour sa ligne de version.

## Vérification

- `version.test.ts` : `APP_VERSION` est le champ `version` de `package.json`, sous la forme
  `majeur.mineur.correctif`. Il casse si le `define` saute ou si le numéro est copié à la main.
- `Screen.test.tsx` : l’étiquette est dans l’en-tête, le `h1` garde le titre seul pour nom, et rien
  de ce qu’elle contient ne se touche.
- À l’œil, sur le serveur de dev : 390 et 360 px, thèmes sombre et clair, un titre long, la séance en
  direct. L’en-tête ne doit pas avoir changé de hauteur.
- Les portes habituelles : `typecheck`, `lint`, `test:run`, `build`.

## Hors périmètre

- Une ligne de version dans Réglages ou dans À propos et crédits.
- Le numéro de build, le commit ou la date de construction.
- Un indicateur de mise à jour : la bannière `UpdateBanner` existe déjà.
