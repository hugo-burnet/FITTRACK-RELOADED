# Passation — tutoriel campagne, Programmes et Voix uniquement

**Date :** 28 août 2026
**Pour :** l'agent qui exécute les tâches 5 à 11 du plan
**Plan :** `docs/superpowers/plans/2026-08-28-tutorial-campaign-voice-only.md`
**Spécification :** `docs/superpowers/specs/2026-08-28-tutorial-campaign-voice-only-design.md`

Le plan reste la source de vérité pour **quoi** faire. Ce document dit **où en est le
travail**, ce qui a déjà été décidé autrement que dans le plan, et les pièges de ce dépôt
qui font perdre du temps ou cassent la CI sans le dire.

## 1. Où en est le chantier

Branche `claude/tutorial-hybrid-campaign-76f6d8`, worktree
`.claude/worktrees/tutorial-hybrid-campaign-76f6d8`.

| Commit    | Tâche | Contenu                                                        |
| --------- | ----- | -------------------------------------------------------------- |
| `9e6aa1a` | —     | Spécification et plan                                           |
| `3e29b07` | 1     | État `fittrack:tutorial:v3` et migration v2                     |
| `7fae981` | 2     | Résolution exacte des écrans, attente de la cible               |
| `ce4991c` | 3     | `TutorialHud` partagé, avance manuelle                          |
| `67c135d` | 4     | Campagne Curl haltères, événements avec identités               |

`npm run typecheck && npm run lint && npm run test:run` passent au dernier commit
(2281 tests). **Chaque tâche suivante part d'un arbre vert et le rend vert.**

Restent les tâches **5 à 11** : chapitre Programmes, missions contextuelles, mode Voix
uniquement, côtés Premier/Second persistants, contrôle manuel des côtés, double annonce du
gainage, audit navigateur et documentation.

## 2. Ce qui a été décidé autrement que dans le plan

Ces écarts sont volontaires et documentés dans les messages de commit. **Ne pas les
défaire** en croyant corriger un oubli.

1. **`routine-prepared` n'existe pas.** La dernière étape de l'acte 1 est une étape
   `advance: MANUAL`. Un événement qui n'a pour seul émetteur que le bouton du tutoriel
   n'est pas un geste métier, c'est un aller-retour déguisé.
2. **`rest-adjusted` n'existe pas.** Ajouter ou retirer du temps de repos n'a pas encore de
   commande dans l'écran de séance. L'étape C16 avance sur `rest-finished`. Si la tâche 6
   ajoute ces commandes, elle ajoute l'événement **et** élargit l'étape — pas avant.
3. **Une étape peut ne pas avoir de `clipId`.** Sa consigne se lit alors en entier dans le
   panneau. Le test du manifeste (`src/features/tutorial/tutorialMissionMachine.test.ts`)
   n'exige plus une voix partout ; il interdit un `clipId` qui ne serait pas déclaré dans
   `src/audio/voiceScript.json`. C'est l'invariant qui compte.
4. **`voiceScript.json` a un drapeau `pending`.** Une ligne marquée `pending: true` est un
   texte écrit dont le MP3 n'existe pas encore. `src/audio/holdMarks.test.ts` vérifie deux
   choses : toute ligne non `pending` a son MP3, et **aucune ligne `pending` n'a de MP3** —
   dès que l'enregistrement existe, le drapeau doit disparaître.
5. **`TutorialMissionStep.targetId` peut être `null`** pour une étape qui parle de l'écran
   entier. Elle n'attend alors aucune ancre pour s'afficher.
6. **La visite guidée n'est plus une boîte de dialogue modale** mais une `region`. Un
   tutoriel qui demande de vrais gestes ne peut pas piéger le focus ni bloquer sa cible.

## 3. Invariants non négociables

Ils viennent de `CLAUDE.md` et de la section 3 de la spécification. Une tâche qui les
enfreint est à refaire, même si ses tests passent.

- **Le tutoriel n'écrit jamais à la place de l'utilisateur.** Il navigue, il cadre, il
  attend. Aucune création, saisie, validation, activation, suppression ou restauration
  n'est déclenchée par le tutoriel. Une mission destructive s'arrête **avant** la
  confirmation irréversible.
- **Aucune fausse séance, aucun faux historique.**
- **Une étape, une cible, une phrase, une réussite.** Pas d'avance automatique après la
  voix : événement métier, ou bouton « Continuer » explicite.
- **La route et la cible précèdent la voix.** Rien n'est dit tant que l'ancre n'est pas là.
- **Le texte suffit.** Tout fonctionne hors ligne et en mode Silence.
- **Local-first, aucun secret dans le bundle, aucune limite artificielle.**
- Tous les textes d'interface vivent dans `src/i18n/fr.ts`. Code et types en anglais,
  interface en français. Pas de `any`. Dates en epoch ms. IDs par `crypto.randomUUID()`.
- Accès aux données **uniquement** par `src/data/repositories/*`.
- Cibles tactiles ≥ 48 px. Panneau du tutoriel ≤ 28 % de `100dvh`, détail replié.
- Un fichier = une responsabilité ; au-delà de ~300 lignes, découper.
- **Un commentaire dit *pourquoi*** — quel défaut réel il empêche de revenir. Français ou
  anglais selon le module, jamais une paraphrase du code.

## 4. Interdits absolus

- **Ne jamais lancer `scripts/generate-voice.mjs`.** La génération des voix est un chantier
  séparé, elle coûte de l'argent réel et demande une clé API que l'utilisateur doit
  remettre. Les textes se préparent, les MP3 non.
- **Ne jamais `git push`**, ne jamais toucher à `master`, ne jamais `push --force`.
- **Ne jamais utiliser `git stash` nu.** Le stash est partagé entre tous les worktrees et
  d'autres sessions y travaillent. Préférer un commit WIP.
- **Ne jamais lancer `prettier --write` sur un dossier** ni sur un fichier qu'on n'a pas
  touché : le dépôt n'est pas uniformément formaté, et 12 lignes ajoutées produiraient 159
  lignes de diff. Vérifier d'abord si le fichier était conforme **avant** la modification :

  ```bash
  git show HEAD:CHEMIN > /tmp/avant && npx prettier --check --stdin-filepath CHEMIN < /tmp/avant
  ```

  S'il l'était, `prettier --write` sur ce seul fichier. Sinon, écrire ses propres lignes au
  format attendu et laisser le reste tranquille. Le portail réel est `npm run lint`.
- **Ne pas modifier la spécification ni le plan** pour les faire correspondre au code. Un
  écart se discute et se consigne, comme ceux de la section 2.

## 5. Pièges de ce dépôt

- **Plusieurs fichiers sont en CRLF** (`src/i18n/fr.ts`, `src/audio/voiceScript.json`,
  la plupart des `.tsx`), d'autres en LF ; `core.autocrlf=true` normalise au commit. Un
  `perl -0pi -e` ou un `String.replace` avec des motifs `\n` **ne matche pas** un fichier
  CRLF, et pire, peut laisser des `\r` isolés au milieu des lignes. Détecter la fin de
  ligne avant de remplacer, ou éditer par un outil qui la préserve.
- **La suite complète prend environ 7 minutes.** Pendant le travail, ne lancer que les
  suites concernées (`npm run test:run -- src/features/tutorial src/features/workout`).
  La suite complète est une porte de fin de tâche, pas une boucle de développement.
- **`vitest` lancé en arrière-plan n'écrit rien d'exploitable** : le fichier de sortie
  reste vide et seul le code retour arrive. Lancer au premier plan.
- **Les faux minuteurs figent `fake-indexeddb`.** Avec `vi.useFakeTimers()`, un écran qui
  attend une lecture Dexie n'arrive jamais, et le test se plaint d'un texte introuvable —
  pas de la base. Et une avance de minuteur qui provoque un `setState` React doit être
  enveloppée : `await act(async () => { await vi.advanceTimersByTimeAsync(6_000); })`.
- **Écrire en base par IndexedDB brut ne réveille pas `useLiveQuery`.** Passer par les
  repositories, ou recharger.
- **Ne jamais poser un nœud DOM sur `document.body` dans un test.** Testing Library ne
  nettoie que son conteneur : le nœud survit à un test qui échoue et pollue les suivants.
  `renderTutorial` de `TutorialProvider.test.tsx` expose `showAnchors` pour ça.
- **`react-hooks/set-state-in-effect` est une erreur de lint**, pas un avertissement. Pour
  remettre un état à zéro quand une prop change, comparer pendant le rendu (motif de
  `useTutorialAnchor` et de `TutorialHud`), pas dans un effet.
- **Le slug d'un exercice est facultatif** (`Exercise.slug?: string`) : les exercices
  personnels n'en ont pas. Aucune mission ne peut en désigner un.
- **`npm run lint` sort avec un avertissement préexistant** sur
  `src/features/routines/RoutineCollection.tsx`. Zéro erreur = la porte est passée.

## 6. Découpage des runs

**Une tâche du plan par run.** Chaque tâche a ses fichiers, ses tests et ses portes ; un
run qui en enchaîne trois ne se relit pas et ne se rattrape pas.

| Run | Tâche | Sujet                                              | Dépend de |
| --- | ----- | -------------------------------------------------- | --------- |
| A   | 5     | Chapitre Programmes, P01–P18                       | 4         |
| B   | 6     | Missions contextuelles restantes, écran par écran  | 5         |
| C   | 7     | Politique centrale du mode Voix uniquement         | —         |
| D   | 8     | État Premier/Second côté persistant en repository  | —         |
| E   | 9     | Contrôle manuel des côtés, cadence découplée       | 7 et 8    |
| F   | 10    | Double annonce du gainage                          | 9         |
| G   | 11    | Audit navigateur, inventaire et `PROGRESS.md`      | tout      |

Les runs C et D ne touchent pas au tutoriel : ils peuvent partir avant A et B si besoin,
mais **pas en parallèle** sur le même worktree.

### Contrat de chaque run

1. Lire la tâche correspondante dans le plan, **et elle seule**.
2. Écrire les tests RED avant le code (TDD sur la logique métier : moteur, politique audio,
   machine des côtés, repositories). Un test qui échoue n'est jamais « corrigé » en
   modifiant l'assertion sans comprendre pourquoi.
3. Implémenter.
4. Portes, dans cet ordre : `npm run typecheck`, `npm run lint`, les suites touchées, puis
   `npm run test:run` complet.
5. Un commit atomique, message en français, convention `feat:` / `fix:` / `refactor:` /
   `test:` / `docs:`. Le message dit **quel défaut réel** le changement empêche de revenir,
   pas la liste des fichiers.
6. S'arrêter. Ne pas enchaîner sur la tâche suivante.

### Commande

```bash
grok --cwd "C:/Users/e6/Documents/FITTRACK RELOADED/.claude/worktrees/tutorial-hybrid-campaign-76f6d8" "Lis docs/superpowers/plans/2026-08-28-tutorial-campaign-handoff.md en entier, puis exécute la Tâche 5 du plan docs/superpowers/plans/2026-08-28-tutorial-campaign-voice-only.md. Une seule tâche, portes vertes, un commit, puis stop."
```

## 7. Points de vigilance par tâche

- **Tâche 5 (Programmes).** Les écrans `program-editor` / `program-detail` existent déjà
  dans `tutorialScreens.ts` et distinguent création, détail et édition. `missionProgramId`
  est déjà persisté et alimenté par l'URL. P18 s'arrête **avant** « Démarrer » : le
  chapitre explique que ce bouton lance une vraie séance, il ne l'appuie pas. Si aucune
  routine n'existe, l'étape du Split cible la création d'une routine et attend.
- **Tâche 6 (missions contextuelles).** C'est le plus gros volume : ~25 missions, leurs
  ancres dans les écrans métier et toute la copie française. `contextualMissionsForPath`
  filtre déjà sur `routePrefix`, disponibilité et accessibilité — une mission dont la
  première étape n'a pas d'adresse n'est pas proposée. Les missions destructives
  (suppression d'une séance, restauration) s'arrêtent avant la confirmation.
- **Tâche 7 (Voix uniquement).** Une politique centrale, pas des `if` dans les composants.
  Les cues de cadence sont marqués `repCadence: true` et `planCue` les rend muets, y
  compris ceux planifiés avant le changement de mode. Le moteur refuse aussi d'armer un
  `RepPacer`. Le 3–2–1 **du repos** reste, celui **des dernières répétitions** part.
- **Tâche 8 (côtés).** Champ optionnel non indexé sur `WorkoutSet`, aucune nouvelle table,
  aucune migration Dexie. Il doit survivre à un kill, à un rechargement et à une sauvegarde
  JSON. Une série décochée revient au premier côté. Les échauffements restent hors cycle.
- **Tâche 9 (contrôle manuel).** Les libellés sont **Premier côté / Second côté**, jamais
  gauche/droite : l'utilisateur choisit son côté de départ. Le bouton manuel reste la
  sortie d'autorité même quand la cadence tourne.
- **Tâche 10 (gainage).** Commencer par une reproduction instrumentée de toute la chaîne
  minuteur + audio, avant tout correctif. Si un seul cue est émis mais que le MP3 répète la
  phrase, le défaut est dans l'artefact : le marquer à régénérer, **ne pas supprimer une
  annonce légitime** pour masquer un fichier défectueux.
- **Tâche 11 (audit).** Navigateur mobile 390 × 844, thème sombre et thème clair, clavier
  ouvert, mouvement réduit, route fraîche sans données et route peuplée. Mettre à jour
  `docs/product/FEATURE-INVENTORY.md` et `PROGRESS.md`, et annoncer le checkpoint téléphone
  à l'utilisateur.
