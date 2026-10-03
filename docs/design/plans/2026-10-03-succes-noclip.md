# Le succès « noclip » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** débloquer TTY1 donne un palier secret, `noclip`, au jeton Matrix ; pour qui a déjà TTY1, il
s'inscrit simplement dans l'historique, sans cérémonie.

**Architecture :** un genre de palier de plus, `secret`, que le moteur ignore et que la synchronisation
laisse en place ; une écriture idempotente dans le dépôt (`grantSecretMilestone`) ; un petit module d'app
(`grantNoclipIfUnlocked`) qui relie le drapeau de TTY1 à cette écriture ; deux appels dans `main.tsx`.
Le jeton est un JPEG généré par un script du dépôt.

**Tech Stack :** React 19 + TypeScript strict, Dexie, Vitest + Testing Library + `fake-indexeddb`.
Python 3 sans dépendance et ImageMagick pour le jeton, hors de `package.json`.

**Spec :** `docs/design/specs/2026-10-03-succes-noclip-design.md`

**Prérequis :** `docs/design/plans/2026-10-03-tty1-debloque-et-boot-complet.md` (fait).

## Global Constraints

- Code, noms de fichiers et de variables en **anglais** ; interface en **français**, tous les textes dans
  `src/i18n/fr.ts`. Un commentaire dit *pourquoi*, jamais *quoi*.
- Local-first : rien ne demande le réseau. Aucune table, aucun index, aucune version de schéma, aucun
  changement de format de sauvegarde.
- Accès aux données **uniquement** par `src/data/repositories/*`.
- Le catalogue des paliers reste **court** : 59 sur un plafond de 60 que `catalogue.test.ts` garde.
- TDD pour tout ce qui a une logique (Tasks 1, 3 et 4). L'image se vérifie à l'œil (Task 2).
- À la fin de **chaque** tâche : `npm run typecheck`, `npm run lint`, `npm run test:run` verts avant le
  commit ; `npm run build` à la fin des Tasks 2 et 4.
- Branche de la session, commits atomiques en français avec le scope `tty1`. Pas de PR sans demande,
  jamais de `push --force`. **Pas de fusion dans `master`, pas de tag, pas de version** sans l'accord
  explicite de l'utilisateur.
- REQUIRED SUB-SKILL : `test-driven-development` ; `verification-before-completion` avant toute annonce
  de réussite et tout push.

## Carte des fichiers

**Créés :** `src/app/noclip.ts` (+ test), `src/features/milestones/MilestonesScreen.test.tsx`,
`scripts/milestone-art/noclip.py`, `scripts/milestone-art/README.md`, `public/milestones/noclip.jpg`.

**Modifiés :** `src/lib/milestones/{types,catalogue,engine,art}.ts` (+ tests), `src/data/repositories/milestones.ts`
(+ test), `src/features/milestones/{milestoneCopy,MilestonesScreen}.ts(x)` (+ tests), `src/i18n/fr.ts`,
`src/main.tsx`, `PROGRESS.md`.

---

### Task 1 : le genre `secret`, le catalogue, la lecture

**Files:**

- Modify: `src/lib/milestones/types.ts`, `src/lib/milestones/catalogue.ts`, `src/lib/milestones/engine.ts`,
  `src/features/milestones/milestoneCopy.ts`, `src/features/milestones/MilestonesScreen.tsx`,
  `src/i18n/fr.ts`
- Test: `src/lib/milestones/catalogue.test.ts`, `src/lib/milestones/engine.test.ts`,
  `src/features/milestones/milestoneCopy.test.ts`, `src/features/milestones/MilestonesScreen.test.tsx`

**Interfaces:**

- Produces: `MilestoneKind` et `MilestoneGroup` gagnent `'secret'` ; `NOCLIP_MILESTONE_ID` ; clés
  `milestone.group.secret` et `milestone.secret.noclip`.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - Catalogue : `noclip` existe, de genre et de rayon `secret`, sans exercice ni sujet ; seul le genre
    `secret` est dans le rayon `secret` ; le catalogue compte 59 définitions.
  - Moteur : sur un historique long (une centaine de séances, des charges, des tractions), `noclip` n'est
    jamais rendu, et les autres paliers le sont toujours.
  - Lecture : `milestoneReading('noclip', 1)` rend le titre `noclip`, le rayon `secret`, aucun `reached`.
  - Écran : une ligne `noclip` en base fait apparaître le rayon « Secrets » avec son titre, son jeton et sa
    date ; sans elle, aucun rayon « Secrets » ; toucher la ligne ouvre la feuille avec la légende.
- [ ] **Step 2 : constater le rouge.**
- [ ] **Step 3 : implémenter.** Le genre dans `types.ts` (avec le pourquoi : un secret ne se franchit pas),
  `secret()` et la définition dans le catalogue, `firstCrossing` rend `undefined` pour `secret`,
  `titleOf` lit `milestone.secret.<id>`, `GROUPS` gagne `'secret'`, les trois clés dans `fr.ts`.
- [ ] **Step 4 : vert, `typecheck`, `lint`, commit** `feat(tty1): noclip, un palier secret que rien dans l'historique ne franchit`.

### Task 2 : le jeton Matrix

**Files:**

- Create: `scripts/milestone-art/noclip.py`, `scripts/milestone-art/README.md`, `public/milestones/noclip.jpg`
- Modify: `src/lib/milestones/art.ts`, `src/i18n/fr.ts`
- Test: `src/lib/milestones/art.test.ts`, `src/features/milestones/artCaption.test.ts`

**Interfaces:**

- Produces: la clé d'art `noclip`, sa légende `milestone.art.noclip`, le fichier.

- [ ] **Step 1 : écrire les tests qui échouent** : `artForMilestone('noclip')` vaut `'noclip'` ; le JPEG existe
  et fait 384 × 384 (lu dans l'en-tête du fichier, sans dépendance) ; la légende existe ; les tests
  d'invariants existants passent (une clé utilisée une fois, un fichier par clé).
- [ ] **Step 2 : constater le rouge, écrire la clé, la légende et la table.**
- [ ] **Step 3 : écrire le script** : un dessin de glyphes par traits (grille 5 × 7, deux à quatre traits,
  miroir tiré), une pluie en colonnes (une tête claire, une traîne qui s'éteint), un voile de glyphes très
  pâles dans les cases vides, un halo, une vignette ; graine fixe, rastérisation suréchantillonnée à la
  main, PNG écrit par `zlib`, JPEG par ImageMagick. Le même script redonne le même fichier.
- [ ] **Step 4 : regarder l'image** à 384 px, puis réduite à 64 et 80 px comme dans l'app ; corriger ce
  qu'elle montre (lisibilité de la tête de colonne, densité, contraste de la traîne).
- [ ] **Step 5 : vert, `build` (précache 242 → 243 entrées), commit** `feat(tty1): le jeton Matrix de noclip`.

### Task 3 : l'octroi

**Files:**

- Modify: `src/data/repositories/milestones.ts`, `src/main.tsx`
- Create: `src/app/noclip.ts`
- Test: `src/data/repositories/milestones.test.ts`, `src/app/noclip.test.ts`

**Interfaces:**

- Consumes: `isTty1Unlocked`, `milestoneById`.
- Produces: `grantSecretMilestone(definitionId, { celebrate, now })`, `grantNoclipIfUnlocked(storage,
  { celebrate })`.

- [ ] **Step 1 : écrire les tests qui échouent.**
  - Dépôt : une ligne `workoutId: ''`, `value: 1`, acquittée à `now` ou non acquittée selon `celebrate` ; un
    second appel ne fait rien et rend `undefined` ; un identifiant d'entraînement (`bench-100`) ou inconnu
    n'écrit rien ; la ligne est lue par `listMilestones` et, si elle est à célébrer, par
    `listUnacknowledgedMilestones`.
  - Synchronisation : `syncMilestones` avec ou sans célébration, avec un historique vide ou long, laisse la
    ligne intacte (même `id`, même `achievedAt`, jamais supprimée, jamais réécrite) ; un vrai orphelin
    (`bench-100` sans séance) est toujours retiré.
  - Sauvegarde : la ligne passe la validation d'import sans orphelin.
  - `grantNoclipIfUnlocked` : rien tant que le drapeau est bas ou le stockage absent ; une ligne dès qu'il
    est levé ; `celebrate` respecté ; idempotent ; une base qui échoue n'est jamais une exception.
- [ ] **Step 2 : constater le rouge.**
- [ ] **Step 3 : implémenter** `grantSecretMilestone` (une transaction, lecture par `definitionId`),
  la protection dans `syncMilestones`, `grantNoclipIfUnlocked`. Dans `main.tsx` : à la fin de la console
  rare, `celebrate: unlocking` après `unlockTty1` ; après l'initialisation et l'ancienneté, `celebrate: false`.
- [ ] **Step 4 : vérifier dans Chromium** : démarrage avec TTY1 débloqué → ligne acquittée, écran des paliers
  qui la montre ; console rare qui débloque → carte sur l'accueil ; seconde ouverture → plus de carte.
- [ ] **Step 5 : vert, `typecheck`, `lint`, `build`, commit** `feat(tty1): noclip s'inscrit quand TTY1 se débloque`.

### Task 4 : consigner et pousser

**Files:**

- Modify: `PROGRESS.md`

- [ ] **Step 1 :** `PROGRESS.md` : le succès dans la section de TTY1 (ce qui est fait, ce qui est vérifié,
  les pièges), le checkpoint téléphone.
- [ ] **Step 2 :** `npm run typecheck && npm run lint && npm run test:run && npm run build`.
- [ ] **Step 3 : commit** `docs: consigner le succès noclip`, puis `git push -u origin ccr-19a013d9-m9sh2y`.
- [ ] **Step 4 : rappeler** à l'utilisateur que la fusion dans `master` et la version 2.9.0 attendent son
  accord.
