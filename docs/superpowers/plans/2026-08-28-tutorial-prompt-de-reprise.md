# Prompt de reprise — tutoriel campagne, Programmes et Voix uniquement

> À coller tel quel dans une session neuve. Il est autonome : rien de ce qui suit ne suppose
> un contexte antérieur. Écrit le 28 août 2026, worktree
> `.claude/worktrees/tutorial-hybrid-campaign-76f6d8`, branche
> `claude/tutorial-hybrid-campaign-76f6d8`, dernier commit `64060a7`.

---

## Ce que tu reprends

FitTrack, application personnelle de musculation, local-first, mono-utilisateur, déployée en
PWA puis empaquetée en APK. Lis `CLAUDE.md` en premier : ses règles ne sont pas négociables.

Le chantier en cours remplace le tutoriel passif — un diaporama de dix chapitres que la voix
faisait défiler — par **un apprentissage dirigé par de vrais gestes**. L'application ouvre le
bon écran, encadre la commande décrite, attend le geste, et reprend au même endroit après une
fermeture.

Trois documents, dans cet ordre :

1. `docs/superpowers/specs/2026-08-28-tutorial-campaign-voice-only-design.md` — la
   spécification, validée par l'utilisateur.
2. `docs/superpowers/plans/2026-08-28-tutorial-campaign-voice-only.md` — le plan
   d'exécution, onze tâches. **La source de vérité pour quoi faire.**
3. `docs/superpowers/plans/2026-08-28-tutorial-campaign-handoff.md` — la passation : les
   écarts déjà décidés, les interdits, les pièges du dépôt. **À lire avant de toucher au
   code.**

---

## Où en est le travail

Huit commits, arbre vert au dernier : `npm run typecheck`, `npm run lint` (zéro erreur) et
`npm run test:run` (2295 tests) passent.

| Commit    | Tâche | Contenu                                                       |
| --------- | ----- | ------------------------------------------------------------- |
| `9e6aa1a` | —     | Spécification et plan, récupérés du dépôt principal            |
| `3e29b07` | 1     | État `fittrack:tutorial:v3`, migration v2 sans perte           |
| `7fae981` | 2     | Routage exact des écrans, attente de la cible avant de parler  |
| `ce4991c` | 3     | `TutorialHud` partagé, avance manuelle explicite               |
| `67c135d` | 4     | Campagne Curl haltères, événements porteurs d'identité         |
| `ad5d76b` | —     | Passation cadrée                                               |
| `81fb4dd` | 5     | Chapitre Programmes, 18 étapes, et découpage de `missions/`    |
| `64060a7` | 6a    | Historique : retrouver, corriger, partager, importer           |

**Restent :**

- **Tâche 6, suite.** Progression, Exercices, Connaissances, Accueil, Réglages, et les
  missions avancées de séance (`TUT-WRK-05` à `TUT-WRK-12`).
- **Tâche 7** — mode Voix uniquement, politique audio centrale.
- **Tâche 8** — état Premier/Second côté persistant en repository.
- **Tâche 9** — contrôle manuel des côtés, cadence découplée.
- **Tâche 10** — double annonce du gainage.
- **Tâche 11** — audit navigateur, inventaire produit, `PROGRESS.md`.

**Un ordre à respecter :** `TUT-WRK-10` (cadence) et `TUT-WRK-11` (maintien et unilatéral)
viennent **après** les tâches 7 et 9. Avant, elles viseraient des ancres qui n'existent pas
encore — `workout-first-side`, `workout-second-side` — et décriraient des commandes absentes.

---

## Ce qui a été décidé autrement que dans le plan

Volontaire, documenté dans les messages de commit. **Ne pas « corriger » comme des oublis.**

1. **`routine-prepared` n'existe pas.** La dernière étape de préparation est
   `advance: MANUAL`. Un événement dont le seul émetteur serait le bouton du tutoriel n'est
   pas un geste métier.
2. **`rest-adjusted` n'existe pas.** Ajouter ou retirer du temps de repos n'a pas de commande
   dans l'écran de séance. L'étape avance sur `rest-finished`. Si une tâche ajoute ces
   commandes, elle ajoute l'événement **et** élargit l'étape — pas avant.
3. **Une étape peut ne pas avoir de `clipId`.** Sa consigne se lit alors en entier dans le
   panneau. Le test du manifeste interdit un `clipId` orphelin ; il n'exige plus une voix
   partout.
4. **`voiceScript.json` a un drapeau `pending`** : texte écrit, MP3 pas encore enregistré.
   `src/audio/holdMarks.test.ts` vérifie que toute ligne non `pending` a son MP3, **et**
   qu'aucune ligne `pending` n'en a — le drapeau doit disparaître dès l'enregistrement.
5. **`targetId` peut être `null`** pour une étape qui parle de l'écran entier plutôt que
   d'une commande. Une seule le fait aujourd'hui, dans le chapitre Programmes.
6. **La visite guidée est une `region`, plus une boîte de dialogue modale.** Un tutoriel qui
   demande de vrais gestes ne peut pas piéger le focus ni bloquer sa cible.
7. **La tâche 6 est commitée par zone**, pas en un seul commit. Vingt et une missions dans un
   commit ne se relisent pas.

---

## Ce qui est interdit

- **Ne jamais lancer `scripts/generate-voice.mjs`.** La génération des voix est un chantier
  séparé : elle coûte de l'argent réel et l'utilisateur doit remettre une clé API. Les textes
  se préparent, les MP3 non.
- **Ne jamais `git push`**, ne jamais toucher à `master`, jamais de `push --force`.
- **Ne jamais utiliser `git stash` nu** : le stash est partagé entre tous les worktrees et
  d'autres sessions y travaillent. Un commit WIP à la place.
- **Ne jamais lancer `prettier --write` sur un dossier**, ni sur un fichier qu'on n'a pas
  modifié. Le dépôt n'est pas uniformément formaté : douze lignes ajoutées produiraient cent
  cinquante lignes de diff. Vérifier d'abord :

  ```bash
  git show HEAD:CHEMIN > /tmp/avant && npx prettier --check --stdin-filepath CHEMIN < /tmp/avant
  ```

  Conforme avant → `prettier --write` sur ce seul fichier. Sinon, écrire ses propres lignes au
  bon format et laisser le reste. Le portail réel est `npm run lint`.
- **Ne pas modifier la spécification ni le plan** pour les faire correspondre au code. Un
  écart se discute et se consigne.

---

## Les principes que le code applique

Ils viennent de la spécification et ils expliquent la moitié des choix déjà faits.

- **Le tutoriel n'écrit jamais à la place de l'utilisateur.** Il navigue, il cadre, il attend.
  Aucune création, saisie, validation, activation, suppression ou restauration n'est
  déclenchée par lui. Une mission destructive s'arrête **avant** la confirmation.
- **Aucune fausse séance, aucun faux historique.** La campagne s'interrompt entre ses deux
  actes et attend que l'utilisateur démarre lui-même sa routine — il peut ne jamais le faire.
- **Une étape, une cible, une phrase, une réussite.** Pas d'avance après la voix : événement
  métier, ou bouton « Continuer ».
- **La route et la cible précèdent la voix.** Rien n'est dit tant que l'ancre n'est pas là ;
  au-delà de six secondes le panneau propose de rouvrir l'écran ou de sortir.
- **Chaque événement porte l'identité de ce qu'il touche.** Sans elle, un geste fait ailleurs
  — une autre routine, un autre bloc — validait l'étape en cours.
- **Le texte suffit.** Tout fonctionne hors ligne et en mode Silence.

---

## Comment une zone se traite

C'est la méthode qui a produit les commits `81fb4dd` et `64060a7`, et elle vaut pour les
zones qui restent.

1. **Inventorier l'existant, factuellement.** Pour chaque écran : chaque commande, son
   libellé français réel lu dans `src/i18n/fr.ts`, l'ancre `data-tutorial-id` déjà posée s'il
   y en a une, ce que la commande écrit en base, et les identifiants disponibles à cet
   endroit. Deux constats de ce genre ont changé la conception du chapitre Programmes : les
   trois étapes de son assistant partagent l'adresse `/programs/new`, et l'identifiant du
   brouillon n'entre dans l'URL qu'à l'activation.
2. **Concevoir les étapes à partir des faits**, jamais du plan seul. Le plan nomme des ancres
   qui n'existent pas toujours ; c'est l'écran qui tranche.
3. **Écrire la copie française** dans `src/i18n/fr.ts`, jamais en dur. Le ton se prend sur les
   blocs `tutorial.campaign` et `tutorial.program` : instruction d'une phrase à l'impératif
   qui nomme la commande par son libellé réel, détail d'une ou deux phrases sur ce que
   l'application garantit. Ni encouragement, ni redite.
4. **Poser les ancres et émettre les événements.** Une ancre ne porte aucune logique de
   tutoriel. Un événement se publie **après** la résolution de l'écriture, jamais avant.
5. **Tests d'abord sur la logique** : le parcours de la mission, les gestes qu'elle refuse,
   l'arrêt devant les gestes irréversibles.
6. **Portes, dans l'ordre** : `npm run typecheck`, `npm run lint`, les suites touchées, puis
   `npm run test:run` complet.
7. **Un commit par zone**, message en français, qui dit quel défaut réel le changement empêche
   de revenir.

---

## Déléguer à grok CLI

`grok` est installé (`/c/Users/e6/.grok/bin/grok`) et il sert **vraiment** sur deux choses :
l'inventaire d'une zone, et la copie française écrite d'après un contrat précis. Il ne sert
pas pour le câblage — spécifier assez précisément où poser chaque ancre coûte autant que le
faire.

```bash
grok --no-subagents --prompt-file CHEMIN --output-format plain > sortie.md
```

- **`--no-subagents` est obligatoire.** Sans lui, il lance des explorations parallèles dont
  les sorties s'entrelacent dans le flux : un inventaire complet a été perdu comme ça.
- **Ses écritures sont bloquées** quand il est lancé depuis un shell d'agent en bac à sable :
  il lit, il imprime, et c'est la session appelante qui applique. Le lancer avec
  `--permission-mode bypassPermissions` demande l'accord de l'utilisateur.
- Lui demander du **factuel seulement** : aucun conseil, aucune proposition. Et lui interdire
  explicitement de deviner un libellé — il doit aller le lire dans `src/i18n/fr.ts`.

---

## Les pièges de ce dépôt

- **Fins de ligne mixtes.** `src/i18n/fr.ts`, `src/audio/voiceScript.json` et la plupart des
  `.tsx` sont en CRLF, d'autres fichiers en LF ; `core.autocrlf=true` normalise au commit. Un
  `perl -0pi -e` ou un `String.replace` avec des motifs `\n` **ne matche pas** un fichier
  CRLF — silencieusement — et peut laisser des `\r` isolés au milieu des lignes. Détecter la
  fin de ligne avant de remplacer.
- **La suite complète prend environ sept minutes.** Pendant le travail, ne lancer que les
  suites concernées. La suite complète est une porte de fin de tâche.
- **`vitest` en arrière-plan n'écrit rien d'exploitable** : seul le code retour arrive.
  Lancer au premier plan.
- **Les faux minuteurs figent `fake-indexeddb`.** Avec `vi.useFakeTimers()`, un écran qui
  attend une lecture Dexie n'arrive jamais et le test se plaint d'un texte introuvable, pas de
  la base. Et une avance de minuteur qui provoque un `setState` doit être enveloppée :
  `await act(async () => { await vi.advanceTimersByTimeAsync(6_000); })`.
- **Écrire en base par IndexedDB brut ne réveille pas `useLiveQuery`** : passer par les
  repositories, ou recharger.
- **Ne jamais poser un nœud DOM sur `document.body` dans un test.** Testing Library ne nettoie
  que son conteneur ; le nœud survit à un test qui échoue et pollue les suivants.
  `renderTutorial` de `TutorialProvider.test.tsx` expose `showAnchors` pour ça.
- **`react-hooks/set-state-in-effect` est une erreur de lint**, pas un avertissement. Pour
  remettre un état à zéro quand une prop change, comparer pendant le rendu — motif de
  `useTutorialAnchor` et de `TutorialHud` — et non dans un effet.
- **Le slug d'un exercice est facultatif** : les exercices personnels n'en ont pas, et aucune
  mission ne peut en désigner un.
- **`npm run lint` sort avec un avertissement préexistant** sur `RoutineCollection.tsx`. Zéro
  erreur = la porte est passée.

---

## Où se trouve quoi

| Fichier                                         | Rôle                                                     |
| ----------------------------------------------- | -------------------------------------------------------- |
| `src/features/tutorial/tutorialTypes.ts`        | État v3, identifiants de mission, événements             |
| `src/features/tutorial/tutorialStore.ts`        | Persistance et migration v1/v2 → v3                      |
| `src/features/tutorial/tutorialScreens.ts`      | Résolution des écrans et contexte de route               |
| `src/features/tutorial/tutorialMissions.ts`     | Le registre, et rien d'autre                             |
| `src/features/tutorial/missions/kit.ts`         | Contrats d'étape et prédicats partagés                   |
| `src/features/tutorial/missions/campaign.ts`    | Les deux actes de la campagne Curl                       |
| `src/features/tutorial/missions/program.ts`     | Le chapitre Programmes                                   |
| `src/features/tutorial/missions/history.ts`     | Les quatre missions d'historique                         |
| `src/features/tutorial/missions/core.ts`        | Les missions qui répondent à une page                    |
| `src/features/tutorial/tutorialMissionMachine.ts` | Avance, reprise de campagne, abandon                   |
| `src/features/tutorial/useTutorialMissions.ts`  | Navigation, mesure de la cible, écriture de la progression |
| `src/features/tutorial/TutorialHud.tsx`         | Le panneau unique — visite, campagne, missions           |
| `src/features/tutorial/TutorialProvider.tsx`    | Invite, aide de page, orchestration                      |

---

## Par quoi commencer

Reprendre la tâche 6 sur une zone au choix parmi Progression, Exercices, Connaissances,
Accueil et Réglages, avec la méthode ci-dessus, et commiter cette zone seule. Puis la
suivante.

Si l'utilisateur préfère avancer sur l'audio, les tâches 7 et 8 sont indépendantes du
tutoriel et peuvent partir tout de suite — mais pas en parallèle sur ce worktree.
